const spreadsheetId = "1qmOv2aY0OPLFJRlpsxR8AyzzRUF70vfs73QHlvASndo"; // Replace with your sheet's ID

const geoTargetingConfigSheetName = "Geo Targeting config";
const budgetConfigSheetName = "Budget config";

const geoTargetingResultSheetName = "Geo Targeting results";
const budgetResultSheetName = "Budget results"
const setupSheetName = "Setup";

const outputModeCell = "B3";
const emailCell = "B4";
const folderIdCell = "B5";
const pauseCampaignsCell = "B6";
const fetchOnlyActiveCampaignsCell = "B7";

const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
const setupSheet = spreadsheet.getSheetByName(setupSheetName);
const geoTargetingConfigSheet = spreadsheet.getSheetByName(geoTargetingConfigSheetName);
const budgetConfigSheet = spreadsheet.getSheetByName(budgetConfigSheetName);

const mode = setupSheet.getRange(outputModeCell).getValue();
const emailAddresses = setupSheet.getRange(emailCell).getValue();
const folderId = setupSheet.getRange(folderIdCell).getValue();
const pauseCampaigns = setupSheet.getRange(pauseCampaignsCell).getValue();
const fetchOnlyActiveCampaigns = setupSheet.getRange(fetchOnlyActiveCampaignsCell).getValue();


const geoTargetingResult = [];
const budgetResult = [];

var geoTargetingMisconfigured = [];
var budgetMisconfigured = [];

var campaignsWerePaused = false;

function main() {
  checkInput()
  checkAccount(getCurrentAccount())
  writeToResultSheet()
  geoTargetingMisconfigured = geoTargetingResult.filter(r => r.misconfigured)
  budgetMisconfigured = budgetResult.filter(r => r.misconfigured)

  if (pauseCampaigns) {
    pauseMisconfiguredCampaigns()
  }

  if (emailAddresses) {
    sendEmail()
  }

  if (mode === "CSV Back-Up" && folderId) {
    generateCsvBackup()
  }
}

function checkInput() {
  if (!isValidEmailList(emailAddresses)) {
    throw new Error('Invalid mailing list, must be empty or a comma-separated list of email addresses');
  }

  if (mode !== 'Spreadsheet Only' && mode !== 'CSV Back-Up') {
    throw new Error('Invalid mode, must be "Spreadsheet Only" or "CSV Back-Up"');
  }

  if (!folderId && mode === 'CSV Back-Up') {
    throw new Error('Invalid Google Drive Folder ID, must be present if mode selected is "CSV Back-Up"');
  }
}

function isValidEmailList(emailList) {
  if (emailList === "")
    return true;

  // 1. Split the String into Individual Email Addresses
  const emailAddresses = emailList.split(',').map(email => email.trim()); // Remove any extra whitespace

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

function isOnlyDigits(str) {
  return /^\d+$/.test(str);
}

function createOrClearSheet(name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (sheet) {
      sheet.clearContents();
      }
    else {
      sheet = spreadsheet.insertSheet(name);
      }
    return sheet
}

function checkAccount(account) {
  const accountInfoStr = "{" + account.getName() + " - " + account.getCustomerId() + "}"

  console.log("Checking account " + accountInfoStr + "...")
  if (isMCCAccount()) {
    console.log("Account " + accountInfoStr + " is MCC")
    checkCampaigns(account)
    console.log("Checking account " + accountInfoStr + " sub-accounts...")

    var accounts = AdsManagerApp.accounts().get();

      while (accounts.hasNext()) {
        var nextAccount = accounts.next();
        checkCampaigns(nextAccount)
      }
  } else {
    console.log("Account " + account.getName() + " is not MCC")
    checkCampaigns(account)
  }
}

function checkCampaigns(account) {
  const accountInfoStr = "{" + account.getName() + " - " + account.getCustomerId() + "}"

  console.log("Checking campaigns for account " + accountInfoStr + "...")

  if (isMCCAccount()) {
    AdsManagerApp.select(account); // Switch context to the current account
  }

  if (fetchOnlyActiveCampaigns) {
    var campaignIterator = AdsApp.campaigns().withCondition("Status = ENABLED").withCondition("ServingStatus IN ['SERVING']").get();
    var shoppingCampaignIterator = AdsApp.shoppingCampaigns().withCondition("Status = ENABLED").withCondition("ServingStatus IN ['SERVING']").get();
    var videoCampaignIterator = AdsApp.videoCampaigns().withCondition("Status = ENABLED").withCondition("ServingStatus IN ['SERVING']").get();
    var performanceMaxCampaignIterator = AdsApp.performanceMaxCampaigns().withCondition("Status = ENABLED").withCondition("ServingStatus IN ['SERVING']").get();
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

function checkCampaignIterator(account, campaignIterator) {
  while (campaignIterator.hasNext()) {
    const campaign = campaignIterator.next();

    checkSingleCampaignGeoTarget(account, campaign);
    checkSingleCampaignBudget(account, campaign);
  }
}

function checkSingleCampaignGeoTarget(account, campaign) {
  console.log("Checking campaign " + campaign.getId() + " - " + campaign.getName() + "...")

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

  // Compare and log discrepancies (if any)
  if (!arraysHaveSameElements(desiredIncludedGeoTargetsNames, actualIncludedGeoTargetsNames) || 
     !arraysHaveSameElements(desiredExcludedGeoTargetsNames, actualExcludedGeoTargetsNames)) {
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
      misconfigured: true
    })
    console.log("Misconfigured")
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
      misconfigured: false
    })
    console.log("Ok")
  }
}

