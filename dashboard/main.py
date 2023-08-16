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
import io

from googleapiclient import http
import pandas as pd


def fill_dataframe(
    df: pd.DataFrame, date: str, sheet_id: str, label: str
) -> pd.DataFrame:
  """Given a dataframe, prefix each row with a date, sheet ID and label.

  Args:
    df: A pandas DataFrame
    date: An ISO8601 date
    sheet_id: A Google Sheet ID
    label: A label (might be blank) to distinguish from other reports

  Returns:
    A new pandas DataFrame with prefixed columns.
  """
  dfl = len(df)
  date = [pd.to_datetime(date, format='%Y-%m-%dT%H:%M:%S.%f%z')]
  df = df.join(
      pd.DataFrame.from_records({
          'Date': date * dfl,
          'Label': pd.Series([label] * dfl, dtype='string'),
          'Sheet_ID': pd.Series([sheet_id] * dfl, dtype='string'),
      })
  )
  df.columns = [_normalize(column) for column in df.columns]
  return df


def _normalize(string):
  return string.replace(' ', '_').replace('.', '')


def load_data_into_pandas(request: http.HttpRequest) -> pd.DataFrame:
  """Use an API request to load the response into pandas for a BQ upload.

  This function expects the response data from the request to be a CSV.

  Args:
    request: An HTTP request, i.e. the one used to download files from drive
      (drive.files().get_media())

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
