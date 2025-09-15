/**
 * @fileoverview This Google Ads script audits campaign settings for language,
 * geo-targeting, and budget against a configuration defined in a Google Sheet.
 * It can operate on a single account or across an MCC. The script can report
 * discrepancies to the spreadsheet, send email alerts, optionally pause
 * misconfigured campaigns, and back up results to CSV files in Google Drive.
 */

const spreadsheetId = ''; // Replace with your sheet's ID

const languageConfigSheetName = 'Language config';
const geoTargetingConfigSheetName = 'Geo Targeting config';
const budgetConfigSheetName = 'Budget config';

const languageResultSheetName = 'Language results';
const geoTargetingResultSheetName = 'Geo Targeting results';
const budgetResultSheetName = 'Budget results';
const setupSheetName = 'Setup';

const outputModeCell = 'B3';
const emailCell = 'B4';
const folderIdCell = 'B5';
const pauseCampaignsCell = 'B6';
const fetchOnlyActiveCampaignsCell = 'B7';

const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
const setupSheet = spreadsheet.getSheetByName(setupSheetName);
const languageConfigSheet = spreadsheet.getSheetByName(languageConfigSheetName);
const geoTargetingConfigSheet = spreadsheet.getSheetByName(
  geoTargetingConfigSheetName,
);
const budgetConfigSheet = spreadsheet.getSheetByName(budgetConfigSheetName);

const mode = setupSheet.getRange(outputModeCell).getValue();
const emailAddresses = setupSheet.getRange(emailCell).getValue();
const folderId = setupSheet.getRange(folderIdCell).getValue();
const pauseCampaigns = setupSheet.getRange(pauseCampaignsCell).getValue();
const fetchOnlyActiveCampaigns = setupSheet
  .getRange(fetchOnlyActiveCampaignsCell)
  .getValue();

const languageResult = [];
const geoTargetingResult = [];
const budgetResult = [];

var languageMisconfigured = [];
var geoTargetingMisconfigured = [];
var budgetMisconfigured = [];

var campaignsWerePaused = false;

/**
 * The main function to be executed.
 * It orchestrates the entire process of checking inputs, auditing accounts,
 * writing results, pausing campaigns, and sending notifications.
 */
function main() {
  checkInput();
  checkAccount(getCurrentAccount());
  writeToResultSheet();
  languageMisconfigured = languageResult.filter((r) => r.misconfigured);
  geoTargetingMisconfigured = geoTargetingResult.filter((r) => r.misconfigured);
  budgetMisconfigured = budgetResult.filter((r) => r.misconfigured);

  if (pauseCampaigns) {
    pauseMisconfiguredCampaigns();
  }

  if (emailAddresses) {
    sendEmail();
  }

  if (mode === 'CSV Back-Up' && folderId) {
    generateCsvBackup();
  }
}

/**
 * Validates the script's input settings from the 'Setup' sheet.
 * Throws an error if the email list is invalid or if the mode/folder ID
 * configuration is incorrect.
 */
function checkInput() {
  if (!isValidEmailList(emailAddresses)) {
    throw new Error(
      'Invalid mailing list, must be empty or a comma-separated list of email addresses',
    );
  }

  if (mode !== 'Spreadsheet Only' && mode !== 'CSV Back-Up') {
    throw new Error(
      'Invalid mode, must be "Spreadsheet Only" or "CSV Back-Up"',
    );
  }

  if (!folderId && mode === 'CSV Back-Up') {
    throw new Error(
      'Invalid Google Drive Folder ID, must be present if mode selected is "CSV Back-Up"',
    );
  }
}

/**
 * Validates a comma-separated string of email addresses.
 *
 * @param {string} emailList The string of email addresses to validate.
 * @return {boolean} True if the list is valid or empty, false otherwise.
 */
function isValidEmailList(emailList) {
  if (emailList === '') return true;

  // 1. Split the String into Individual Email Addresses
  const emailAddresses = emailList.split(',').map((email) => email.trim()); // Remove any extra whitespace

  // 2. Check Each Email Address Against a Regular Expression
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email validation regex

  for (const email of emailAddresses) {
    if (!emailRegex.test(email)) {
      return false; // Invalid email found
    }
  }

  // 3. All Emails Valid
  return true;
}

/**
 * Checks if a string contains only digits.
 *
 * @param {string} str The string to check.
 * @return {boolean} True if the string contains only digits, false otherwise.
 */
function isOnlyDigits(str) {
  return /^\d+$/.test(str);
}

