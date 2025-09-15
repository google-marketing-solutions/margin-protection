/**
 * @fileoverview This file contains a collection of general-purpose utility
 * functions that support the main script. These functions handle tasks such as
 * creating UI menus, managing triggers, making API calls with retry logic,
 * sending emails, and cleaning report data.
 */

/** @const {string} The base URL for the DCM/DFA Reporting and Trafficking API. */
const BASE_API_URL = 'https://dfareporting.googleapis.com/dfareporting/v4';

/**
 * Creates a custom menu in the spreadsheet UI when the file is opened.
 *
 * @param {Event} e The onOpen event object.
 */
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(`Margin Protection Monitor`)
    .addItem(`Run`, 'main')
    .addSeparator()
    .addItem('Set up Weekly Run Trigger', 'weekly')
    .addSeparator()
    .addItem('Remove Weekly Trigger', 'removeTriggers')
    .addToUi();
}

/**
 * Sets up a daily trigger for the main function.
 */
function daily() {
  setupTriggers('daily');
}

/**
 * Sets up a weekly trigger for the main function.
 */
function weekly() {
  setupTriggers('weekly');
}

/**
 * Configures and creates a time-based trigger for the 'main' function.
 *
 * @param {string} cadence The frequency of the trigger, either 'daily' or
 *     'weekly'.
 */
function setupTriggers(cadence) {
  // Remove previous triggers
  removeTriggers(false);
  const hour = 5;
  // Create trigger
  if (cadence === 'daily') {
    ScriptApp.newTrigger('main').timeBased().atHour(hour).everyDays(1).create();
  } else if (cadence === 'weekly') {
    ScriptApp.newTrigger('main')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(hour)
      .everyWeeks(1)
      .create();
  } else {
    Logger.log('No trigger was set up.');
    return;
  }
  const timeZone = Session.getScriptTimeZone();
  SpreadsheetApp.getUi().alert(
    `Success! The Margin Protection Monitor Tool will execute ${cadence} at ${hour}:00 am ${timeZone}`,
  );
}

/**
 * Removes all existing time-based triggers for the current project.
 *
 * @param {boolean=} showMessage Whether to display a success alert. Defaults
 *     to true.
 */
function removeTriggers(showMessage = true) {
  // Remove triggers
  for (let trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getEventType() == ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  if (showMessage) {
    SpreadsheetApp.getUi().alert(`Success! The trigger was removed.`);
  }
}

/**
 * Makes a call to the Campaign Manager 360 API.
 *
 * @param {string} urlSuffix The API URL suffix to append to the base URL.
 * @param {?Object} options Additional options for the UrlFetchApp call.
 * @param {string=} baseApiUrl The base API URL. Defaults to BASE_API_URL.
 * @return {string} The content of the API response as a string.
 * @throws {string} If the API call returns a non-200 status code.
 */
function apiCall(urlSuffix, options, baseApiUrl = BASE_API_URL) {
  var url = baseApiUrl + urlSuffix;
  if (!options) {
    options = {};
  }
  if (!options.headers) {
    options.headers = {};
  }
  options['muteHttpExceptions'] = true;
  options.headers['Authorization'] = 'Bearer ' + ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() != 200) {
    throw 'Error fetching report ' + response.getContentText();
  }
  Logger.log('Successful response from CM reporting API...');
  return response.getContentText();
}

/**
 * A wrapper function that adds retries and exponential backoff to an API call.
 *
 * @param {function} fn The function to be invoked.
 * @param {number} retries The number of times to retry.
 * @param {number} sleep The initial time to sleep in milliseconds, which
 *     doubles on each retry.
 * @param {string} entity The primary API entity.
 * @param {?string} secondEntity The secondary API entity.
 * @param {!Object} options The options for the API call.
 * @param {string} profileId The user profile ID.
 * @return {*} The result of the invoked function.
 * @private
 */
function _retry(fn, retries, sleep, entity, secondEntity, options, profileId) {
  try {
    var result = fn(entity, secondEntity, options, profileId);
    return result;
  } catch (error) {
    if (isRetriableError(error) && retries > 0) {
      Utilities.sleep(sleep);
      return _retry(fn, retries - 1, sleep * 2);
    } else {
      throw error;
    }
  }
}

/**
 * Checks if an error from an API call is retriable.
 *
 * @param {string|Error} error The error to verify.
 * @return {boolean} True if the error is retriable, false otherwise.
 */
