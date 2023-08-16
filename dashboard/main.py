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
