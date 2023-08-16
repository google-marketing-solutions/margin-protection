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
from typing import Dict, List, Tuple

from googleapiclient import http
import pandas as pd

_DATE_FORMAT = '%Y-%m-%dT%H:%M:%S.%f%z'


@dataclasses.dataclass(frozen=True, eq=True)
class ReportName:
  """Breaks a report filename into its component parts.

  A report has metadata within it separated by underscores. This metadata
  is used to store information in BigQuery and as a key in dicts. Passing
  this object allows the regex matching to be done one time and leveraged
  multiple times.
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
  if df.get('anomalous'):
    df['anomalous'] = pd.Series(df['anomalous'], dtype='bool')
  return df


def get_latest_launch_monitor_files(
    drive_api, drive_id, since: datetime.datetime
) -> str:
  """Returns the drive ID of the launch monitor folder given a parent folder.

  Raises:
    ValueError: If the "reports" folder or its parent can't be found.

  Args:
    drive_api: The drive service.
    drive_id: The ID the drive folder where the 'reports' folder lives.
    since: The datetime to start searching from (the last time the report was
      run). If the report hasn't been run yet, this will be a pd.NaT and start
      from scratch.

  Returns:
    A list of files to be downloaded.
  """
  result = (
      drive_api.files()
      .list(q=f"'{drive_id}' in parents and name='reports'")
      .execute()
  )
  try:
    file_id = result['files'][0]['id']
  except IndexError as e:
    raise ValueError(
        f'No folder in drive with ID {drive_id} named "reports". '
        'Either the parent ID is invalid or the "reports" '
        'folder is missing.'
    ) from e

  if not pd.isnull(since):
    since_string = datetime.datetime.strftime(since, _DATE_FORMAT)
    and_time = f' and createdTime>="{since_string}"'
  else:
    and_time = ''
  files = (
      drive_api.files()
      .list(q=f"'{file_id}' in parents{and_time}")
      .execute()
      .get('files', [])
  )
  return files


def load_files_into_dataframes(
    last_report_table: pd.DataFrame,
    drive_api,
    drive_files: List[Dict[str, str]],
) -> Tuple[pd.DataFrame, Dict[str, pd.DataFrame]]:
  """Loads data into a pandas dataframe from the given list of drive files.

  Downloads the files and loads them into pandas.

  Args:
    last_report_table: The dataframe that has a list of last updated reports
    drive_api: The API for drive calls
    drive_files: A list of drive files from drive.files().list()

  Returns:
    A tuple, the first one being the last_report_table, and the second being
    a dict with the key the name of the rule and the value a DataFrame with
    rule results to upload to BigQuery.
  """
  new_report_table = last_report_table.set_index('Sheet_ID')
  dataframes: Dict[str, List[pd.DataFrame]] = collections.defaultdict(list)
  for file_obj in drive_files:
    try:
      report_name = ReportName.with_filename(file_obj['name'])
    except ValueError as e:
      print(
          f"File '{file_obj['name']}' name is invalid. Skipping.",
          file=sys.stderr,
      )
      continue
    new_report_table.loc[report_name.sheet_id] = [
        report_name.label,
        report_name.date,
    ]

    request = drive_api.files().get_media(fileId=file_obj['id'])
    df = load_data_into_pandas(request)
    dataframes[report_name.rule].append(
        fill_dataframe(df, report_name=report_name)
    )

  return new_report_table, {k: pd.concat(v) for k, v in dataframes.items()}
