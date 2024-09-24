/**
 * Identifies and gets the Ghost Placements issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} data - The data in the report.
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getGhostPlacementsAlerts(config, data) {
  let issues = [];
  // Add flag column to report headers
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const advertiserName = row[GP_ADVERTISER_NAME_COLUMN - 1];
    const campaignName = row[GP_CAMPAIGN_NAME_COLUMN - 1];
    const placementName = row[GP_PLACEMENT_NAME_COLUMN - 1];
    const totalConversions = parseFloat(row[GP_TOTAL_CONVERSIONS_COLUMN - 1]);
    // Rule evaluation happens here
    // Rule 1. 3PAS Creative Scenario - This rule is at position 0 in the rules array
    if (
      advertiserName.startsWith("BidManager_Advertiser_DO_NOT_EDIT_") &&
      placementName.includes("DFA Zero placement")
    ) {
      let brokenRules = `[${config.rules[0].ruleName}]`;
      const threshold = config.rules[2].ruleThreshold
        ? config.rules[2].ruleThreshold
        : 0; // Default to 0 if for some reason threshold is not provided
      if (totalConversions > threshold) {
        // Rule 3. Total conversions > threshold - This rule is at position 2 in the rules array
        brokenRules += `,[${config.rules[2].ruleName}]\nThreshold = ${threshold}`;
      }
      row.push(config.rules[0].ruleType);
      row.push(brokenRules);
      issues.push(row);
    } else if (
      advertiserName.startsWith(
        "BidManager_SeparateSpotlightAdvertiser_DO_NOT_EDIT"
      ) &&
      campaignName.startsWith("BidManager_Campaign_DO_NOT_EDIT_") &&
      placementName.includes("DFA Zero placement")
    ) {
      // Rule 2. Wrapped Tags in DV360 - This rule is at position 1 in the rules array
      let brokenRules = `[${config.rules[1].ruleName}]`;
      const threshold = config.rules[2].ruleThreshold
        ? config.rules[2].ruleThreshold
        : 0; // Default to 0 if for some reason threshold is not provided
      if (totalConversions > threshold) {
        // Rule 3. Total conversions > threshold - This rule is at position 2 in the rules array
        brokenRules += `,[${config.rules[2].ruleName}]\nThreshold = ${threshold}`;
      }
      row.push(config.rules[1].ruleType);
      row.push(brokenRules);
      issues.push(row);
    } else {
      // No issues, add an empty string
      row.push("");
      row.push("");
    }
  });
  return { issues: issues };
}

/**
 * Identifies and gets the Default Ads Rate issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} data - The data in the report.
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getDefaultAdsRateAlerts(config, data) {
  let placementsMap = {};
  // 1. Sum default ads impressions and all ads total impressions
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const placementId = row[DA_PLACEMENT_ID_COLUMN - 1];
    const impressions = parseInt(row[DA_IMPRESSIONS_COLUMN - 1]);
    const adType = row[DA_AD_TYPE_COLUMN - 1];
    // Sum default ads impressions and all ads total impressions
    if (!placementsMap[placementId]) {
      placementsMap[placementId] = {
        sumImpressionsAllAds: 0,
        sumImpressionsDefaultAds: 0,
        defaultAds: 0,
        defaultAdsPercentage: 0,
        otherAds: 0,
        allAds: 0,
      };
    }
    if (adType === DA_DEFAULT_AD_TYPE) {
      placementsMap[placementId]["sumImpressionsDefaultAds"] += impressions;
      placementsMap[placementId]["defaultAds"] += 1;
    } else {
      placementsMap[placementId]["otherAds"] += 1;
    }
    placementsMap[placementId]["sumImpressionsAllAds"] += impressions;
    placementsMap[placementId]["allAds"] += 1;
  });

  // 2. Calculate default ads impressions sum percentage of total impressions (all Ads)
  for (let placementId in placementsMap) {
    let placement = placementsMap[placementId];
    const percentage =
      placement.sumImpressionsAllAds > 0
        ? placement.sumImpressionsDefaultAds / placement.sumImpressionsAllAds
        : 0;
    if (placement.sumImpressionsAllAds === 0) {
      Logger.log(
        `Divisor is 0, setting percentage to 0 for Placement ID ${placementId}. sumImpressionsDefaultAds: ${placement.sumImpressionsDefaultAds} - sumImpressionsAllAds: ${placement.sumImpressionsAllAds}`
      );
    }
    placement["defaultAdsPercentage"] = percentage;
  }

  // 3. Identify default ads rates > threshold defined in the use case configuration
  let issues = [];
  // Add flag column to report headers
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const placementId = row[DA_PLACEMENT_ID_COLUMN - 1];
    const defaultAdsRatePercentage = placementsMap[placementId]
      ? placementsMap[placementId].defaultAdsPercentage
      : 0;
    const sumImpressionsDefaultAds = placementsMap[placementId]
      ? placementsMap[placementId].sumImpressionsDefaultAds
      : 0;
    const sumImpressionsAllAds = placementsMap[placementId]
      ? placementsMap[placementId].sumImpressionsAllAds
      : 0;
    // Rule evaluation happens here
    // Rule 1. Default Ads Rate > threshold - This rule is at position 0 in the rules array
    const threshold = config.rules[0].ruleThreshold
      ? config.rules[0].ruleThreshold
      : 0.02; // Default to 2% if for some reason threshold is not provided
    if (defaultAdsRatePercentage > threshold) {
      const pLabel =
        defaultAdsRatePercentage === 1
          ? defaultAdsRatePercentage * 100
          : (defaultAdsRatePercentage * 100).toFixed(2);
      let brokenRules = `Rules: [${
        config.rules[0].ruleName
      }]\nSum of Default Ads Impressions in this Placement ID = ${sumImpressionsDefaultAds}\nSum of All Ads Impressions in this Placement ID = ${sumImpressionsAllAds}\nDefault Ads percentage = ${pLabel}%\nThreshold = ${
        threshold * 100
      }%`;
      row.push(config.rules[0].ruleType);
      row.push(brokenRules);
      issues.push(row);
    } else {
      // No issues, add an empty string
      row.push("");
      row.push("");
    }
  });
  return { issues: issues };
}

/**
 * Identifies and gets the Floodlight trends issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} dataReport1 - The data in the report1. TODO: CHANGE THIS!!!!!!!!!!!
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getFloodlightTrendsAlerts(config, data) {
  let issues = [];
  // 1. Identify the activities from before last week, last week and current week and build separate maps (script will run on Mondays)
  let weekBeforeLastActivities = {};
  let lastWeekActivities = {};
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    // Insert week label as the first column as a placeholder to match the column indexes
    row.splice(0, 0, "");
    const week = row[FT_WEEK_COLUMN - 1];
    const floodlightConfigId = row[FT_FLOODLIGHT_CONFIG_COLUMN - 1];
    const activityId = row[FT_ACTIVITY_ID_COLUMN - 1];
    const floodlightImpressions = parseInt(
      row[FT_FLOODLIGHT_IMPRESSIONS_COLUMN - 1]
    );
    const activityKey = `${floodlightConfigId}-${activityId}`;

    // Check if the placement conversions are from weekBeforeLast, lastWeek or currentWeek
    const weekLabel = ftDetermineWeekForPlacement(week);
    switch (weekLabel) {
      case "weekBeforeLast":
        if (!weekBeforeLastActivities[activityKey]) {
          weekBeforeLastActivities[activityKey] = {
            week: week,
            floodlightImpressionsSum: 0,
          };
        } else {
          console.log(
            `WARNING: Activity ${week} - ${activityKey} was found twice in the report for weekBeforeLastActivities`
          );
        }
        weekBeforeLastActivities[activityKey]["floodlightImpressionsSum"] +=
          floodlightImpressions;
        break;
      case "lastWeek":
        // Because how dates are calculated, consider the placement in the last week when the difference === 2 weeks: https://www.epochconverter.com/weeks/2023
        if (!lastWeekActivities[activityKey]) {
          lastWeekActivities[activityKey] = {
            week: week,
            floodlightImpressionsSum: 0,
          };
        } else {
          console.log(
            `WARNING: Activity ${week} - ${activityKey} was found twice in the report for lastWeekActivities`
          );
        }
        lastWeekActivities[activityKey]["floodlightImpressionsSum"] +=
          floodlightImpressions;
        break;
      case "currentWeek":
        // Ignore Activity ${week} - ${activityKey} for the current week (Sunday) since they will be evaluated in the next run next week.`)
        break;
      default:
        Logger.log(
          `Activity ${week} - ${activityKey} is not from weekBeforeLast, lastWeek or currentWeek. Please check`
        );
    }
  });

  // Add week label, flag, rules column to report headers
  data[0].splice(0, 0, WEEK_LABEL_HEADER); // add it to position 0
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  // 4. Check if there is a variation > threshold in the conversions. Compare last week against before last week activities
  // and current week with last week activities
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const week = row[FT_WEEK_COLUMN - 1];
    const floodlightConfigId = row[FT_FLOODLIGHT_CONFIG_COLUMN - 1];
    const activityId = row[FT_ACTIVITY_ID_COLUMN - 1];
    const floodlightImpressions = parseInt(
      row[FT_FLOODLIGHT_IMPRESSIONS_COLUMN - 1]
    );
    const activityKey = `${floodlightConfigId}-${activityId}`;

    // Find row to compare from weekBeforeLastActivities
    let weekLabel = ftDetermineWeekForPlacement(week);
    switch (weekLabel) {
      case "lastWeek":
        // If current row ActivityId is from last week, compare it against the same ActivityId from before last week
        const weekBeforeLastFloodlightImpressionsSum =
          weekBeforeLastActivities[activityKey];
        if (weekBeforeLastFloodlightImpressionsSum) {
          // Compare only if found in before last week map. It might not be there since this could be a new placement
          ftEvaluateVarianceAndAddIssues(
            config,
            weekBeforeLastFloodlightImpressionsSum["floodlightImpressionsSum"],
            floodlightImpressions,
            row,
            issues
          );
        } else {
          // ActivityId was not found in  weekBeforeLastActivities, there is nothing to compare against, no issue identified
          row.push("");
          row.push("");
        }
        break;
      default:
        // ActivityId ${activityKey} not found before last week, last week, there is nothing to compare against,  no issue identified
        row.push("");
        row.push("");
        break;
    }
    // Update week label with the correct weekLabel
    row[0] = weekLabel;
  });

  // 5. Filter currentWeek data to avoid confusion for the users, which will be always 1 day (Sunday on current week) since the script executes on Monday
  const headers = data[0];
  let newData = [headers];
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers since they were added before
      return;
    }
    const week = row[FT_WEEK_COLUMN - 1];
    let weekLabel = ftDetermineWeekForPlacement(week);
    // Filter currentWeek data to avoid confusion for the users, which will be always 1 day (Sunday on current week) since the script executes on Monday
    // This will show to the user only comparisons between last week and the week before last week
    if (weekLabel === "currentWeek") {
      return;
    }
    // Only add data from last week and the week before last week
    newData.push(row);
  });
  return { issues: issues, data: newData };
}

/**
 * Determine whether the placement is from before last week, last week
 * or the current week.
 *
 *  @param {string} week - The week coming form the report
 *
 *  @return {str} weekLabel - The week label: weekBeforeLast, lastWeek, currentWeek
 */
