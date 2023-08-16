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
import datetime
import io

from googleapiclient import http
import pandas as pd

_DATE_FORMAT = '%Y-%m-%dT%H:%M:%S.%f%z'


def fill_dataframe(
    df: pd.DataFrame, date: str, sheet_id: str, label: str
) -> pd.DataFrame:
  """Given a dataframe, prefix each row with a date, sheet ID and label.

  Args:
    df: A pandas DataFrame.
    date: An ISO8601 date.
    sheet_id: A Google Sheet ID.
    label: A label (might be blank) to distinguish from other reports.

  Returns:
    A new pandas DataFrame with prefixed columns.
  """
  dfl = len(df)
  date = [pd.to_datetime(date, format=_DATE_FORMAT)]
  df = pd.DataFrame({
      'Date': pd.Series(date * dfl, dtype='datetime64[ns, UTC]'),
      'Sheet_ID': pd.Series([sheet_id] * dfl, dtype='string'),
      'Label': pd.Series([label] * dfl, dtype='string'),
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
