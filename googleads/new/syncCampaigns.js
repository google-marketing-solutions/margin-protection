const spreadsheetId = ''; // Replace with your sheet's ID

const fetchOnlyActiveCampaignsCell = 'B7';

const languageConfigSheetName = 'Language config'
const geoTargetingConfigSheetName = 'Geo Targeting config';
const budgetConfigSheetName = 'Budget config';
const setupSheetName = 'Setup';

const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
const setupSheet = spreadsheet.getSheetByName(setupSheetName);
const fetchOnlyActiveCampaigns = setupSheet
  .getRange(fetchOnlyActiveCampaignsCell)
  .getValue();

var languageConfigSheet = null;
var geoTargetingConfigSheet = null;
var budgetConfigSheet = null;

function main() {
  // Start checking this account
  setUpConfigSheets();
  syncCampaigns(getCurrentAccount());
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
  languageConfigSheet = createOrClearSheet(languageConfigSheetName);

  var range = languageConfigSheet.getRange('A1:E1');
  range.merge();
  var richText = SpreadsheetApp.newRichTextValue()
    .setText(
      'Complete desired languages for each campaigns. If no preference for a single campaign, leave blank (empty)',
    )
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
  languageConfigSheet.insertRows(2);
  languageConfigSheet.setColumnWidths(1, 1, 120);
  languageConfigSheet.setColumnWidths(2, 1, 300);
  languageConfigSheet.setColumnWidths(3, 1, 120);
  languageConfigSheet.setColumnWidths(4, 2, 300);

  languageConfigSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Desired languages'
  ]);
  languageConfigSheet.insertRowBefore(2);
  range = languageConfigSheet.getRange('A3:E3');
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
  range = languageConfigSheet.getRange('A3:E999');
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

  geoTargetingConfigSheet = createOrClearSheet(geoTargetingConfigSheetName);

  var range = geoTargetingConfigSheet.getRange('A1:F1');
  range.merge();
  var richText = SpreadsheetApp.newRichTextValue()
    .setText(
      'Complete desired included and excluded locations for each campaigns. If no preference for a single campaign, leave blank (empty)',
    )
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
  geoTargetingConfigSheet.insertRows(2);
  geoTargetingConfigSheet.setColumnWidths(1, 1, 120);
  geoTargetingConfigSheet.setColumnWidths(2, 1, 300);
  geoTargetingConfigSheet.setColumnWidths(3, 1, 120);
  geoTargetingConfigSheet.setColumnWidths(4, 3, 300);

  geoTargetingConfigSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Desired included locations',
    'Desired excluded locations',
    // "Max number of countries (blank = no limit)"
  ]);
  geoTargetingConfigSheet.insertRowBefore(2);
  range = geoTargetingConfigSheet.getRange('A3:F3');
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
  range = geoTargetingConfigSheet.getRange('A3:F999');
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

  budgetConfigSheet = createOrClearSheet(budgetConfigSheetName);

  range = budgetConfigSheet.getRange('A1:F1');
  range.merge();
  richText = SpreadsheetApp.newRichTextValue()
    .setText(
      'Complete desired max daily or total budgets (not both). If no preference for a single campaign, leave blank (empty)',
    )
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
  budgetConfigSheet.insertRows(2);
  budgetConfigSheet.setColumnWidths(1, 1, 120);
  budgetConfigSheet.setColumnWidths(2, 1, 300);
  budgetConfigSheet.setColumnWidths(3, 1, 120);
  budgetConfigSheet.setColumnWidths(4, 1, 300);
  budgetConfigSheet.setColumnWidths(5, 2, 120);

  budgetConfigSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Max daily budget',
    'Max total budget',
    // TODO: UNCOMMENT IF SOLVED
    // "% Allowed over average historical budget"
  ]);
  budgetConfigSheet.insertRowBefore(2);
  range = budgetConfigSheet.getRange('A3:F3');
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
  range = budgetConfigSheet.getRange('A3:F999');
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
    ]);

    geoTargetingConfigSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
    ]);

    budgetConfigSheet.appendRow([
      account.getCustomerId(),
      account.getName(),
      campaign.getId(),
      campaign.getName(),
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