function ftDetermineWeekForPlacement(week) {
  const weekParts = week.split("-");
  const year = parseInt(weekParts[0]);
  const month = parseInt(weekParts[1]) - 1; // monthIndex for new Date() = Integer value representing the month, beginning with 0 for January to 11 for December.
  const day = parseInt(weekParts[2]);
  const today = new Date();
  const reportWeek = new Date(year, month, day);

  let lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  let beforeLastWeek = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (reportWeek < lastWeek && reportWeek <= beforeLastWeek) {
    return "weekBeforeLast";
  } else if (reportWeek <= lastWeek) {
    return "lastWeek";
  } else {
    return "currentWeek";
  }
}

/**
 * Evaluates Floodlight Trends rule 1 and add adds the identified issues
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {int} floodlightImpressionsWeekBefore - The total conversions from a week before the week being evaluated
 *  @param {int} floodlightImpressionsWeek - The total conversions from the week being evaluated
 */
function ftEvaluateVarianceAndAddIssues(
  config,
  floodlightImpressionsWeekBefore,
  floodlightImpressionsWeek,
  row,
  issues
) {
  const variance =
    (floodlightImpressionsWeekBefore - floodlightImpressionsWeek) /
    floodlightImpressionsWeekBefore;
  // Rule 1. For week on week trends flag for more > Threshold variance
  const threshold = config.rules[0].ruleThreshold
    ? config.rules[0].ruleThreshold
    : 0.1; // Default to 10% if for some reason threshold is not provided
  if (variance > threshold) {
    let brokenRules = `[${config.rules[0].ruleName}]`;
    row.push(config.rules[0].ruleType);
    const vLabel =
      variance === 1 ? variance * 100 : (variance * 100).toFixed(2);
    row.push(
      `Rules: ${brokenRules}\n'Week before last' conversions for this Floodlight Configuration and Activity ID: ${floodlightImpressionsWeekBefore}\nVariance: ${vLabel}%`
    );
    issues.push(row);
  } else {
    // No issues, add an empty string
    row.push("");
    row.push("");
  }
}

