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
    """Saves the component parts of a filename in an object.

    Args:
      filename: A filename with the format {LABEL}_{RULE}_{SHEET_ID}_{DATE}.
        Note that sometimes sheet_id has underscores in it, but the other values
        should not.

    Returns:
      A class of type `FileName`.

    Raises:
      ValueError: If a filename doesn't meet the required format.
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
  """Given a dataframe, prefix each row with a date, sheet ID and label.

  Args:
    df: A pandas DataFrame.
    report_name: Contains the metadata found in a filename, split into parts.

  Returns:
    A new pandas DataFrame with prefixed columns.
  """
  dfl = len(df)
  date = [pd.to_datetime(report_name.date, format=_DATE_FORMAT)]
  df = pd.DataFrame({
      'Date': pd.Series(date * dfl, dtype='datetime64[ns, UTC]'),
      'Category': pd.Series([report_name.category] * dfl, dtype='string'),
      'Sheet_ID': pd.Series([report_name.sheet_id] * dfl, dtype='string'),
      'Label': pd.Series([report_name.label] * dfl, dtype='string'),
  }).join(df)
  df.columns = [_normalize(column) for column in df.columns]
  return df


def _normalize(string):
  return string.replace(' ', '_').replace('.', '')


def load_data_into_pandas(request: http.HttpRequest) -> pd.DataFrame:
  """Use an API request to load the response into pandas for a BQ upload.

  This function expects the response data from the request to be a CSV.

  Args:
    request: An HTTP request, i.e. the one used to download files from drive
      (drive.files().get_media()).

  Returns:
    A pandas DataFrame with the data from the request file in it.
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
  """Loads data into a pandas dataframe from the given list of drive files.

  Downloads the files and loads them into pandas.

  Args:
    last_report_table: The dataframe that has a list of last updated reports
    drive_api: The API for drive calls
    drive_files: A list of drive files with 'name' and 'id' keys,
      typically from drive.files().list()

  Returns:
    A tuple, the first one being the last_report_table, and the second being
    a dict with the key the name of the rule and the value a DataFrame with
    rule results to upload to BigQuery.
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
  """Retrieves a DataFrame with last updated dates per sheet ID.

  If a report table `last_report` exists in BigQuery, creates it.

  Args:
    bigquery_client: The client for BigQuery calls
    gcp_project: The GCP Project
    gcp_dataset: The dataset in which to store the report

  Returns:
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
  """Loads pandas DataTables into BigQuery.

  Loads `last_report_table` and all `dataframes` where each table is named
  by the dict key.

  Args:
    gcp_project: The name of the GCP project.
    gcp_dataset: The name of the dataset for BigQuery.
    bigquery_client: A BigQuery python client.
    last_report_table: The DataFrame for the `last_report` table.
    dataframes: A dict of DataFrames to load, where the key is the table name.
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
  """Cloud function entrypoint.

  Args:
    request: A Cloud Function HTTP request method
      <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>

  Returns:
    A list of tables names/rule names for further evaluation/view creation.
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
