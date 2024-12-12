/**
 * @license
 * Copyright 2024 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const spreadsheetId = '1XgOZjlH7DA55x8hY3Xlo3_a7eqNSLZ9Irs3PtOkcBfY'; // Replace with your sheet's ID

const fetchOnlyActiveCampaignsCell = 'B7';

const languageConfigSheetName = 'Language config';
const geoTargetingConfigSheetName = 'Geo Targeting config';
const budgetConfigSheetName = 'Budget config';
const setupSheetName = 'Setup';
const vanityUrlSheetName = 'Vanity URLs';

const languageConfig = {};
const geoTargetingConfig = {};
const budgetConfig = {};
const vanityUrlConfig = {};

const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
const setupSheet = spreadsheet.getSheetByName(setupSheetName);
const fetchOnlyActiveCampaigns = setupSheet
  .getRange(fetchOnlyActiveCampaignsCell)
  .getValue();

var languageConfigSheet = null;
var geoTargetingConfigSheet = null;
var budgetConfigSheet = null;
var vanityUrlSheet = null;

const sheetToConfigMap = {
  [languageConfigSheetName]: languageConfig,
  [geoTargetingConfigSheetName]: geoTargetingConfig,
  [budgetConfigSheetName]: budgetConfig,
  [vanityUrlSheetName]: vanityUrlConfig,
};

function main() {
  // Start checking this account
  loadExistingConfigs();
  setUpConfigSheets();
  syncCampaigns(getCurrentAccount());
}

function getValuesIfExist(spreadsheetName, config) {
  const CAMPAIGN_ID_COL = 2;
  const CUSTOM_COLUMN_START = 4;
  const sheet = spreadsheet.getSheetByName(spreadsheetName);
  if (!sheet) {
    return;
  }
  const values = sheet.getDataRange().getValues();
  for (const row of values) {
    config[row[CAMPAIGN_ID_COL]] = row.slice(CUSTOM_COLUMN_START) || [];
  }
}

function loadExistingConfigs() {
  Object.entries(sheetToConfigMap).map(([sheetName, config]) => {
    getValuesIfExist(sheetName, config);
  });
}

function syncCampaigns(account) {
  const accountInfoStr =
    '{' + account.getName() + ' - ' + account.getCustomerId() + '}';

  console.log('Syncing account ' + accountInfoStr + '...');
  if (isMCCAccount()) {
    console.log('Account ' + accountInfoStr + ' is MCC');
    syncCampaignsForSingleAccount(account);
    console.log('Syncing account ' + accountInfoStr + ' sub-accounts...');

    const accounts = AdsManagerApp.accounts().get();

    while (accounts.hasNext()) {
      var nextAccount = accounts.next();
      syncCampaignsForSingleAccount(nextAccount);
    }
  } else {
    console.log('Account ' + accountInfoStr + ' is not MCC');
    syncCampaignsForSingleAccount(account);
  }
}

function setUpConfigSheets() {
  languageConfigSheet = createAndStyleConfigSheet(
    languageConfigSheetName,
    'Complete desired languages for each campaigns. If no preference for a single campaign, leave blank (empty)',
    [
      'Customer ID',
      'Customer name',
      'Campaign ID',
      'Campaign name',
      'Desired languages',
    ],
  );
  geoTargetingConfigSheet = createAndStyleConfigSheet(
    geoTargetingConfigSheetName,
    'Complete desired included and excluded locations for each campaigns. If no preference for a single campaign, leave blank (empty)',
    [
      'Customer ID',
      'Customer name',
      'Campaign ID',
      'Campaign name',
      'Desired included locations',
      'Desired excluded locations',
    ],
  );
  budgetConfigSheet = createAndStyleConfigSheet(
    budgetConfigSheetName,
    'Complete desired max daily or total budgets (not both). If no preference for a single campaign, leave blank (empty)',
    [
      'Customer ID',
      'Customer name',
      'Campaign ID',
      'Campaign name',
      'Max daily budget',
      'Max total budget',
    ],
  );
  vanityUrlSheet = createAndStyleConfigSheet(
    vanityUrlSheetName,
    'Check if vanity URL is set',
    [
      'Customer ID',
      'Customer name',
      'Campaign ID',
      'Campaign name',
      'Expect vanity URL',
    ],
  );
}

function createAndStyleConfigSheet(sheetName, headerText, headerRow) {
  const sheet = createOrClearSheet(sheetName);

  // Header Styling
  styleHeader(sheet, headerText, headerRow.length);

  // Column Widths (Adjust as needed)
  sheet.setColumnWidths(1, 1, 120);
  sheet.setColumnWidths(2, 1, 300);
  sheet.setColumnWidths(3, 1, 120);
  sheet.setColumnWidths(
    4,
    headerRow.length > 4 ? headerRow.length - 4 : 1,
    300,
  ); // Dynamic width adjustment for longer header rows
  if (headerRow.length > 5) {
    sheet.setColumnWidths(5, headerRow.length - 5, 120); // handles extra columns if needed
  }

  // Append Header Row
  sheet.appendRow(headerRow);
  sheet.insertRowBefore(2);

  // Apply border styling
  styleBorder(sheet, headerRow.length);

  return sheet;
}

function styleHeader(sheet, text, lastColumnNumber) {
  const range = sheet.getRange(
    'A1:' + String.fromCharCode(64 + lastColumnNumber) + '1',
  );
  range.merge();

  const richText = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setTextStyle(SpreadsheetApp.newTextStyle().setBold(true).build())
    .build();

  range.setBackground('#ea4335');
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');
  range.setFontSize(12);
  range.setFontColor('#FFFFFF');
  range.setBorder(
    true,
    true,
    true,
    true,
    null,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID_THICK,
  );
  range.setRichTextValue(richText);
  sheet.insertRows(2);
}

function styleBorder(sheet, lastColumn) {
  // add last column length as param
  let range = sheet.getRange(
    'A3:' + String.fromCharCode(64 + lastColumn) + '3',
  );
  range.setBorder(
    null,
    null,
    true,
    null,
    null,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID,
  );
  range = sheet.getRange('A3:' + String.fromCharCode(64 + lastColumn) + '999');
  range.setBorder(
    null,
    null,
    null,
    null,
    true,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID,
  );
}

function createOrClearSheet(name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function syncCampaignsForSingleAccount(account) {
  const accountInfoStr =
    '{' + account.getName() + ' - ' + account.getCustomerId() + '}';
  console.log('Syncing campaigns for account ' + accountInfoStr + '...');

  if (isMCCAccount()) {
    AdsManagerApp.select(account); // Switch context to the current account
  }

  if (fetchOnlyActiveCampaigns) {
    var campaignIterator = AdsApp.campaigns()
      .withCondition('Status = ENABLED')
      .withCondition("ServingStatus IN ['SERVING']")
      .get();
    var shoppingCampaignIterator = AdsApp.shoppingCampaigns()
      .withCondition('Status = ENABLED')
      .withCondition("ServingStatus IN ['SERVING']")
      .get();
    var videoCampaignIterator = AdsApp.videoCampaigns()
      .withCondition('Status = ENABLED')
      .withCondition("ServingStatus IN ['SERVING']")
      .get();
    var performanceMaxCampaignIterator = AdsApp.performanceMaxCampaigns()
      .withCondition('Status = ENABLED')
      .withCondition("ServingStatus IN ['SERVING']")
      .get();
  } else {
    var campaignIterator = AdsApp.campaigns().get();
    var shoppingCampaignIterator = AdsApp.shoppingCampaigns().get();
    var videoCampaignIterator = AdsApp.videoCampaigns().get();
    var performanceMaxCampaignIterator = AdsApp.performanceMaxCampaigns().get();
  }

  // Standard Campaigns (Search, Display, etc.)
  addCampaignsToConfigSheets(account, campaignIterator);

  // Shopping Campaigns
  addCampaignsToConfigSheets(account, shoppingCampaignIterator);

  // Video Campaigns
  addCampaignsToConfigSheets(account, videoCampaignIterator);

  // Performance Max Campaigns
  addCampaignsToConfigSheets(account, performanceMaxCampaignIterator);
}

function addCampaignsToConfigSheets(account, campaignsIterator) {
  while (campaignsIterator.hasNext()) {
    const campaign = campaignsIterator.next();

    console.log(
      'Found campaign ' + campaign.getId() + ' - ' + campaign.getName(),
    );

    languageConfigSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
      ...(languageConfig[campaign.getId()] || []),
    ]);

    geoTargetingConfigSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
      ...(geoTargetingConfig[campaign.getId()] || []),
    ]);

    budgetConfigSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
      ...(budgetConfig[campaign.getId()] || []),
    ]);
    vanityUrlSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
      ...(vanityUrlConfig[campaign.getId()] || []),
    ]);
  }
}

function isMCCAccount() {
  try {
    MccApp.accounts(); // Try to access MCC-specific functionality
    return true; // If no error, it's an MCC account
  } catch (e) {
    return false; // If error, it's a single account
  }
}

function getCurrentAccount() {
  try {
    // For MCC accounts:
    return AdsManagerApp.currentAccount();
  } catch (e) {
    // For single accounts:
    return AdWordsApp.currentAccount();
  }
}