/**
 * Creates a new sheet with the given name or clears it if it already exists.
 *
 * @param {string} name The name of the sheet.
 * @return {!Sheet} The created or cleared sheet object.
 */
function createOrClearSheet(name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

/**
 * Checks all campaigns in a given account or iterates through sub-accounts if
 * it's an MCC account.
 *
 * @param {!Object} account The Google Ads account object.
 */
function checkAccount(account) {
  const accountInfoStr =
    '{' + account.getName() + ' - ' + account.getCustomerId() + '}';

  console.log('Checking account ' + accountInfoStr + '...');
  if (isMCCAccount()) {
    console.log('Account ' + accountInfoStr + ' is MCC');
    checkCampaigns(account);
    console.log('Checking account ' + accountInfoStr + ' sub-accounts...');

    var accounts = AdsManagerApp.accounts().get();

    while (accounts.hasNext()) {
      var nextAccount = accounts.next();
      checkCampaigns(nextAccount);
    }
  } else {
    console.log('Account ' + account.getName() + ' is not MCC');
    checkCampaigns(account);
  }
}

/**
 * Iterates through all campaign types (standard, shopping, video, PMax) in a
 * given account and checks their settings.
 *
 * @param {!Object} account The Google Ads account object.
 */
function checkCampaigns(account) {
  const accountInfoStr =
    '{' + account.getName() + ' - ' + account.getCustomerId() + '}';

  console.log('Checking campaigns for account ' + accountInfoStr + '...');

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
  checkCampaignIterator(account, campaignIterator);

  // Shopping Campaigns
  checkCampaignIterator(account, shoppingCampaignIterator);

  // Video Campaigns
  checkCampaignIterator(account, videoCampaignIterator);

  // Performance Max Campaigns
  checkCampaignIterator(account, performanceMaxCampaignIterator);
}

/**
 * Iterates through a campaign iterator and checks each campaign's settings.
 *
 * @param {!Object} account The Google Ads account object.
 * @param {!Iterator} campaignIterator A Google Ads campaign iterator.
 */
function checkCampaignIterator(account, campaignIterator) {
  while (campaignIterator.hasNext()) {
    const campaign = campaignIterator.next();

    checkSingleCampaignLanguage(account, campaign);
    checkSingleCampaignGeoTarget(account, campaign);
    checkSingleCampaignBudget(account, campaign);
  }
}

/**
 * Checks the language targeting of a single campaign against the desired
 * configuration in the spreadsheet.
 *
 * @param {!Object} account The Google Ads account object.
 * @param {!Campaign} campaign The campaign to check.
 */
function checkSingleCampaignLanguage(account, campaign) {
  const accountId = account.getCustomerId();
  const accountName = account.getName();
  const campaignId = campaign.getId();
  const campaignName = campaign.getName();

  const actualLanguagesNames = [];

  const actualLanguages = campaign.targeting().languages().get();
  while (actualLanguages.hasNext()) {
    var target = actualLanguages.next();
    actualLanguagesNames.push(target.getName());
  }

  const range = languageConfigSheet.getDataRange();
  const values = range.getValues();

  var desiredLanguagesStr = '';

  for (var i = 0; i < values.length; i++) {
    if (values[i][2] == campaignId) {
      // Account ID is in column A and Campaign ID is in column C
      desiredLanguagesStr = values[i][4]; // Desired Languages is in column E

      break;
    }
  }

  var desiredLanguagesNames = desiredLanguagesStr.split(',');

  desiredLanguagesNames = desiredLanguagesNames
    .map((obj) => obj.trim())
    .filter((obj) => obj !== '' && obj !== '-');

  if (desiredLanguagesNames.length === 0) {
    languageResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredLanguagesNames,
      actualLanguagesNames,
      misconfigured: false,
    });
    console.log('Ok - No desired config');
    return;
  }

  // Compare and log discrepancies (if any)
  if (!arraysHaveSameElements(desiredLanguagesNames, actualLanguagesNames)) {
    languageResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredLanguagesNames,
      actualLanguagesNames,
      misconfigured: true,
    });
    console.log('Misconfigured');
  } else {
    languageResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredLanguagesNames,
      actualLanguagesNames,
      misconfigured: false,
    });
    console.log('Ok');
  }
}

/**
 * Checks the geo-targeting of a single campaign against the desired
 * configuration in the spreadsheet.
 *
 * @param {!Object} account The Google Ads account object.
 * @param {!Campaign} campaign The campaign to check.
 */
