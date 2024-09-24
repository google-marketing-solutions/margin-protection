/***************************************************************************
 *
 *  Copyright 2023 Google Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *  Note that these code samples being shared are not official Google
 *  products and are not formally supported.
 *
 ***************************************************************************/

let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

/**
 * Runs the main logic to download CM360 reporting data and identifies
 * Tracking Ads issues based on the rules below:
 * Rule 1: clicks > impressions
 *
 * If isues are found:
 * 1. Visual alerts will be created using conditional formatting and highlighting the rows in color red
 * 2. Emails will be sent to the provided list of recipients, if this cell is empty, emails will not be sent.
 */
function main() {
  let currentRow;
  const date = new Date();
  try {
    const reportsSheet = spreadsheet.getSheetByName(REPORTS_CONFIG_SHEET_NAME);
    const reports = reportsSheet
      .getRange(
        REPORTS_CONFIG_ROW_START,
        REPORTS_CONFIG_COL_START,
        reportsSheet.getLastRow(),
        reportsSheet.getLastColumn()
      )
      .getValues();
    const useCasesConfig = getUseCasesConfiguration();

    // Iterate over a list of reports and send alerts for each CM360 Network ID and Profile ID.
    reports.forEach((reportRow, row) => {
      currentRow = row;
      const useCase = reportRow[REPORTS_CONFIG_USE_CASE_COLUMN - 1];
      const enabled = reportRow[REPORTS_CONFIG_ENABLED_COLUMN - 1];
      const profileId = reportRow[REPORTS_CONFIG_PROFILE_ID_COLUMN - 1];

      if (!profileId) {
        Logger.log(
          `WARNING: Profile ID not provided. Skipping this row ${row}`
        );
        if (useCase) {
          logExecutionStatus(
            row,
            `WARNING: Profile ID not provided. Skipping this row.`,
            `${date.toDateString()} ${date.toTimeString()}`
          );
        }
        return;
      }
      const campaignManagerAPI = new CampaignManagerAPI(profileId);

      // Get CM360 Account information
      const accounts = campaignManagerAPI.list(
        "Accounts",
        null,
        "accounts",
        {}
      );
      const accountId = accounts.length > 0 ? accounts[0].id : "";
      if (!accountId) {
        Logger.log(`Account not found for Profile ID ${profileId}.`);
      }

      if (useCase && !enabled) {
        Logger.log(`Use Case ${useCase} is disabled. Skipping execution...`);
        logExecutionStatus(
          row,
          `Use Case ${useCase} is disabled for Profile ID ${profileId} and CM360 Account ${accountId}. Execution skipped.`,
          `${date.toDateString()} ${date.toTimeString()}`
        );
        return;
      }

      // Create New report in CM360 if param not provided
      let reportId = reportRow[REPORTS_CONFIG_REPORT_ID_COLUMN - 1];
      if (!reportId) {
        Logger.log(
          `Report ID not provided for Profile ID ${profileId} and CM360 Account ${accountId}, creating a new report in CM360...`
        );
        const dateRange = reportRow[REPORTS_CONFIG_REPORT_DATE_RANGE - 1];
        const filters = reportRow[REPORTS_CONFIG_FILTERS_COLUMN - 1];
        const extraParams =
          reportRow[REPORTS_CONFIG_EXTRA_PARAMS_COLUMN - 1].toString();
        if (useCase === FLOODLIGHT_TRENDS_KEY && !extraParams) {
          logExecutionStatus(
            row,
            `ERROR: The Extra Parameters column is required when executing the ${FLOODLIGHT_TRENDS_KEY} use case. Execution skipped.`,
            `${date.toDateString()} ${date.toTimeString()}`
          );
          return;
        }
        if (useCase === FLOODLIGHT_TRENDS_KEY && dateRange != "LAST_14_DAYS") {
          logExecutionStatus(
            row,
            `ERROR: Date range for the ${FLOODLIGHT_TRENDS_KEY} use case must be LAST_14_DAYS. Execution skipped.`,
            `${date.toDateString()} ${date.toTimeString()}`
          );
          return;
        }
        const report = campaignManagerAPI.createAndRunReport(
          useCase,
          dateRange,
          filters.trim(),
          extraParams.trim()
        );
        reportId = report.id;
        // Add report Id and account Id to the Config sheet for visualization purposes and future executions of existing reports
        spreadsheet
          .getSheetByName(REPORTS_CONFIG_SHEET_NAME)
          .getRange(row + 2, REPORTS_CONFIG_ACCOUNT_ID_COLUMN)
          .setValue(accountId);
        spreadsheet
          .getSheetByName(REPORTS_CONFIG_SHEET_NAME)
          .getRange(row + 2, REPORTS_CONFIG_REPORT_ID_COLUMN)
          .setValue(reportId);
      }

      // Get data from the existing report
      let reportData = getExistingReportData(
        useCase,
        profileId,
        accountId,
        reportId,
        campaignManagerAPI
      );
      if (!reportData || reportData.length <= 1) {
        Logger.log(
          "main: There is no data in the report. Skipping execution..."
        );
        // Long message... format later
        logExecutionStatus(
          row,
          "WARNING: The report is not ready or there is no data in the report. Please check the report status directly in CM360 and run again the script or wait for the trigger to run it automatically. Execution was skipped.",
          `${date.toDateString()} ${date.toTimeString()}`
        );
        return;
      }

      // Identify alerts for use cases

      const config = useCasesConfig[useCase];
      const threshold = reportRow[REPORTS_CONFIG_THRESHOLD_COLUMN - 1];
      const emails = reportRow[REPORTS_CONFIG_EMAILS_COLUMN - 1];
      const emailMessage = reportRow[REPORTS_CONFIG_EMAIL_MESSAGE_COLUMN - 1];
      const reportDataSheetName = `${useCase}-${profileId}-${accountId}-${reportId}`;
      let issues = [];

      switch (useCase) {
        case GHOST_PLACEMENTS_KEY:
          // Only rule 3 uses a threshold to evaluate the rule
          if (threshold !== "") {
            // Override default value from the Use Cases Config tab if value provided in this column
            config["rules"][2]["ruleThreshold"] = parseFloat(threshold);
          }
          issues = getGhostPlacementsAlerts(config, reportData);
          break;

        case DEFAULT_ADS_RATE_KEY:
          // Only rule 1 uses a threshold to evaluate the rule
          if (threshold !== "") {
            // Override default value from the Use Cases Config tab if value provided in this column
            config["rules"][0]["ruleThreshold"] = parseFloat(threshold);
          }
          issues = getDefaultAdsRateAlerts(config, reportData);
          break;

        case FLOODLIGHT_TRENDS_KEY:
          // Only rule 1 uses a threshold to evaluate the rule
          if (threshold !== "") {
            // Override default value from the Use Cases Config tab if value provided in this column
            config["rules"][0]["ruleThreshold"] = parseFloat(threshold);
          }
          issues = getFloodlightTrendsAlerts(config, reportData);
          break;

        case OUT_OF_FLIGHT_PLACEMENTS_KEY:
          // Only rule 1 uses a threshold to evaluate the rule
          if (threshold !== "") {
            // Override default value from the Use Cases Config tab if value provided in this column
            config["rules"][0]["ruleThreshold"] = parseFloat(threshold);
          }
          issues = getOutOfFlightPlacementsAlerts(config, reportData);
          break;

        case TRACKING_ADS_KEY:
          // Only rule 1 uses a threshold to evaluate the rule
          if (threshold !== "") {
            // Override default value from the Use Cases Config tab if value provided in this column
            config["rules"][0]["ruleThreshold"] = parseFloat(threshold);
          }
          issues = getTrackingAdsAlerts(config, reportData);
          break;

        case DEFAULT_LANDING_PAGE_KEY:
          // No threshold override for this rule
          issues = getDefaultLandingPageAlerts(config, reportData);
          break;

        default:
          Logger.log(`Use Case ${useCase} not supported`);
          return;
      }

      const dataToSheetStartRow = 1;
      const dataToSheetStartColumn = 1;
      // Replace report data in case the use case returns a different set of data
      reportData = !issues["data"] ? reportData : issues["data"];
      addDataToSheet(
        reportDataSheetName,
        BLUE_RGB_COLOR,
        dataToSheetStartRow,
        dataToSheetStartColumn,
        config.columnToResize,
        config.numColsToResize,
        reportData
      );
      flagUseCaseIssues(config, reportDataSheetName);
      // Sort table by the columns that make sense for the use case
      shortTableByColumns(
        reportDataSheetName,
        config.rangeToSort,
        config.sortByColumns
      );
      // Creat a Filter View in the table
      createFilterForTable(reportDataSheetName, config.rangeToFilter);

      // Send email if any issues found
      if (emails && issues["issues"].length > 0) {
        // Send email only if there are issues
        sendEmail(
          getEmailParameters(
            useCase,
            profileId,
            accountId,
            reportId,
            emailMessage,
            emails
          )
        );
      } else {
        Logger.log(
          `There are no issues identified for use case ${useCase} or email recipients were not provided for alerts. Skipping email notification...`
        );
      }

      // Add execution timestamp and status
      logExecutionStatus(
        row,
        `SUCCESS`,
        `${date.toDateString()} ${date.toTimeString()}`
      );
    });
  } catch (e) {
    Logger.log(`ERROR: ${e}`);
    logExecutionStatus(
      currentRow,
      `ERROR: ${e}`,
      `${date.toDateString()} ${date.toTimeString()}`
    );
  }
}