/**
 * Identifies and gets the Out out Flight Placement issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} data - The data in the report.
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getOutOfFlightPlacementsAlerts(config, data) {
  let issues = [];
  // Add flag column to report headers
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const impressions = parseInt(row[OFP_IMPRESSIONS_COLUMN - 1]);
    const placementEndDateStr = row[OFP_PLACEMENT_END_DATE_COLUMN - 1];
    const placementEndDateParts = placementEndDateStr.split("-");
    const year = parseInt(placementEndDateParts[0]);
    const month = parseInt(placementEndDateParts[1]) - 1; // monthIndex for new Date() = Integer value representing the month, beginning with 0 for January to 11 for December.
    const day = parseInt(placementEndDateParts[2]);
    const placementEndDate = new Date(year, month, day);

    // Compare the impression date to the end date, meaning the day the impressions served to the end date
    const placementDateStr = row[OFP_DATE_COLUMN - 1];
    const placementDateParts = placementDateStr.split("-");
    const placementDateYear = parseInt(placementDateParts[0]);
    const placementDateMonth = parseInt(placementDateParts[1]) - 1;
    const placementDateDay = parseInt(placementDateParts[2]);
    const placementDate = new Date(
      placementDateYear,
      placementDateMonth,
      placementDateDay
    );

    // Rule 1. Placements with impressions > Threshold out of flight schedule
    const threshold = config.rules[0].ruleThreshold
      ? config.rules[0].ruleThreshold
      : 1000; // Default to 1000 if for some reason threshold is not provided
    // If placementEndDate has ended and impressions > threshold
    if (placementDate > placementEndDate && impressions > threshold) {
      let brokenRules = `Rules: [${config.rules[0].ruleName}]\nThreshold = ${threshold}`;
      row.push(config.rules[0].ruleType);
      row.push(brokenRules);
      issues.push(row);
    } else {
      // No issues, add an empty string
      row.push("");
      row.push("");
    }
  });
  return { issues: issues };
}

/**
 * Identifies and gets the Tracking Ads issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} data - The data in the report.
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getTrackingAdsAlerts(config, data) {
  let issues = [];
  // Add flag column to report headers
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const impressions = parseInt(row[TA_IMPRESSIONS_COLUMN - 1]);
    const clicks = parseInt(row[TA_CLICKS_COLUMN - 1]);
    const threshold = config.rules[0].ruleThreshold
      ? config.rules[0].ruleThreshold
      : 1000; // Default to 1000 if for some reason threshold is not provided
    // Apply Rule 1: clicks > threshold - Color: red
    if (clicks > threshold && impressions < clicks) {
      const brokenRules = `Rules: [${config.rules[0].ruleName}]\nThreshold = ${threshold}`;
      row.push(config.rules[0].ruleType); // This is flagged as issue
      row.push(brokenRules);
      issues.push(row);
    } else if (impressions > 0 && clicks > impressions) {
      // Apply Rule 2: impressions > 0 and clicks > impressions - Color: red
      const brokenRules = `Rules: [${config.rules[1].ruleName}]`;
      row.push(config.rules[1].ruleType); // This is flagged as issue
      row.push(brokenRules);
      issues.push(row);
    } else if (clicks > impressions) {
      // Apply Rule 3: clicks > impressions - Color: yellow
      const brokenRules = `Rules: [${config.rules[2].ruleName}]`;
      row.push(config.rules[2].ruleType); // This is flagged as warning
      row.push(brokenRules);
      issues.push(row);
    } else {
      // Neither issue nor warning
      row.push("");
      row.push("");
    }
  });
  return { issues: issues };
}

/**
 * Identifies and gets the Default Landing Page issues.
 *
 *  @param {obj} config - The config and params for this use case
 *  @param {list[list]} data - The data in the report.
 *
 *  @return {list[str]} issues - A list of issues in the data
 */
