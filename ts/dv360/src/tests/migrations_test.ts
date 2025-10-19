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
import { expect } from 'chai';

describe('Migrations: upgrades', function () {
  beforeEach(function () {
    mockAppsScript();
    scaffoldSheetWithNamedRanges();
  });

  it('to v2.2.0', function () {
    PropertiesService.getScriptProperties().setProperty('sheet_version', '2.1');
    const frontend = getFrontend('2.2.0');
    frontend.migrate();
    const range = SpreadsheetApp.getActive().getRangeByName('EXPORT_SETTINGS');
    expect(range).to.exist;
    expect(range!.getValue()).to.equal('drive');
  });

  it('to v3.0', async function () {
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
    expect(header.findIndex((c) => c === 'Geo Targets')).to.eql(-1);
    expect(
      header.findIndex((c) => c === 'Allowed Geo Targets'),
    ).to.be.greaterThanOrEqual(0);
    expect(
      header.findIndex((c) => c === 'Excluded Geo Targets'),
    ).to.be.greaterThanOrEqual(0);
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