function checkSingleCampaignGeoTarget(account, campaign) {
  console.log(
    'Checking campaign ' +
      campaign.getId() +
      ' - ' +
      campaign.getName() +
      '...',
  );

  const y = getCampaignDesiredLocations(campaign);
  const desiredIncludedGeoTargetsNames = y.desiredIncludedGeotargetsNames;
  const desiredExcludedGeoTargetsNames = y.desiredExcludedGeotargetsNames;

  const x = getCampaignActualLocations(campaign);
  const actualIncludedGeoTargetsNames = x.actualIncludedGeoTargetsNames;
  const actualIncludedGeoTargetsTypes = x.actualIncludedGeoTargetsTypes;
  const actualExcludedGeoTargetsNames = x.actualExcludedGeoTargetsNames;
  const actualExcludedGeoTargetsTypes = x.actualExcludedGeoTargetsTypes;

  const accountId = account.getCustomerId();
  const accountName = account.getName();
  const campaignId = campaign.getId();
  const campaignName = campaign.getName();

  if (
    desiredIncludedGeoTargetsNames.length === 0 &&
    desiredExcludedGeoTargetsNames.length === 0
  ) {
    geoTargetingResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredIncludedGeoTargetsNames,
      actualIncludedGeoTargetsNames,
      actualIncludedGeoTargetsTypes,
      desiredExcludedGeoTargetsNames,
      actualExcludedGeoTargetsNames,
      actualExcludedGeoTargetsTypes,
      misconfigured: false,
    });
    console.log('Ok - No desired config');
    return;
  }

  // Compare and log discrepancies (if any)
  if (
    !arraysHaveSameElements(
      desiredIncludedGeoTargetsNames,
      actualIncludedGeoTargetsNames,
    ) ||
    !arraysHaveSameElements(
      desiredExcludedGeoTargetsNames,
      actualExcludedGeoTargetsNames,
    )
  ) {
    geoTargetingResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredIncludedGeoTargetsNames,
      actualIncludedGeoTargetsNames,
      actualIncludedGeoTargetsTypes,
      desiredExcludedGeoTargetsNames,
      actualExcludedGeoTargetsNames,
      actualExcludedGeoTargetsTypes,
      misconfigured: true,
    });
    console.log('Misconfigured');
  } else {
    geoTargetingResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      desiredIncludedGeoTargetsNames,
      actualIncludedGeoTargetsNames,
      actualIncludedGeoTargetsTypes,
      desiredExcludedGeoTargetsNames,
      actualExcludedGeoTargetsNames,
      actualExcludedGeoTargetsTypes,
      misconfigured: false,
    });
    console.log('Ok');
  }
}

/**
 * Retrieves the desired included and excluded locations for a campaign from the
 * 'Geo Targeting config' sheet.
 *
 * @param {!Campaign} campaign The campaign object.
 * @return {{
 *   desiredIncludedGeotargetsNames: !Array<string>,
 *   desiredExcludedGeotargetsNames: !Array<string>
 * }} An object containing arrays of desired location names.
 */
function getCampaignDesiredLocations(campaign) {
  // Find the campaign in the spreadsheet
  const range = geoTargetingConfigSheet.getDataRange();
  const values = range.getValues();

  const campaignId = campaign.getId();
  const campaignName = campaign.getName();

  var desiredIncludedGeotargetsStr = '';
  var desiredExcludedGeotargetsStr = '';

  for (var i = 0; i < values.length; i++) {
    if (values[i][2] == campaignId) {
      // Account ID is in column A and Campaign ID is in column C
      desiredIncludedGeotargetsStr = values[i][4]; // Desired Included Geo Targeting is in column E
      desiredExcludedGeotargetsStr = values[i][5]; // Desired Excluded Geo Targeting is in column F

      break;
    }
  }

  var desiredIncludedGeotargetsNames = desiredIncludedGeotargetsStr.split(',');
  var desiredExcludedGeotargetsNames = desiredExcludedGeotargetsStr.split(',');

  desiredIncludedGeotargetsNames = desiredIncludedGeotargetsNames
    .map((obj) => obj.trim())
    .filter((obj) => obj !== '' && obj !== '-');

  desiredExcludedGeotargetsNames = desiredExcludedGeotargetsNames
    .map((obj) => obj.trim())
    .filter((obj) => obj !== '' && obj !== '-');

  return {
    desiredIncludedGeotargetsNames,
    desiredExcludedGeotargetsNames,
  };
}

