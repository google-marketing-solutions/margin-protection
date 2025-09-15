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

const DEFAULT_SLEEP = 8 * 1000;
const DEFAULT_RETRIES = 4;
const REPORT_AVAILABLE_STATUS = 'REPORT_AVAILABLE';

/**
 * Wrapper for the Campaign Manager 360 API.
 */
class CampaignManagerAPI {
  /**
   * @param {string} profileId The Campaign Manager 360 user profile ID.
   */
  constructor(profileId) {
    this.profileId = profileId;
  }

  /**
   * Fetches items from Campaign Manager 360 and handles pagination to retrieve
   * all pages.
   *
   * @param {string} entity The name of the Campaign Manager 360 API entity
   *     (e.g., 'reports').
   * @param {?string} secondEntity The name of a second-level entity (e.g.,
   *     'files' for reports). Can be null.
   * @param {string} listName The name of the list property in the API response
   *     that contains the items (e.g., 'items').
   * @param {!Object} options Additional options to be passed to the list API
   *     call.
   * @return {!Array<!Object>} An array with all items that match the specified
   *     search.
   */
  fetchAll(entity, secondEntity, listName, options) {
    // First API call
    let response = _retry(
      this.fetch,
      DEFAULT_RETRIES,
      DEFAULT_SLEEP,
      entity,
      secondEntity,
      options,
      this.profileId,
    );
    let result = [];
    while (response && response[listName] && response[listName].length > 0) {
      result = result.concat(response[listName]);
      // Iterate until there is no page token returned
      if (response.nextPageToken) {
        // As long as we provide filters in later API list request along with the pageToken, It works fine in v4.
        let nextRequestOptions = {
          pageToken: response.nextPageToken,
          ...options,
        };
        // Next page token call
        response = _retry(
          this.fetch,
          DEFAULT_RETRIES,
          DEFAULT_SLEEP,
          entity,
          secondEntity,
          nextRequestOptions,
          this.profileId,
        );
      } else {
        response = null;
      }
    }
    return result;
  }

  /**
   * Fetches a single page of items from Campaign Manager 360.
   *
   * @param {string} entity The name of the Campaign Manager 360 API entity.
   * @param {?string} secondEntity The name of a second Campaign Manager 360 API
   *     entity. Can be null.
   * @param {!Object} options Additional options to be passed to the list API
   *     call.
   * @param {string} profileId The Campaign Manager 360 user profile ID.
   * @return {!Object} The API response.
   */
  fetch(entity, secondEntity, options, profileId) {
    if (!secondEntity) {
      // For Entities such as accounts, campaigns, etc
      return DoubleClickCampaigns[entity].list(profileId, options);
    } else {
      // For reports
      return DoubleClickCampaigns[entity][secondEntity].list(
        profileId,
        options,
      );
    }
  }

  /**
   * Lists items from Campaign Manager 360, handling pagination to fetch all
   * items.
   *
   * @param {string} entity The name of the Campaign Manager 360 API entity.
   * @param {?string} secondEntity The name of a second Campaign Manager 360 API
   *     entity (e.g., 'Files' for 'Reports'). Can be null.
   * @param {string} listName Name of the list property in the API response.
   * @param {!Object} options Additional options to be passed to the list API
   *     call.
   * @return {!Array<!Object>} An array with all items that match the specified
   *     search.
   */
  list(entity, secondEntity, listName, options) {
    return this.fetchAll(entity, secondEntity, listName, options);
  }

  /**
   * Gets the latest available report file for a given report ID by polling the
   * API until the report is ready.
   *
   * @param {string} reportId The ID of the report in CM360.
   * @return {?Object} The latest report file object, or null if it times out.
   */
  getLatestReportFile(reportId) {
    let sleepDuration = 2;
    while (true) {
      const response = DoubleClickCampaigns.Reports.Files.list(
        this.profileId,
        reportId,
      );
      const latestReportFile =
        response.items.length > 0 ? response.items[0] : null;
      //Status of the report, could be processing or ready
      if (
        latestReportFile &&
        latestReportFile.status === REPORT_AVAILABLE_STATUS
      ) {
        Logger.log(`The report ${reportId} is available!`);
        return latestReportFile;
      } else {
        // maximum allowed value
        // Use exponential backoff to wait and retry until report is ready
        Logger.log(`Waiting for report ${reportId} to be ready...`);
        // Return close to the maximum allowed value for the sleep function
        if (sleepDuration * 1000 >= 64000) {
          Logger.log(
            'Stop waiting for report to avoid execution time limit errors...',
          );
          return;
        }
        Utilities.sleep(sleepDuration * 1000);
        sleepDuration = sleepDuration ** 2;
      }
    }
  }

  /**
   * Downloads report data from the API's redirect URL.
   *
   * @param {!Object} latestReportFile The report file object from
   *     `getLatestReportFile`.
   * @return {!Object} The parsed report data.
   */
  getLatestReportFileDataByRedirectURL(latestReportFile) {
    let options = {
      method: 'GET',
    };
    const reportResponse = apiCall('', options, latestReportFile.urls.apiUrl);
    Logger.log(`Retrieving data for report ${latestReportFile['reportId']}...`);
    return reportResponse;
  }