function getDefaultLandingPageAlerts(config, data) {
  let issues = [];
  // Add flag column to report headers
  data[0].push(FLAG_COLUMN_HEADER);
  data[0].push(BROKEN_RULES_COLUMN_HEADER);
  data.forEach((row, index) => {
    if (index === 0) {
      // Skip headers
      return;
    }
    const landingPage = row[DLP_LANDING_PAGE_COLUMN - 1];
    // Rule evaluation happens here
    if (landingPage === "http://google.com") {
      // Rule 1: landing page is set to the default value google.com
      let brokenRules = `Rules: [${config.rules[0].ruleName}]`;
      row.push(config.rules[0].ruleType);
      row.push(brokenRules);
      issues.push(row);
    } else {
      // No issues, add an empty string
      row.push("");
      row.push("");
    }
  });

  return { issues: issues };
}

/**
 * Gets Use Case configuration from the sheet and builds a config map
 */
function getUseCasesConfiguration() {
  const useCasesSheet = spreadsheet.getSheetByName(USE_CASES_CONFIG_SHEET_NAME);
  const useCases = useCasesSheet
    .getRange(
      USE_CASES_CONFIG_ROW_START,
      USE_CASES_CONFIG_COL_START,
      useCasesSheet.getLastRow(),
      useCasesSheet.getLastColumn()
    )
    .getValues();
  let useCasesMap = {};
  useCases.forEach((useCaseRow) => {
    const useCaseName = useCaseRow[USE_CASES_CONFIG_NAME_COLUMN];
    if (!useCaseName) {
      return;
    }
    const useCaseThreshold = parseFloat(
      useCaseRow[USE_CASES_CONFIG_THRESHOLD_COLUMN]
    );
    const otherConfigs = getOtherConfigsByUseCase(
      useCaseName,
      useCaseThreshold
    );
    useCasesMap[useCaseName] = { ...otherConfigs };
  });
  return useCasesMap;
}