function getCampaignDesiredLocations(campaign) {
    // Find the campaign in the spreadsheet
    const range = geoTargetingConfigSheet.getDataRange();
    const values = range.getValues();

    const campaignId = campaign.getId();
    const campaignName = campaign.getName();

    var desiredIncludedGeotargetsStr = "";
    var desiredExcludedGeotargetsStr = "";

    for (var i = 0; i < values.length; i++) {
      if (values[i][2] == campaignId) { // Account ID is in column A and Campaign ID is in column C
        desiredIncludedGeotargetsStr = values[i][4]; // Desired Included Geo Targeting is in column E
        desiredExcludedGeotargetsStr = values[i][5]; // Desired Excluded Geo Targeting is in column F

        break;
      }
    }

    var desiredIncludedGeotargetsNames = desiredIncludedGeotargetsStr.split(",");
    var desiredExcludedGeotargetsNames = desiredExcludedGeotargetsStr.split(",");

    desiredIncludedGeotargetsNames = desiredIncludedGeotargetsNames.map(obj => obj.trim()).filter(obj => obj !== "" && obj !== "-");

    desiredExcludedGeotargetsNames = desiredExcludedGeotargetsNames.map(obj => obj.trim()).filter(obj => obj !== "" && obj !== "-");

    return {
      desiredIncludedGeotargetsNames,
      desiredExcludedGeotargetsNames
    }
}

function getCampaignActualLocations(campaign) {
  const actualIncludedGeoTargetsNames = []
  const actualExcludedGeoTargetsNames = []
  const actualIncludedGeoTargetsTypes = []
  const actualExcludedGeoTargetsTypes = []

  // TODO: UNCOMMENT WHEN pMaxCampaign.targeting() SUPPORTED
  // const actualIncludedGeoTargets = campaign.targeting().targetedLocations().get();
  // while (actualIncludedGeoTargets.hasNext()) {
  //   var target = actualIncludedGeoTargets.next();
  //   actualIncludedGeoTargetsNames.push(target.getName());
  //   actualIncludedGeoTargetsTypes.push(target.getTargetType());
  // }

  // const actualExcludedGeoTargets = campaign.targeting().excludedLocations().get();
  // while (actualExcludedGeoTargets.hasNext()) {
  //   var target = actualExcludedGeoTargets.next();
  //   actualExcludedGeoTargetsNames.push(target.getName());
  //   actualExcludedGeoTargetsTypes.push(target.getTargetType());
  // }


  // TODO: REMOVE WHEN pMaxCampaign.targeting() SUPPORTED
  try {
    const actualIncludedGeoTargets = campaign.targeting().targetedLocations().get();
    while (actualIncludedGeoTargets.hasNext()) {
      var target = actualIncludedGeoTargets.next();
      actualIncludedGeoTargetsNames.push(target.getName());
      actualIncludedGeoTargetsTypes.push(target.getTargetType());
    }
  } catch (e) {
    const searchCampaign = AdsApp.campaigns().withLimit(1).get().next();

    const targeting = searchCampaign.targeting.call(campaign);

    for (const location of targeting.targetedLocations()) {
      actualIncludedGeoTargetsNames.push(location.getName());
      actualIncludedGeoTargetsTypes.push(location.getTargetType());
    }
  }

  try {
    const actualExcludedGeoTargets = campaign.targeting().excludedLocations().get();
    while (actualExcludedGeoTargets.hasNext()) {
      var target = actualExcludedGeoTargets.next();
      actualExcludedGeoTargetsNames.push(target.getName());
      actualExcludedGeoTargetsTypes.push(target.getTargetType());
    }
  } catch (e) {
    const searchCampaign = AdsApp.campaigns().withLimit(1).get().next();

    const targeting = searchCampaign.targeting.call(campaign);

    for (const location of targeting.excludedLocations()) {
      actualExcludedGeoTargetsNames.push(location.getName());
      actualExcludedGeoTargetsTypes.push(location.getTargetType());
    }
  }

  return {actualIncludedGeoTargetsNames, actualIncludedGeoTargetsTypes, actualExcludedGeoTargetsNames, actualExcludedGeoTargetsTypes};
}