/**
 * Retrieves the actual targeted and excluded locations for a campaign from the
 * Google Ads API.
 *
 * @param {!Campaign} campaign The campaign object.
 * @return {{
 *   actualIncludedGeoTargetsNames: !Array<string>,
 *   actualIncludedGeoTargetsTypes: !Array<string>,
 *   actualExcludedGeoTargetsNames: !Array<string>,
 *   actualExcludedGeoTargetsTypes: !Array<string>
 * }} An object containing arrays of actual location names and types.
 */
function getCampaignActualLocations(campaign) {
  const actualIncludedGeoTargetsNames = [];
  const actualExcludedGeoTargetsNames = [];
  const actualIncludedGeoTargetsTypes = [];
  const actualExcludedGeoTargetsTypes = [];

  const actualIncludedGeoTargets = campaign
    .targeting()
    .targetedLocations()
    .get();
  while (actualIncludedGeoTargets.hasNext()) {
    var target = actualIncludedGeoTargets.next();
    actualIncludedGeoTargetsNames.push(target.getName());
    actualIncludedGeoTargetsTypes.push(target.getTargetType());
  }

  const actualExcludedGeoTargets = campaign
    .targeting()
    .excludedLocations()
    .get();
  while (actualExcludedGeoTargets.hasNext()) {
    var target = actualExcludedGeoTargets.next();
    actualExcludedGeoTargetsNames.push(target.getName());
    actualExcludedGeoTargetsTypes.push(target.getTargetType());
  }

  return {
    actualIncludedGeoTargetsNames,
    actualIncludedGeoTargetsTypes,
    actualExcludedGeoTargetsNames,
    actualExcludedGeoTargetsTypes,
  };
}

/**
 * Checks the budget of a single campaign against the desired configuration in
 * the spreadsheet.
 *
 * @param {!Object} account The Google Ads account object.
 * @param {!Campaign} campaign The campaign to check.
 */
function checkSingleCampaignBudget(account, campaign) {
  const desired = getCampaignDesiredBudget(campaign);
  const maxDailyBudget = desired.maxDailyBudget;
  const maxTotalBudget = desired.maxTotalBudget;
  const maxPercentageOverAverageHistoricalBudget =
    desired.maxPercentageOverAverageHistoricalBudget;
  const actual = getCampaignActualBudget(campaign);
  const actualDailyBudget = actual.actualDailyBudget;
  const actualTotalBudget = actual.actualTotalBudget;
  const actualPercentageOverAverageHistoricalBudget =
    actual.actualPercentageOverAverageHistoricalBudget;

  const accountId = account.getCustomerId();
  const accountName = account.getName();
  const campaignId = campaign.getId();
  const campaignName = campaign.getName();

  if (
    (maxDailyBudget === null && maxTotalBudget === null) ||
    (maxDailyBudget === '' && maxTotalBudget === '')
  ) {
    budgetResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      maxDailyBudget,
      actualDailyBudget,
      maxTotalBudget,
      actualTotalBudget,
      maxPercentageOverAverageHistoricalBudget,
      actualPercentageOverAverageHistoricalBudget,
      misconfigured: false,
    });
    console.log('Ok - No desired config');
    return;
  }

  if (
    (actualDailyBudget > maxDailyBudget && actualDailyBudget != -1) ||
    (actualTotalBudget > maxTotalBudget && actualTotalBudget != -1)
  ) {
    budgetResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      maxDailyBudget,
      actualDailyBudget,
      maxTotalBudget,
      actualTotalBudget,
      maxPercentageOverAverageHistoricalBudget,
      actualPercentageOverAverageHistoricalBudget,
      misconfigured: true,
    });
    console.log('Misconfigured');
  } else {
    budgetResult.push({
      accountId,
      accountName,
      campaignId,
      campaignName,
      maxDailyBudget,
      actualDailyBudget,
      maxTotalBudget,
      actualTotalBudget,
      maxPercentageOverAverageHistoricalBudget,
      actualPercentageOverAverageHistoricalBudget,
      misconfigured: false,
    });
    console.log('Ok');
  }
}

/**
 * Retrieves the desired budget settings for a campaign from the 'Budget
 * config' sheet.
 *
 * @param {!Campaign} campaign The campaign object.
 * @return {{
 *   maxDailyBudget: ?number,
 *   maxTotalBudget: ?number,
 *   maxPercentageOverAverageHistoricalBudget: ?number
 * }} An object containing the desired budget values.
 */