  /**
   * Creates and runs a Campaign Manager 360 report based on a predefined use
   * case.
   *
   * @param {string} useCase The Margin Protection use case key.
   * @param {string} dateRange The relative date range for the report (e.g.,
   *     'LAST_7_DAYS').
   * @param {string} filters A semi-colon delimited string of filters to apply.
   *     Format: 'filterName1=value1,value2;filterName2=value3'. Currently only
   *     'advertiserId' is supported.
   * @param {?string} extraParams Any extra parameters required for the use case
   *     (e.g., floodlightConfigId).
   * @return {!Object} The newly created report resource.
   */
  createAndRunReport(useCase, dateRange, filters, extraParams) {
    const dimensionFilters = this.buildReportDimensionFilters(filters);
    const reportBody = this.buildReportSchemaByUseCase(
      useCase,
      dateRange,
      dimensionFilters,
      extraParams,
    );
    const report = DoubleClickCampaigns.Reports.insert(
      reportBody,
      this.profileId,
    );
    DoubleClickCampaigns.Reports.run(this.profileId, report['id']);
    return report;
  }

  /**
   * Builds Campaign Manager 360 report dimension filters from a filter string.
   *
   * @param {string} filters A semi-colon delimited string of filters. Format:
   *     'filterName1=value1,value2;filterName2=value3'. Currently, only
   *     'advertiserId' is supported.
   * @return {!Array<!Object>} The dimension filters object for the new report.
   */
  buildReportDimensionFilters(filters) {
    const filterItems = filters.split(';');
    let dimensionFilters = [];
    filterItems.forEach((filter) => {
      if (!filter) {
        return;
      }
      const sFItems = filter.split('=');
      const dimensionName = sFItems.length > 0 ? sFItems[0] : '';
      // Check if dimension filter is supported
      if (!this.isDimensionFilterSupported(dimensionName)) {
        Logger.log(
          `Dimension filter not supported. Skipping ${dimensionName} dimension filter.`,
        );
        return;
      }
      // Add each value as a dimension filter
      const values = sFItems.length > 1 ? sFItems[1].split(',') : [];
      values.forEach((value) => {
        if (!value) {
          return;
        }
        dimensionFilters.push({
          dimensionName: dimensionName,
          value: value.trim(),
          matchType: 'EXACT',
          kind: 'dfareporting#dimensionValue',
        });
      });
    });
    return dimensionFilters;
  }

  /**
   * Checks if a dimension filter is supported.
   *
   * @param {string} dimensionName The name of the dimension filter.
   * @return {boolean} True if the dimension filter is supported, false
   *     otherwise.
   */
  isDimensionFilterSupported(dimensionName) {
    const supportedFilters = ['advertiserId'];
    const dimensionFound = supportedFilters.filter(
      (item) => item === dimensionName,
    );
    return dimensionFound && dimensionFound.length > 0;
  }

  /**
   * Builds the schema for a new report in Campaign Manager 360 based on a use
   * case.
   *
   * @param {string} useCase The Margin Protection use case key.
   * @param {string} dateRange The relative date range for the report.
   * @param {!Array<!Object>} dimensionFilters The dimension filters to apply.
   * @param {?string} extraParams Any extra parameters required for the use
   *     case.
   * @return {?Object} The CM360 report schema, or null if the use case is not
   *     found.
   */
  buildReportSchemaByUseCase(
    useCase,
    dateRange,
    dimensionFilters,
    extraParams,
  ) {
    const useCaseSchemas = {
      [GHOST_PLACEMENTS_KEY]: {
        type: 'STANDARD',
        name: `CM360 ${useCase} Monitor Report`,
        criteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'date',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiserId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiser',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaignId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaign',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'site',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placement',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['impressions', 'clicks', 'totalConversions'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
      [DEFAULT_ADS_RATE_KEY]: {
        type: 'STANDARD',
        name: `CM360 ${useCase} Monitor Report`,
        criteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'date',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiserId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiser',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaignId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaign',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'site',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placement',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'adId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'ad',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'adType',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['impressions', 'clicks'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
      [FLOODLIGHT_TRENDS_KEY]: {
        type: 'FLOODLIGHT',
        name: `CM360 ${useCase} Monitor Report`,
        floodlightCriteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          floodlightConfigId: {
            kind: 'dfareporting#dimensionValue',
            dimensionName: 'floodlightConfigId',
            value: extraParams,
            matchType: 'EXACT',
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'week',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'floodlightConfigId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'activityId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'activity',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['floodlightImpressions'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
      [OUT_OF_FLIGHT_PLACEMENTS_KEY]: {
        type: 'STANDARD',
        name: `CM360 ${useCase} Monitor Report`,
        criteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'date',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiserId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiser',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaignId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaign',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'site',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placement',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementStartDate',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementEndDate',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['impressions', 'clicks'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
      [TRACKING_ADS_KEY]: {
        type: 'STANDARD',
        name: `CM360 ${useCase} Monitor Report`,
        criteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'date',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiserId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiser',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaignId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaign',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'site',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placement',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['impressions', 'clicks'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
      [DEFAULT_LANDING_PAGE_KEY]: {
        type: 'STANDARD',
        name: `CM360 ${useCase} Monitor Report`,
        criteria: {
          dateRange: {
            kind: 'dfareporting#dateRange',
            relativeDateRange: dateRange,
          },
          dimensions: [
            {
              kind: 'fareporting#sortedDimension',
              name: 'date',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiserId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'advertiser',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaignId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'campaign',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placementId',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'placement',
            },
            {
              kind: 'fareporting#sortedDimension',
              name: 'landingPageUrl',
            },
          ],
          dimensionFilters: dimensionFilters,
          metricNames: ['clicks'],
        },
        schedule: {
          active: true,
          repeats: 'WEEKLY',
          every: 1,
          repeatsOnWeekDays: 'MONDAY',
          startDate: '2023-05-10',
          expirationDate: '2050-05-10',
        },
      },
    };
    return useCaseSchemas[useCase];
  }
}