function checkSingleCampaignBudget(account, campaign) {
  const desired = getCampaignDesiredBudget(campaign)
  const maxDailyBudget = desired.maxDailyBudget
  const maxTotalBudget = desired.maxTotalBudget
  const maxPercentageOverAverageHistoricalBudget = desired.maxPercentageOverAverageHistoricalBudget
  const actual = getCampaignActualBudget(campaign)
  const actualDailyBudget = actual.actualDailyBudget
  const actualTotalBudget = actual.actualTotalBudget
  const actualPercentageOverAverageHistoricalBudget = actual.actualPercentageOverAverageHistoricalBudget


  const accountId = account.getCustomerId();
  const accountName = account.getName();
  const campaignId = campaign.getId();
  const campaignName = campaign.getName();

  console.log(campaignName + " - daily budget: " + actualDailyBudget + " - total budget: " + actualTotalBudget)

  if ((actualDailyBudget > maxDailyBudget && actualDailyBudget != -1) || (actualTotalBudget > maxTotalBudget && actualTotalBudget != -1)) {
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
      misconfigured: true
    })
    console.log("Misconfigured")
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
      misconfigured: false
    })
    console.log("Ok")
  }
}

function getCampaignDesiredBudget(campaign) {
  const range = budgetConfigSheet.getDataRange();
  const values = range.getValues();

  const campaignId = campaign.getId();

  for (var i = 0; i < values.length; i++) {
    if (values[i][2] == campaignId) { // Campaign ID is in column C
      return {
        maxDailyBudget: convertStringToFloat(values[i][4]),
        maxTotalBudget: convertStringToFloat(values[i][5]),
        maxPercentageOverAverageHistoricalBudget: convertStringToFloat(values[i][6])
      }
    }
  }
}

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

function getCampaignActualBudget(campaign) {
  var budget = campaign.getBudget();

  if (budget) {
    return {
      actualDailyBudget: budget.getAmount(),
      actualTotalBudget: budget.getTotalAmount(),
      // TODO: FIX
      actualPercentageOverAverageHistoricalBudget: 0
    }
  } else {
    return {
      actualDailyBudget: -1,
      actualTotalBudget: -1
    }
  }
}