function getCampaignDesiredBudget(campaign) {
  const range = budgetConfigSheet.getDataRange();
  const values = range.getValues();

  const campaignId = campaign.getId();

  for (var i = 0; i < values.length; i++) {
    if (values[i][2] == campaignId) {
      // Campaign ID is in column C
      return {
        maxDailyBudget: convertStringToFloat(values[i][4]),
        maxTotalBudget: convertStringToFloat(values[i][5]),
        maxPercentageOverAverageHistoricalBudget: convertStringToFloat(
          values[i][6],
        ),
      };
    }
  }
}

/**
 * Converts a string value to a float, handling comma decimal separators.
 *
 * @param {*} value The value to convert.
 * @return {*} The converted float, or the original value if conversion fails.
 */
function convertStringToFloat(value) {
  if (typeof value === 'string') {
    // Replace commas with periods for decimal notation
    value = value.replace(',', '.');

    // Check if the string is a valid floating-point number
    const floatValue = parseFloat(value);
    if (!isNaN(floatValue)) {
      return floatValue;
    }
  }

  // If not a string or not a valid float, return the original value
  return value;
}

/**
 * Retrieves the actual budget settings for a campaign from the Google Ads API.
 *
 * @param {!Campaign} campaign The campaign object.
 * @return {{
 *   actualDailyBudget: number,
 *   actualTotalBudget: ?number,
 *   actualPercentageOverAverageHistoricalBudget: number
 * }} An object containing the actual budget values.
 */
function getCampaignActualBudget(campaign) {
  var budget = campaign.getBudget();

  if (budget) {
    return {
      actualDailyBudget: budget.getAmount(),
      actualTotalBudget: budget.getTotalAmount(),
      // TODO: FIX
      actualPercentageOverAverageHistoricalBudget: 0,
    };
  } else {
    return {
      actualDailyBudget: -1,
      actualTotalBudget: -1,
    };
  }
}

/**
 * Writes the results of the language, geo-targeting, and budget checks to
 * their respective sheets in the spreadsheet and applies formatting.
 */
