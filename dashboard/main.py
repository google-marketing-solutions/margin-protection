# Copyright 2023 Google LLC.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A Cloud Function for ingesting data from Google Drive into BigQuery."""

import collections
import dataclasses
import datetime
import io
import re
import sys

from google import auth
from google.cloud import bigquery
from google.cloud import exceptions
from google.cloud.bigquery import dataset
from google.cloud.bigquery import table
from googleapiclient import discovery
from googleapiclient import http
import pandas as pd


import functions_framework



SCOPES = [
    'https://www.googleapis.com/auth/drive',
]
_DATE_FORMAT = '%Y-%m-%dT%H:%M:%S.%f%z'
_LAST_REPORT_ID = 'last_report'

__all__ = ['import_dashboard']


@dataclasses.dataclass(frozen=True, eq=True)
class ReportName:
  """Breaks a report filename into its component parts.

  A report has metadata within it separated by underscores. This metadata
  is used to store information in BigQuery and as a key in dicts. Passing
  this object allows the regex matching to be done one time and leveraged
  multiple times.

  Attributes:
    category: The type of data getting exported (SA360, DV360, etc.)
    filename: The full name of the file
    label: The identifying label of a specific sheet (possibly a customer name).
    rule: The rule being executed
    sheet_id: The ID source signifying the copy of the tool.
    date: The datetime of the report to the millisecond.
  """

  filename: str
  category: str
  label: str
  rule: str
  sheet_id: str
  date: datetime.datetime

  @classmethod
  def with_filename(cls, filename: str):
    """Parses a filename to extract metadata components.

    The filename is expected to follow a specific format with underscores
    separating the metadata parts.

    Args:
      filename: A filename with the format
        `{CATEGORY}_{LABEL}_{RULE}_{SHEET_ID}_{DATE}.csv`. Note that sheet_id
        can contain underscores.

    Returns:
      An instance of ReportName populated with the parsed metadata.

    Raises:
      ValueError: If the filename does not match the required format.
    """

    pattern = (
        r'(?P<category>[^_]+)\_'
        r'(?P<label>[^_]*)\_'  # can be blank
        r'(?P<rule>[^_]+)\_'
        r'(?P<sheet_id>.+?)\_'  # sheet IDs sometimes have underscores
        r'(?P<date>\d{4}\-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z).csv'
    )
    matched_filename = re.fullmatch(pattern, filename)
    if matched_filename is None:
      raise ValueError('Invalid filename')
    category, label, rule, sheet_id, date = matched_filename.group(
        'category', 'label', 'rule', 'sheet_id', 'date'
    )
    return cls(
        filename=filename,
        category=category,
        label=label,
        rule=rule,
        sheet_id=sheet_id,
        date=datetime.datetime.strptime(date, _DATE_FORMAT),
    )


def fill_dataframe(df: pd.DataFrame, report_name: ReportName) -> pd.DataFrame:
  """Adds metadata columns to a DataFrame based on the report name.

  This function prefixes the DataFrame with a 'Date' column derived from the
  report name and normalizes all column headers.

  Args:
    df: The input pandas DataFrame.
    report_name: A ReportName object containing the parsed file metadata.

  Returns:
    A new pandas DataFrame with the added 'Date' column and normalized headers.
  """
  dfl = len(df)
  date = [pd.to_datetime(report_name.date, format=_DATE_FORMAT)]
  df = pd.DataFrame({
      'Date': pd.Series(date * dfl, dtype='datetime64[ns, UTC]'),
  }).join(df)
  df.columns = [_normalize(column) for column in df.columns]
  return df


def _normalize(string: str) -> str:
  """Normalizes a string to be a valid BigQuery column name.

  Replaces spaces with underscores and removes periods.

  Args:
    string: The string to normalize.

  Returns:
    The normalized string.
  """
  return string.replace(' ', '_').replace('.', '')


def load_data_into_pandas(request: http.HttpRequest) -> pd.DataFrame:
  """Loads data from a Google Drive file download request into a DataFrame.

  This function expects the response data from the request to be a CSV.

  Args:
    request: An googleapiclient.http.HttpRequest object for downloading a file
      from Google Drive (e.g., from drive.files().get_media()).

  Returns:
    A pandas DataFrame containing the data from the downloaded CSV file.
  """
  file = io.BytesIO()
  downloader = http.MediaIoBaseDownload(file, request)
  done = False
  while not done:
    _, done = downloader.next_chunk()
  file.seek(0)
  df = pd.read_csv(file, dtype='string')
  if 'anomalous' in df:
    df['anomalous'] = pd.Series(df['anomalous'], dtype='bool')
  return df