function isRetriableError(error) {
  var retriableErroMessages = [
    'failed while accessing document with id',
    'internal error',
    'user rate limit exceeded',
    'quota exceeded',
    '502',
    'try again later',
    'failed while accessing document',
    'empty response',
  ];

  var message = null;
  var result = false;

  if (error) {
    if (typeof error == 'string') {
      message = error;
    } else if (error.message) {
      message = error.message;
    } else if (error.details && error.details.message) {
      message = error.details.message;
    }

    message = message ? message.toLowerCase() : null;
  }

  if (message) {
    retriableErroMessages.forEach(function (retriableMessage) {
      if (message.indexOf(retriableMessage) != -1) {
        result = true;
      }
    });
  }

  return result;
}

/**
 * Sends an email with a specified subject and HTML body.
 *
 * @param {{
 *   emails: string,
 *   subject: string,
 *   body: string
 * }} emailParameters An object containing the email parameters.
 */
function sendEmail(emailParameters) {
  const htmlBody = HtmlService.createHtmlOutput(emailParameters.body);
  MailApp.sendEmail({
    to: emailParameters.emails,
    subject: emailParameters.subject,
    htmlBody: htmlBody.getContent(),
  });
}

/**
 * Builds the parameters object for sending an alert email.
 *
 * @param {string} useCase The key for the current use case.
 * @param {string} profileId The user's profile ID in CM360.
 * @param {string} accountId The CM360 Account ID.
 * @param {string} reportId The generated Report ID.
 * @param {string} message A custom message for the email body.
 * @param {string} emails A comma-separated string of recipient email
 *     addresses.
 * @param {!Array<string>} reportHeader An array of strings for the table
 *     header.
 * @param {{issues: !Array<!Array<string>>}} issues An object containing the
 *     identified issues.
 * @return {{
 *   subject: string,
 *   body: string,
 *   emails: string
 * }} The complete email parameters object.
 */
function getEmailParameters(
  useCase,
  profileId,
  accountId,
  reportId,
  message,
  emails,
  reportHeader,
  { issues },
) {
  const reportHeaderHtml = reportHeader
    .map((cell) => `<th>${cell}</th>`)
    .join('\n');
  function column(cell) {
    return `<td>${cell}</td>`;
  }
  const reportRows = issues
    .map((row) => `<tr>${row.map(column).join('\n')}</tr>`)
    .join('\n');
  const table = `
    <table>
      <tr>${reportHeaderHtml}</tr>
      ${reportRows}
    </table>
  `;
  message = message
    ? message
    : `This is an automated email to let you know that ${useCase} issues have been identified for CM360 Account ${accountId}.`;

  const url = `${SpreadsheetApp.getActive().getUrl()}?gid=${SpreadsheetApp.getActive()
    .getActiveSheet()
    .getSheetId()}`;

  return {
    subject: `[ACTION REQUIRED] CM360 ${useCase} Issues identified for account ${accountId}`,
    body: `<div style='font-size:16px;'>
      <p>Hi,</p>
      <p>${message}</p>
      <p>For more details, please review the tab <a href="${url}">'${useCase}-${profileId}-${accountId}-${reportId}' in the ${useCase} Monitor</a> Google Spreadsheet.</p>
      <div style='overflow-y: scroll; max-height: 70vh'>
      ${table}
      </div>
    </div>`,
    emails,
  };
}

/**
 * Removes extraneous header and footer rows from a raw CSV report string.
 *
 * @param {!Array<!Array<string>>} data The raw report data as a 2D array.
 */
function cleanReportData(data) {
  if (!data || data.length === 0) {
    Logger.log(`cleanReportData: There is no data.`);
    return;
  }
  let reportStartIndex = 0;
  for (row = 0; row < data.length; row++) {
    const rowData = data[row];
    const col = rowData.length > 0 ? rowData[0] : '';
    if (col === 'Report Fields') {
      reportStartIndex = row;
      break;
    }
  }
  // Report data has N headers and 1 footer that should be removed
  data.splice(0, reportStartIndex + 1);
  data.pop();
}

/**
 * Logs the execution status and timestamp to the 'Reports Config' sheet for a
 * given row.
 *
 * @param {number} row The index of the current row in the config sheet
 *     (0-based).
 * @param {string} executionStatus The status message to log.
 * @param {string} executionTimestamp The timestamp string to log.
 */
function logExecutionStatus(row, executionStatus, executionTimestamp) {
  spreadsheet
    .getSheetByName(REPORTS_CONFIG_SHEET_NAME)
    .getRange(row + 2, REPORTS_CONFIG_EXECUTION_STATUS_COLUMN)
    .setValue(executionStatus);
  spreadsheet
    .getSheetByName(REPORTS_CONFIG_SHEET_NAME)
    .getRange(row + 2, REPORTS_CONFIG_LAST_EXECUTION_COLUMN)
    .setValue(executionTimestamp);
}