/**
 * Gets the rules by use case to apply alerts if a rule is met
 *
 *  @param {string} useCase - The error Mitigation use case
 *  @param {float} useCaseThreshold - A threshold for a numeric rule - REVISIT THIS
 *
 */
function getOtherConfigsByUseCase(useCase, useCaseThreshold) {
  const config = {
    [GHOST_PLACEMENTS_KEY]: {
      rules: [
        {
          ruleName: "3PAS Creative Scenario",
          ruleDescription: "3PAS Creative Scenario",
          ruleType: "ISSUE",
          ruleThreshold: null, // no threshold for this rule
          color: "#ea4335",
        },
        {
          ruleName: "Wrapped Tags in DV360",
          ruleDescription: "Wrapped Tags in DV360",
          ruleType: "ISSUE",
          ruleThreshold: null, // no threshold for this rule
          color: "#ea4335",
        },
        {
          ruleName: "Total Conversions > Threshold",
          ruleDescription: "Total Conversions > Threshold",
          ruleType: "ISSUE",
          ruleThreshold: useCaseThreshold,
          color: "#ea4335",
        },
      ],
      flagColumnRange: "L2:L",
      rangeToSort: "A2:M",
      rangeToFilter: "A1:M",
      sortByColumns: [
        { column: GP_PLACEMENT_ID_COLUMN, ascending: true },
        { column: GP_DATE_COLUMN, ascending: true },
      ],
      columnToResize: 13,
      numColsToResize: 1,
    },
    [DEFAULT_ADS_RATE_KEY]: {
      rules: [
        {
          ruleName: "Default Ads Rate > Threshold",
          ruleDescription: "Default Ads Rate > Threshold",
          ruleType: "ISSUE",
          ruleThreshold: useCaseThreshold,
          color: "#ea4335",
        },
      ],
      flagColumnRange: "N2:N",
      rangeToSort: "A2:O",
      rangeToFilter: "A1:O",
      sortByColumns: [
        { column: DA_PLACEMENT_ID_COLUMN, ascending: true },
        { column: DA_DATE_COLUMN, ascending: true },
      ],
      columnToResize: 15,
      numColsToResize: 1,
    },
    [FLOODLIGHT_TRENDS_KEY]: {
      rules: [
        {
          ruleName:
            "For week on week trends flag for more than Threshold variance for floodlight impressions",
          ruleDescription:
            "For week on week trends flag for more than Threshold variance for floodlight impressions",
          ruleType: "ISSUE",
          ruleThreshold: useCaseThreshold,
          color: "#ea4335",
        },
      ],
      flagColumnRange: "G2:G",
      rangeToSort: "A2:H",
      rangeToFilter: "A1:H",
      sortByColumns: [
        { column: FT_WEEK_COLUMN, ascending: false },
        { column: FT_ACTIVITY_ID_COLUMN, ascending: true },
      ],
      columnToResize: 8,
      numColsToResize: 1,
    },
    [OUT_OF_FLIGHT_PLACEMENTS_KEY]: {
      rules: [
        {
          ruleName:
            "Placements with impressions > Threshold out of flight schedule",
          ruleDescription:
            "Placements with impressions > Threshold out of flight schedule",
          ruleType: "ISSUE",
          ruleThreshold: useCaseThreshold,
          color: "#ea4335",
        },
      ],
      flagColumnRange: "M2:M",
      rangeToSort: "A2:N",
      rangeToFilter: "A1:N",
      sortByColumns: [
        { column: OFP_PLACEMENT_ID_COLUMN, ascending: true },
        { column: OFP_DATE_COLUMN, ascending: true },
      ],
      columnToResize: 14,
      numColsToResize: 1,
    },
    [TRACKING_ADS_KEY]: {
      rules: [
        {
          ruleName: "Rule 1: clicks > threshold && impressions < clicks",
          ruleDescription: "Rule 1: clicks > threshold && impressions < clicks",
          ruleType: "ISSUE",
          ruleThreshold: useCaseThreshold,
          color: "#ea4335",
        },
        {
          ruleName: "Rule 2: impressions > 0 and clicks > impressions",
          ruleDescription: "Rule 2: impressions > 0 and clicks > impressions",
          ruleType: "ISSUE",
          ruleThreshold: null, // no threshold for this rule
          color: "#ff6d01",
        },
        {
          ruleName: "Rule 3: clicks > impressions",
          ruleDescription: "Rule 3: clicks > impressions",
          ruleType: "WARNING",
          ruleThreshold: null, // no threshold for this rule
          color: "#FFFFCC",
        },
      ],
      flagColumnRange: "K2:K",
      rangeToSort: "A2:L",
      rangeToFilter: "A1:L",
      sortByColumns: [
        { column: TA_PLACEMENT_ID_COLUMN, ascending: true },
        { column: TA_DATE_COLUMN, ascending: true },
      ],
      columnToResize: 12,
      numColsToResize: 1,
    },
    [DEFAULT_LANDING_PAGE_KEY]: {
      rules: [
        {
          ruleName:
            "Rule 1: landing page is set to the default value: http://google.com",
          ruleDescription:
            "Rule 1: landing page is set to the default value: http://google.com",
          ruleType: "ISSUE",
          ruleThreshold: null, // no threshold for this rule
          color: "#ea4335",
        },
      ],
      flagColumnRange: "J2:J",
      rangeToSort: "A2:K",
      rangeToFilter: "A1:K",
      sortByColumns: [{ column: DLP_DATE_COLUMN, ascending: true }],
      columnToResize: 11,
      numColsToResize: 1,
    },
  };
  return config[useCase];
}