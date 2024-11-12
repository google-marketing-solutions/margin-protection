const BASE_API_URL = 'https://dfareporting.googleapis.com/dfareporting/v4';

/**
 * Adds a custom menu to the sheet
 *
 * @param {obj} e - The sheet event
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
 * Adds a daily trigger to execute the tool
 */
function daily() {
  setupTriggers('daily');
}

/**
 * Adds a weekly trigger to execute the tool
 */
function weekly() {
  setupTriggers('weekly');
}

/**
 * Set up triggers to execute the tool
 *
 * @param {string} cadence - How often the trigger will execute
 *
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
 * Removes all the configured triggers
 *
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
 * Makes a call to the Campaign Manager 360 API using the specified URL and options.
 *
 *  @param {string} urlSuffix - The API URL suffix.
 *  @param {obj} options - Additional options to be passed to the list API call.
 *  @param {string} baseApiURL - The API URL prefix
 *
 *  @return {string} - The content of the response as a string.
 *
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
 * Wrapper to add retries and exponential backoff on API calls.
 *
 *  @param {function} fn - Function to be invoked, the return of this funcntion is returned.
 *  @param {int} retries - Number of times to retry.
 *  @param {int} sleep - How many milliseconds to sleep, it will be doubled at each retry.
 *
 *  @return {obj} result - The return of fn.
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
 * Given an error raised by an API call, determines if the error has a chance
 * of succeeding if it is retried. A good example of a "retriable" error is
 * rate limit, in which case waiting for a few seconds and trying again might
 * refresh the quota and allow the transaction to go through. This method is
 * desidned to be used by the _retry function.
 *
 *   @param {string} error: Error to verify.
 *
 *   @return {boolean} - True if the error is "retriable", false otherwise
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
 * Sends an email to a list of recipients.
 *
 *   @param {obj} emailParameters - The email parameters such as email list, subject, cc, etc.
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
 * Builds email parameters for the sendEmail function.
 *
 *   @param {string} useCase - The error Mitigation use case
 *   @param {string} profileId - The user's profile ID in CM360
 *   @param {string} accountId - The CM360 Network ID
 *   @param {string} reportId - The generated Report ID
 *   @param {string} message - A custom message for the email
 *   @param {list[str]} emails - The list of recipients
 */
function getEmailParameters(
  useCase,
  profileId,
  accountId,
  reportId,
  message,
  emails,
  reportHeader,
  {issues},
) {
  const reportHeaderHtml = reportHeader.map(cell => `<th>${cell}</th>`).join('\n');
  function column(cell) {
    return `<td>${cell}</td>`;
  }
  const reportRows = issues
    .map(row => `<tr>${row.map(column).join('\n')}</tr>`)
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
      ${table}
      <p>For more details, please review the tab '<a href="${url}">${useCase}-${profileId}-${accountId}-${reportId}' in the ${useCase} Monitor</a> Google Spreadsheet.</p>
    </div>`,
    emails: emails,
  };
}

/**
 * Cleans the report data by removing extra headers and footers retrieved in the CSV file.
 *
 *  @param {list[list]} data - The data in the report.
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
 * Logs execution status and timestamp
 *
 *  @param {int} row - The index of the current row
 *  @param {string} executionStatus - The execution status of the current row/report
 *  @param {string} executionTimestamp - The execution timestamp of the current row/report
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