function writeToResultSheet() {
  console.log('Writing results to sheets...');

  const languageResultSheet = createOrClearSheet(languageResultSheetName);
  languageResultSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Desired languages',
    'Current languages',
    'MISCONFIGURED',
  ]);
  languageResult.forEach((r) => {
    languageResultSheet.appendRow([
      r.accountId,
      r.accountName,
      r.campaignId,
      r.campaignName,
      r.desiredLanguagesNames.length !== 0
        ? r.desiredLanguagesNames.join(', ')
        : '-',
      r.actualLanguagesNames.length !== 0
        ? r.actualLanguagesNames.join(', ')
        : '-',
      r.misconfigured,
    ]);
  });

  range = languageResultSheet.getRange('A1:G1');

  range.setBackground('#D9D9D9');
  range.setBorder(
    null,
    null,
    true,
    null,
    null,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID_THICK,
  );

  range = languageResultSheet.getRange('A2:G999');
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

  languageResultSheet.setColumnWidths(1, 1, 120);
  languageResultSheet.setColumnWidths(2, 1, 300);
  languageResultSheet.setColumnWidths(3, 1, 120);
  languageResultSheet.setColumnWidths(4, 3, 300);
  languageResultSheet.setColumnWidths(7, 1, 120);

  const geoTargetingResultSheet = createOrClearSheet(
    geoTargetingResultSheetName,
  );
  geoTargetingResultSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Desired included locations',
    'Current included locations',
    // "Current included location types",
    'Desired excluded locations',
    'Current excluded locations',
    // "Current excluded location types",
    'MISCONFIGURED',
  ]);
  geoTargetingResult.forEach((r) => {
    geoTargetingResultSheet.appendRow([
      r.accountId,
      r.accountName,
      r.campaignId,
      r.campaignName,
      r.desiredIncludedGeoTargetsNames.length !== 0
        ? r.desiredIncludedGeoTargetsNames.join(', ')
        : '-',
      r.actualIncludedGeoTargetsNames.length !== 0
        ? r.actualIncludedGeoTargetsNames.join(', ')
        : '-',
      // r.actualIncludedGeoTargetsTypes.length !== 0 ? r.actualIncludedGeoTargetsTypes.join(', ') : '-',
      r.desiredExcludedGeoTargetsNames.length !== 0
        ? r.desiredExcludedGeoTargetsNames.join(', ')
        : '-',
      r.actualExcludedGeoTargetsNames.length !== 0
        ? r.actualExcludedGeoTargetsNames.join(', ')
        : '-',
      // r.actualExcludedGeoTargetsTypes.length !== 0 ? r.actualExcludedGeoTargetsTypes.join(', ') : '-',
      r.misconfigured,
    ]);
  });

  range = geoTargetingResultSheet.getRange('A1:I1');

  range.setBackground('#D9D9D9');
  range.setBorder(
    null,
    null,
    true,
    null,
    null,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID_THICK,
  );

  range = geoTargetingResultSheet.getRange('A2:I999');
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

  geoTargetingResultSheet.setColumnWidths(1, 1, 120);
  geoTargetingResultSheet.setColumnWidths(2, 1, 300);
  geoTargetingResultSheet.setColumnWidths(3, 1, 120);
  geoTargetingResultSheet.setColumnWidths(4, 5, 300);
  geoTargetingResultSheet.setColumnWidths(9, 1, 120);

  const budgetResultSheet = createOrClearSheet(budgetResultSheetName);
  budgetResultSheet.appendRow([
    'Customer ID',
    'Customer name',
    'Campaign ID',
    'Campaign name',
    'Desired max daily budget',
    'Current daily budget',
    'Desired max total budget',
    'Current total budget',
    // TODO: UNCOMMENT IF SOLVED
    // "Desired percentage over average historical budget",
    // "Current percentage over average historical budget",
    'MISCONFIGURED',
  ]);

  budgetResult.forEach((r) => {
    budgetResultSheet.appendRow([
      r.accountId,
      r.accountName,
      r.campaignId,
      r.campaignName,
      r.maxDailyBudget && r.maxDailyBudget !== 0 ? r.maxDailyBudget : '-',
      r.actualDailyBudget && r.actualDailyBudget !== 0
        ? r.actualDailyBudget
        : '-',
      r.maxTotalBudget && r.maxTotalBudget !== 0 ? r.maxTotalBudget : '-',
      r.actualTotalBudget && r.actualTotalBudget !== 0
        ? r.actualTotalBudget
        : '-',
      // TODO: UNCOMMENT IF SOLVED
      // r.maxPercentageOverAverageHistoricalBudget && r.maxPercentageOverAverageHistoricalBudget !== 0 ? r.maxPercentageOverAverageHistoricalBudget : '-',
      // r.actualPercentageOverAverageHistoricalBudget && r.actualPercentageOverAverageHistoricalBudget !== 0 ? r.actualPercentageOverAverageHistoricalBudget : '-',
      r.misconfigured,
    ]);
  });

  range = budgetResultSheet.getRange('A1:I1');

  range.setBackground('#D9D9D9');
  range.setBorder(
    null,
    null,
    true,
    null,
    null,
    null,
    '#000000',
    SpreadsheetApp.BorderStyle.SOLID_THICK,
  );

  range = budgetResultSheet.getRange('A2:I999');
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

  budgetResultSheet.setColumnWidths(1, 1, 120);
  budgetResultSheet.setColumnWidths(2, 1, 300);
  budgetResultSheet.setColumnWidths(3, 1, 120);
  budgetResultSheet.setColumnWidths(4, 1, 300);
  budgetResultSheet.setColumnWidths(5, 4, 140);
  budgetResultSheet.setColumnWidths(9, 1, 120);
}

/**
 * Sends an email notification if there are any misconfigured campaigns for geo
 * targeting or budget.
 */
function sendEmail() {
  if (geoTargetingMisconfigured.length > 0 || budgetMisconfigured.length > 0) {
    console.log('Sending email...');
    const subject = '[Warning] Google Ads campaigns misconfiguration';
    const body = createEmailBody();

    MailApp.sendEmail({
      to: emailAddresses,
      subject: subject,
      htmlBody: body,
    });
  }
}

/**
 * Creates the HTML body for the email notification.
 *
 * @return {string} The HTML string for the email body.
 */
function createEmailBody() {
  let body = `
  <!DOCTYPE html>
  <html>
  <body>
  `;
  if (geoTargetingMisconfigured.length > 0) {
    body += `
    <h2>Misconfigured geo targeting</h2>
    ${createEmailGeoTargetingBodyTable()}
    `;
  }
  if (budgetMisconfigured.length > 0) {
    body += `
    <h2>Misconfigured budget</h2>
    ${createEmailBudgetBodyTable()}
    `;
  }
  body += `
    ${
      campaignsWerePaused
        ? '<h2>Campaigns have been PAUSED.<h2>'
        : '<h2>Campaigns have NOT been PAUSED.<h2>'
    }
  </body>
  </html>
  `;

  return body;
}