def load_files_into_dataframes(
    last_report_table: pd.DataFrame,
    drive_api,
    drive_files: list[dict[str, str]],
) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
  """Downloads files from Google Drive and loads their data into DataFrames.

  It iterates through a list of file objects, parses their names for metadata,
  downloads the content, and organizes the resulting DataFrames by rule.

  Args:
    last_report_table: A DataFrame tracking the last processed date for each
      sheet ID.
    drive_api: An authenticated Google Drive API service object.
    drive_files: A list of file metadata dictionaries, each with 'name' and
      'id' keys.

  Returns:
    A tuple containing:
      - The updated last_report_table DataFrame.
      - A dictionary mapping rule names to concatenated DataFrames of their
        respective report data.
  """
  dataframes: dict[str, list[pd.DataFrame]] = collections.defaultdict(list)
  for file_obj in drive_files:
    try:
      report_name = ReportName.with_filename(file_obj['name'])
    except ValueError:
      print(
          f"File '{file_obj['name']}' name is invalid. Skipping.",
          file=sys.stderr,
      )
      continue
    last_report_table.loc[report_name.sheet_id] = [
        report_name.label,
        report_name.date,
    ]
    request = drive_api.files().get_media(fileId=file_obj['id'])
    df = load_data_into_pandas(request)
    dataframes[report_name.rule].append(
        fill_dataframe(df, report_name=report_name)
    )

  return last_report_table, {k: pd.concat(v) for k, v in dataframes.items()}


def _get_or_create_last_report_table(
    bigquery_client: bigquery.Client, gcp_project: str, gcp_dataset: str
) -> pd.DataFrame:
  """Retrieves or creates the 'last_report' table from BigQuery.

  This table tracks the timestamp of the last successfully processed report for
  each unique sheet ID.

  Args:
    bigquery_client: An authenticated BigQuery client.
    gcp_project: The GCP project ID.
    gcp_dataset: The BigQuery dataset ID.

  Returns:
    A pandas DataFrame representing the 'last_report' table, indexed by
    'Sheet_ID'.

  Raises:
    RuntimeError: If there's an unexpected issue retrieving the table.
  """
  try:
    select_tables = bigquery_client.query(
        'SELECT Sheet_ID, Label, Date from'
        f' `{gcp_project}.{gcp_dataset}.{_LAST_REPORT_ID}`'
    ).to_dataframe()
  except exceptions.NotFound:
    select_tables = pd.DataFrame({'Sheet_ID': [], 'Label': [], 'Date': []})
    select_tables['Date'] = pd.to_datetime(select_tables['Date'])
  except KeyError as e:
    raise RuntimeError from e

  return select_tables.set_index('Sheet_ID')


def load_data_into_bigquery(
    gcp_project: str,
    gcp_dataset: str,
    bigquery_client: bigquery.Client,
    last_report_table: pd.DataFrame,
    dataframes: dict[str, pd.DataFrame],
) -> None:
  """Loads multiple pandas DataFrames into BigQuery tables.

  This function loads the `last_report_table` and all DataFrames in the
  `dataframes` dictionary into BigQuery. Each table in `dataframes` is named
  using its dictionary key.

  Args:
    gcp_project: The name of the GCP project.
    gcp_dataset: The name of the BigQuery dataset.
    bigquery_client: An authenticated BigQuery client.
    last_report_table: The DataFrame for the 'last_report' table. It will
      overwrite the existing table.
    dataframes: A dictionary where keys are table names (rules) and values are
      the DataFrames to load. These are appended to existing tables.
  """
  dataset_ref = dataset.DatasetReference(
      dataset_id=gcp_dataset,
      project=gcp_project,
  )
  for rule, df in dataframes.items():
    bigquery_client.load_table_from_dataframe(
        df,
        table.TableReference(
            dataset_ref=dataset_ref,
            table_id=_normalize(rule),
        ),
    ).result()
    print(f'Completed {rule} ingestion')
  job_config = bigquery.LoadJobConfig(
      write_disposition='WRITE_TRUNCATE',
  )
  bigquery_client.load_table_from_dataframe(
      last_report_table,
      table.TableReference(
          dataset_ref=dataset_ref,
          table_id='last_report',
      ),
      job_config=job_config,
  ).result()
  print('Saved updated dates to `last_report`')


@functions_framework.http
def import_dashboard(request):
  """The main entry point for the Cloud Function.

  This function is triggered by an HTTP request. It parses the request body for
  GCP project info and a list of files from Google Drive, then orchestrates the
  process of downloading, transforming, and loading the data into BigQuery.

  Args:
    request: A Flask request object containing the JSON payload with 'gcp_project',
      'gcp_dataset', and 'file_list'.
      <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>

  Returns:
    A dictionary containing a list of the table names (rules) that were
    processed and loaded into BigQuery.
  """
  request_json = request.get_json(silent=True)
  gcp_project = request_json['gcp_project']
  gcp_dataset = request_json['gcp_dataset']
  drive_files = [{'id': file['id'], 'name': file['name']} for file in request_json['file_list']]

  credentials, _ = auth.default(scopes=SCOPES, quota_project_id=gcp_project)
  drive_api = discovery.build('drive', 'v3', credentials=credentials)
  client = bigquery.Client()

  last_report_table = _get_or_create_last_report_table(
      client, gcp_project=gcp_project, gcp_dataset=gcp_dataset
  )
  last_report_table, dataframes = load_files_into_dataframes(
      last_report_table=last_report_table,
      drive_api=drive_api,
      drive_files=drive_files,
  )
  load_data_into_bigquery(
      gcp_project=gcp_project,
      gcp_dataset=gcp_dataset,
      bigquery_client=client,
      dataframes=dataframes,
      last_report_table=last_report_table,
  )
  return {
      'tables': list(dataframes.keys())
  }