function writeToResultSheet() {
  console.log("Writing results to sheets...")
  const geoTargetingResultSheet = createOrClearSheet(geoTargetingResultSheetName);
  geoTargetingResultSheet.appendRow([
    "Customer ID",
    "Customer name",
    "Campaign ID",
    "Campaign name",
    "Desired included locations",
    "Current included locations",
    // "Current included location types",
    "Desired excluded locations",
    "Current excluded locations",
    // "Current excluded location types",
    "MISCONFIGURED"
  ]);
  geoTargetingResult.forEach(r => {
    geoTargetingResultSheet.appendRow([
      r.accountId,
      r.accountName,
      r.campaignId,
      r.campaignName,
      r.desiredIncludedGeoTargetsNames.length !== 0 ? r.desiredIncludedGeoTargetsNames.join(', ') : '-',
      r.actualIncludedGeoTargetsNames.length !== 0 ? r.actualIncludedGeoTargetsNames.join(', ') : '-',
      // r.actualIncludedGeoTargetsTypes.length !== 0 ? r.actualIncludedGeoTargetsTypes.join(', ') : '-',
      r.desiredExcludedGeoTargetsNames.length !== 0 ? r.desiredExcludedGeoTargetsNames.join(', ') : '-',
      r.actualExcludedGeoTargetsNames.length !== 0 ? r.actualExcludedGeoTargetsNames.join(', ') : '-',
      // r.actualExcludedGeoTargetsTypes.length !== 0 ? r.actualExcludedGeoTargetsTypes.join(', ') : '-',
      r.misconfigured
    ])
  })

  range = geoTargetingResultSheet.getRange("A1:I1");

  range.setBackground("#D9D9D9");
  range.setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_THICK);

  range = geoTargetingResultSheet.getRange("A2:I999");
  range.setBorder(null, null, null, null, true, null, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  geoTargetingResultSheet.setColumnWidths(1, 1, 120);
  geoTargetingResultSheet.setColumnWidths(2, 1, 300);
  geoTargetingResultSheet.setColumnWidths(3, 1, 120);
  geoTargetingResultSheet.setColumnWidths(4, 5, 300);
  geoTargetingResultSheet.setColumnWidths(9, 1, 120);


  const budgetResultSheet = createOrClearSheet(budgetResultSheetName);
  budgetResultSheet.appendRow([
    "Customer ID",
    "Customer name",
    "Campaign ID",
    "Campaign name",
    "Desired max daily budget",
    "Current daily budget",
    "Desired max total budget",
    "Current total budget",
    // TODO: UNCOMMENT IF SOLVED
    // "Desired percentage over average historical budget",
    // "Current percentage over average historical budget",
    "MISCONFIGURED"
  ]);

  budgetResult.forEach(r => {
    budgetResultSheet.appendRow([
      r.accountId,
      r.accountName,
      r.campaignId,
      r.campaignName,
      r.maxDailyBudget && r.maxDailyBudget !== 0 ? r.maxDailyBudget : '-',
      r.actualDailyBudget && r.actualDailyBudget !== 0 ? r.actualDailyBudget : '-',
      r.maxTotalBudget && r.maxTotalBudget !== 0 ? r.maxTotalBudget : '-',
      r.actualTotalBudget && r.actualTotalBudget !== 0 ? r.actualTotalBudget : '-',
      // TODO: UNCOMMENT IF SOLVED
      // r.maxPercentageOverAverageHistoricalBudget && r.maxPercentageOverAverageHistoricalBudget !== 0 ? r.maxPercentageOverAverageHistoricalBudget : '-',
      // r.actualPercentageOverAverageHistoricalBudget && r.actualPercentageOverAverageHistoricalBudget !== 0 ? r.actualPercentageOverAverageHistoricalBudget : '-',
      r.misconfigured
    ])
  })

  range = budgetResultSheet.getRange("A1:I1");

  range.setBackground("#D9D9D9");
  range.setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_THICK);

  range = budgetResultSheet.getRange("A2:I999");
  range.setBorder(null, null, null, null, true, null, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  budgetResultSheet.setColumnWidths(1, 1, 120);
  budgetResultSheet.setColumnWidths(2, 1, 300);
  budgetResultSheet.setColumnWidths(3, 1, 120);
  budgetResultSheet.setColumnWidths(4, 1, 300);
  budgetResultSheet.setColumnWidths(5, 4, 140);
  budgetResultSheet.setColumnWidths(9, 1, 120);
}

function sendEmail() {
  if (geoTargetingMisconfigured.length > 0 || budgetMisconfigured.length > 0) {
    console.log("Sending email...")
    const subject = "[Warning] Google Ads campaigns misconfiguration";
    const body = createEmailBody();

    MailApp.sendEmail({
      to: emailAddresses,
      subject: subject,
      htmlBody: body
    });
  }
}

