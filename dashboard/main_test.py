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

"""Tests for main.py."""
import io
import textwrap
import types
import uuid

from googleapiclient import discovery
import pandas as pd
import pandas.testing
import pytest

from launch_monitor.dashboard import main

CREDENTIALS = uuid.uuid4()


@pytest.fixture(autouse=True)
def before(monkeypatch):
  def fake_discovery(service, version, credentials):
    return types.SimpleNamespace(
        service=service, version=version, credentials=credentials
    )

  with monkeypatch.context() as m:
    m.setattr(discovery, 'build', fake_discovery)
    yield


def test_fill_dataframe():
  date = pd.to_datetime(
      '2020-01-01T00:00:00.000Z', format='%Y-%m-%dT%H:%M:%S.%f%z'
  )
  columns = {
      'Date': [date] * 2,
      'Sheet_ID': pd.Series(['sheet_id'] * 2, dtype='string'),
      'Label': pd.Series(['label'] * 2, dtype='string'),
  }
  original = {'A': ['A1', 'A2'], 'B': ['B1', 'B2']}
  expected_result = pd.DataFrame.from_records({
      'Date': columns['Date'],
      'Sheet_ID': columns['Sheet_ID'],
      'Label': columns['Label'],
      'A': original['A'],
      'B': original['B'],
  })

  result = main.fill_dataframe(
      pd.DataFrame.from_records(original),
      label='label',
      sheet_id='sheet_id',
      date='2020-01-01T00:00:00.000Z',
  )

  pd.testing.assert_frame_equal(expected_result, result)


def test_load_data_into_pandas():
  fd = io.BytesIO()
  fd.seek(0)
  expected = pd.DataFrame(
      {'colA': ['A1', 'A2'], 'colB': ['B1', 'B2'], 'colC': ['C1', 'C2']},
      dtype='string',
  )

  actual = main.load_data_into_pandas(
      FakeRequest(
          fd,
          textwrap.dedent("""\
  colA,colB,colC
  A1,B1,C1
  A2,B2,C2""").encode('utf-8'),
      )
  )

  pandas.testing.assert_frame_equal(actual, expected)


class FakeRequest:
  """Wraps a CSV file handler to simulate an `http.HttpRequest` for testing."""

  def __init__(self, fd, csv: bytes):
    self._fd = fd
    self.csv = csv.strip()
    self.uri = 'localhost'
    self.headers = {}
    self.http = FakeHttp(self.csv)

  def next_chunk(self):
    self._fd.write(self.csv)
    return 200, True


class FakeResponse(dict):

  def __init__(self):
    self.status = 200
    super().__init__()


class FakeHttp:

  def __init__(self, csv: bytes):
    self.csv = csv
    self.response = FakeResponse()

  def request(self, *unused_args, **unused_kwargs):
    return self.response, self.csv