/**
 * Gets data from an existing report in CM360. The data retrieved will be the latest
 * generated file in the report.
 *
 *  @param {string} useCase - The Margin Protection use case
 *  @param {string} profileId - The CM360 profile Id for the account
 *  @param {string} accountId - The CM360 Network ID
 *  @param {string} reportId - The report Id to be retrieved
 *  @param {obj} campaignManagerAPI - The API wrapper class to perform CM360 operations
 *
 *  @param {list[list]} data - The data in the report
 */
function getExistingReportData(
  useCase,
  profileId,
  accountId,
  reportId,
  campaignManagerAPI
) {
  const latestReportFile = campaignManagerAPI.getLatestReportFile(reportId);
  if (!latestReportFile) {
    Logger.log(
      `The report for Profile ID ${profileId} and CM360 Account ID ${accountId} is still running for use case ${useCase} and it will probably take longer than the script execution limit (5 mins) in this Google Spreadsheet.`
    );
    return;
  }
  const latestReportFileData =
    campaignManagerAPI.getLatestReportFileDataByRedirectURL(latestReportFile);
  let data = Utilities.parseCsv(latestReportFileData);
  cleanReportData(data);
  return data;
}

/**
 * Applies conditional formatting to the sheet to flag the issues
 *
 *  @param {obj} config - Use case configuration containing the rules to evaluate
 *  @param {string} reportDataSheetName - The report sheet name
 */
function flagUseCaseIssues(config, reportDataSheetName) {
  addConditionalFormattingToSheet(
    reportDataSheetName,
    config.flagColumnRange,
    config.rules
  );
}
