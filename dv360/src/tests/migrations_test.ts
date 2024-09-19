import {
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { DisplayVideoFrontend, migrations } from '../frontend';
import { PropertyStore } from 'common/types';
import { Client, RuleRange } from '../client';
import { scaffoldSheetWithNamedRanges } from 'common/tests/helpers';
import { geoTargetRule } from '../rules';
import { ClientInterface } from '../types';
import {
  AssignedTargetingOption,
  Campaign,
  InsertionOrder,
} from 'dv360_api/dv360_resources';
import {
  PACING_PERIOD,
  PACING_TYPE,
  TARGETING_TYPE,
} from 'dv360_api/dv360_types';

describe('Migrations: upgrades', () => {
  beforeEach(() => {
    mockAppsScript();
    scaffoldSheetWithNamedRanges();
  });
  it('to v3.0', async () => {
    const sheet = SpreadsheetApp.getActive().insertSheet(
      'Rule Settings - Campaign',
    );
    PropertiesService.getScriptProperties().setProperty('sheet_version', '2.0');
    sheet
      .getRange(3, 1, 1, 4)
      .setValues([
        ['ID', 'Campaign Name', 'Geo Targets', 'Excluded Geo Targets'],
      ]);
    const frontend = getFrontend('3.0');

    frontend.migrate();

    const header: string[] = sheet.getRange(3, 1, 1, 4).getValues()[0];
    expect(header.findIndex((c) => c === 'Geo Targets')).toEqual(-1);
    expect(
      header.findIndex((c) => c === 'Allowed Geo Targets'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      header.findIndex((c) => c === 'Excluded Geo Targets'),
    ).toBeGreaterThanOrEqual(0);
  });
});

function getFrontend(
  version: string,
  properties: PropertyStore = new FakePropertyStore(),
  overrides: (client: ClientInterface) => ClientInterface = (client) => client,
) {
  return new DisplayVideoFrontend({
    ruleRangeClass: RuleRange,
    rules: [geoTargetRule],
    version,
    clientInitializer(clientArgs, properties) {
      const client = new Client(clientArgs, properties);
      return overrides(client);
    },
    migrations,
    properties,
  });
}