/**
 * Creates an HTML table for the geo-targeting misconfigurations section of the
 * email body.
 *
 * @return {string} The HTML string for the geo-targeting results table.
 */
function createEmailGeoTargetingBodyTable() {
  let table = `
    <table border="1" cellpadding="5">
      <thead>
        <tr>
          <th>Customer ID</th>
          <th>Customer Name</th>
          <th>Campaign ID</th>
          <th>Campaign Name</th>
          <th>Desired Included Locations</th>
          <th>Current Included Locations</th>
          <th>Desired Excluded Locations</th>
          <th>Current Excluded Locations</th>
        </tr>
      </thead>
      <tbody>
  `;

  geoTargetingMisconfigured.forEach((c) => {
    table += `
        <tr>
          <td>${c.accountId}</td>
          <td>${c.accountName}</td>
          <td>${c.campaignId}</td>
          <td>${c.campaignName}</td>
          <td>${
            c.desiredIncludedGeoTargetsNames.length !== 0
              ? c.desiredIncludedGeoTargetsNames.join(', ')
              : '-'
          }</td>
          <td>${
            c.actualIncludedGeoTargetsNames.length !== 0
              ? c.actualIncludedGeoTargetsNames.join(', ')
              : '-'
          }</td>
          <td>${
            c.desiredExcludedGeoTargetsNames.length !== 0
              ? c.desiredExcludedGeoTargetsNames.join(', ')
              : '-'
          }</td>
          <td>${
            c.actualExcludedGeoTargetsNames.length !== 0
              ? c.actualExcludedGeoTargetsNames.join(', ')
              : '-'
          }</td>
        </tr>
    `;
  });

  table += `
      </tbody>
    </table>
  `;

  return table;
}

/**
 * Creates an HTML table for the budget misconfigurations section of the email
 * body.
 *
 * @return {string} The HTML string for the budget results table.
 */
function createEmailBudgetBodyTable() {
  let table = `
    <table border="1" cellpadding="5">
      <thead>
        <tr>
          <th>Customer ID</th>
          <th>Customer Name</th>
          <th>Campaign ID</th>
          <th>Campaign Name</th>
          <th>Desired Max Daily Budget</th>
          <th>Current Daily Budget</th>
          <th>Desired Max Total Budget</th>
          <th>Current Total Budget</th>
        </tr>
      </thead>
      <tbody>
  `;

  budgetMisconfigured.forEach((c) => {
    table += `
        <tr>
          <td>${c.accountId}</td>
          <td>${c.accountName}</td>
          <td>${c.campaignId}</td>
          <td>${c.campaignName}</td>
          <td>${c.maxDailyBudget ? c.maxDailyBudget : '-'}</td>
          <td>${c.actualDailyBudget ? c.actualDailyBudget : '-'}</td>
          <td>${c.maxTotalBudget ? c.maxTotalBudget : '-'}</td>
          <td>${c.actualTotalBudget ? c.actualTotalBudget : '-'}</td>
        </tr>
    `;
  });

  table += `
      </tbody>
    </table>
  `;

  return table;
}

/**
 * Pauses all campaigns that were identified as having misconfigured geo
 * targeting or budget settings.
 */
function pauseMisconfiguredCampaigns() {
  console.log('Pausing campaigns...');

  const campaignIdsToPause = [
    ...geoTargetingMisconfigured.map((c) => c.campaignId),
    ...budgetMisconfigured.map((c) => c.campaignId),
  ];

  const campaignSelector = AdsApp.campaigns().withIds(campaignIdsToPause);
  const campaignIterator = campaignSelector.get();
  if (!campaignIterator.hasNext()) {
    console.log('No campaigns found with the specified IDs.');
    return;
  }

  while (campaignIterator.hasNext()) {
    const campaign = campaignIterator.next();

    if (campaign.isEnabled()) {
      try {
        campaign.pause();
      } catch (error) {
        console.log(
          `Error pausing campaign "${campaign.getName()}" (ID: ${campaign.getId()}): ${error}`,
        );
      }
    }
  }

  campaignsWerePaused = true;
}

/**
 * Compares two arrays to see if they contain the same elements, regardless of
 * order.
 *
 * @param {!Array} arr1 The first array.
 * @param {!Array} arr2 The second array.
 * @return {boolean} True if the arrays have the same elements, false
 *     otherwise.
 */