function createEmailBody() {
  let body = `
  <!DOCTYPE html>
  <html>
  <body>
  `
  if (geoTargetingMisconfigured.length > 0) {
    body += `
    <h2>Misconfigured geo targeting</h2>
    ${createEmailGeoTargetingBodyTable()}
    `
  }
  if (budgetMisconfigured.length > 0) {
    body += `
    <h2>Misconfigured budget</h2>
    ${createEmailBudgetBodyTable()}
    `
  }
  body += `
    ${campaignsWerePaused ? "<h2>Campaigns have been PAUSED.<h2>" : "<h2>Campaigns have NOT been PAUSED.<h2>"}
  </body>
  </html>
  `

  return body
}

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

  geoTargetingMisconfigured.forEach(c => {
    table += `
        <tr>
          <td>${c.accountId}</td>
          <td>${c.accountName}</td>
          <td>${c.campaignId}</td>
          <td>${c.campaignName}</td>
          <td>${c.desiredIncludedGeoTargetsNames.length !== 0 ? c.desiredIncludedGeoTargetsNames.join(', ') : '-'}</td>
          <td>${c.actualIncludedGeoTargetsNames.length !== 0 ? c.actualIncludedGeoTargetsNames.join(', ') : '-'}</td>
          <td>${c.desiredExcludedGeoTargetsNames.length !== 0 ? c.desiredExcludedGeoTargetsNames.join(', ') : '-'}</td>
          <td>${c.actualExcludedGeoTargetsNames.length !== 0 ? c.actualExcludedGeoTargetsNames.join(', ') : '-'}</td>
        </tr>
    `;
  });

  table += `
      </tbody>
    </table>
  `;

  return table;
}

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

  budgetMisconfigured.forEach(c => {
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

function pauseMisconfiguredCampaigns() {
  console.log("Pausing campaigns...")

  const campaignIdsToPause = [...geoTargetingMisconfigured.map(c => c.campaignId), ...budgetMisconfigured.map(c => c.campaignId)]

  const campaignSelector = AdsApp.campaigns().withIds(campaignIdsToPause);
  const campaignIterator = campaignSelector.get();
  if (!campaignIterator.hasNext()) {
    console.log("No campaigns found with the specified IDs.");
    return;
  }

  while (campaignIterator.hasNext()) {
    const campaign = campaignIterator.next();

    if (campaign.isEnabled()) {
      try {
        campaign.pause();
      } catch (error) {
        console.log(`Error pausing campaign "${campaign.getName()}" (ID: ${campaign.getId()}): ${error}`);
      }
    }
  }

  campaignsWerePaused = true
}

function arraysHaveSameElements(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return set1.size === set2.size && [...set1].every(value => set2.has(value));
}

function isMCCAccount() {
  try {
    MccApp.accounts(); // Try to access MCC-specific functionality
    return true;      // If no error, it's an MCC account
  } catch (e) {
    return false;     // If error, it's a single account
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

function generateCsvBackup() {
  console.log("Generating csv...")

  // Create CSV and Save to Drive
  const now = new Date();
  const formattedDateTime = Utilities.formatDate(now, AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd_HH:mm");
  const csvData = createCsvData();
  const folder = DriveApp.getFolderById(folderId);

  var csvFileName = `google_ads_geo_targeting_results_${formattedDateTime}.csv`;
  var blob = Utilities.newBlob(csvData.geoTargetingCsvData, "text/csv", csvFileName);
  folder.createFile(blob);

  csvFileName = `google_ads_budget_results_${formattedDateTime}.csv`;
  blob = Utilities.newBlob(csvData.budgetCsvData, "text/csv", csvFileName);
  folder.createFile(blob);
}

function createCsvData() {
  let geoTargetingCsvData = "Customer ID,"
              + "Customer name,"
              + "Campaign ID,"
              + "Campaign name,"
              + "Desired included locations,"
              + "Current included locations,"
              + "Current included location types,"
              + "Desired excluded locations,";
              + "Current excluded locations,"
              + "Current excluded locations types,"
              + "MISCONFIGURED\n"

  geoTargetingResult.forEach(r => {
    geoTargetingCsvData += `${r.accountId},`
            +  `"${r.accountName}",`
            +  `${r.campaignId},`
            +  `"${r.campaignName}",`
            +  `"${r.desiredIncludedGeoTargetsNames.join(', ')}",`
            +  `"${r.actualIncludedGeoTargetsNames.join(', ')}",`
            +  `"${r.actualIncludedGeoTargetsTypes.join(', ')}",`
            +  `"${r.desiredExcludedGeoTargetsNames.join(', ')}",`
            +  `"${r.actualExcludedGeoTargetsNames.join(', ')}",`
            +  `"${r.actualExcludedGeoTargetsTypes.join(', ')}",`;
            +  `"${r.misconfigured}"\n`;
  });

  let budgetCsvData = "Customer ID,"
  + "Customer name,"
  + "Campaign ID,"
  + "Campaign name,"
  + "Desired max daily budget,"
  + "Current daily budget,"
  + "Desired max total budget,"
  + "Current total budget,"
  // TODO: UNCOMMENT IF SOLVED
  // + "Desired percentage over average historical budget,"
  // + "Current percentage over average historical budget,"
  + "MISCONFIGURED\n"

budgetResult.forEach(r => {
  budgetCsvData += `${r.accountId},`
+  `"${r.accountName}",`
+  `${r.campaignId},`
+  `"${r.campaignName}",`
+  `"${r.maxDailyBudget}",`;
+  `"${r.actualDailyBudget}",`;
+  `"${r.maxTotalBudget}",`;
+  `"${r.actualTotalBudget}",`;
// TODO: UNCOMMENT IF SOLVED
// +  `"${r.maxPercentageOverAverageHistoricalBudget}",`;
// +  `"${r.actualPercentageOverAverageHistoricalBudget}",`;
+  `"${r.misconfigured}"\n`;
});

  return {
    geoTargetingCsvData,
    budgetCsvData
  };
}