function arraysHaveSameElements(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return set1.size === set2.size && [...set1].every((value) => set2.has(value));
}

/**
 * Checks if the current script is running in an MCC (Manager) account context.
 *
 * @return {boolean} True if it's an MCC account, false otherwise.
 */
function isMCCAccount() {
  try {
    MccApp.accounts(); // Try to access MCC-specific functionality
    return true; // If no error, it's an MCC account
  } catch (e) {
    return false; // If error, it's a single account
  }
}

/**
 * Gets the current account object, handling both single and MCC account
 * contexts.
 *
 * @return {!Object} The current Google Ads account object.
 */
function getCurrentAccount() {
  try {
    // For MCC accounts:
    return AdsManagerApp.currentAccount();
  } catch (e) {
    // For single accounts:
    return AdWordsApp.currentAccount();
  }
}

/**
 * Generates CSV files for the geo-targeting and budget results and saves them
 * to the specified Google Drive folder.
 */
function generateCsvBackup() {
  console.log('Generating csv...');

  // Create CSV and Save to Drive
  const now = new Date();
  const formattedDateTime = Utilities.formatDate(
    now,
    AdsApp.currentAccount().getTimeZone(),
    'yyyy-MM-dd_HH:mm',
  );
  const csvData = createCsvData();
  const folder = DriveApp.getFolderById(folderId);

  var csvFileName = `google_ads_geo_targeting_results_${formattedDateTime}.csv`;
  var blob = Utilities.newBlob(
    csvData.geoTargetingCsvData,
    'text/csv',
    csvFileName,
  );
  folder.createFile(blob);

  csvFileName = `google_ads_budget_results_${formattedDateTime}.csv`;
  blob = Utilities.newBlob(csvData.budgetCsvData, 'text/csv', csvFileName);
  folder.createFile(blob);
}

/**
 * Creates the CSV data strings for geo-targeting and budget results.
 *
 * @return {{
 *   geoTargetingCsvData: string,
 *   budgetCsvData: string
 * }} An object containing the CSV data as strings.
 */
function createCsvData() {
  let geoTargetingCsvData =
    'Customer ID,' +
    'Customer name,' +
    'Campaign ID,' +
    'Campaign name,' +
    'Desired included locations,' +
    'Current included locations,' +
    'Current included location types,' +
    'Desired excluded locations,';
  +'Current excluded locations,' +
    'Current excluded locations types,' +
    'MISCONFIGURED\n';

  geoTargetingResult.forEach((r) => {
    geoTargetingCsvData +=
      `${r.accountId},` +
      `"${r.accountName}",` +
      `${r.campaignId},` +
      `"${r.campaignName}",` +
      `"${r.desiredIncludedGeoTargetsNames.join(', ')}",` +
      `"${r.actualIncludedGeoTargetsNames.join(', ')}",` +
      `"${r.actualIncludedGeoTargetsTypes.join(', ')}",` +
      `"${r.desiredExcludedGeoTargetsNames.join(', ')}",` +
      `"${r.actualExcludedGeoTargetsNames.join(', ')}",` +
      `"${r.actualExcludedGeoTargetsTypes.join(', ')}",`;
    +`"${r.misconfigured}"\n`;
  });

  let budgetCsvData =
    'Customer ID,' +
    'Customer name,' +
    'Campaign ID,' +
    'Campaign name,' +
    'Desired max daily budget,' +
    'Current daily budget,' +
    'Desired max total budget,' +
    'Current total budget,' +
    // TODO: UNCOMMENT IF SOLVED
    // + "Desired percentage over average historical budget,"
    // + "Current percentage over average historical budget,"
    'MISCONFIGURED\n';

  budgetResult.forEach((r) => {
    budgetCsvData +=
      `${r.accountId},` +
      `"${r.accountName}",` +
      `${r.campaignId},` +
      `"${r.campaignName}",` +
      `"${r.maxDailyBudget}",`;
    +`"${r.actualDailyBudget}",`;
    +`"${r.maxTotalBudget}",`;
    +`"${r.actualTotalBudget}",`;
    // TODO: UNCOMMENT IF SOLVED
    // +  `"${r.maxPercentageOverAverageHistoricalBudget}",`;
    // +  `"${r.actualPercentageOverAverageHistoricalBudget}",`;
    +`"${r.misconfigured}"\n`;
  });

  return {
    geoTargetingCsvData,
    budgetCsvData,
  };
}
