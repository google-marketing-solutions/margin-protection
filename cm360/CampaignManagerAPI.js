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

class CampaignManagerAPI {

  constructor(profileId){
    this.profileId = profileId;
  }

  /**
   * Fetches items from Campaign Manager 360 based on the provided parameters and handles 
   * pagination by fetching all pages. This uses the list method of the API.
   *
   *  @param {string} entity - The name of the Campaign Manager 360 API entity.
   *  @param {string} listName - Name of the list returned by the API.
   *  @param {obj} options - Additional options to be passed to the list API call.
   *
   *  @return {array[obj]} result - Array with all items that match the specified search.
   */
  fetchAll(entity, secondEntity, listName, options) {
    // First API call
    let response = _retry(this.fetch, DEFAULT_RETRIES, DEFAULT_SLEEP, entity, secondEntity, options, this.profileId);
    let result = [];
    while (response && response[listName] && response[listName].length > 0) {
      result = result.concat(response[listName]);
      // Iterate until there is no page token returned
      if (response.nextPageToken) {
        // As long as we provide filters in later API list request along with the pageToken, It works fine in v4.
        let nextRequestOptions = {'pageToken': response.nextPageToken, ...options};
        // Next page token call
        response = _retry(this.fetch, DEFAULT_RETRIES, DEFAULT_SLEEP, entity, secondEntity, nextRequestOptions, this.profileId);
      } else {
        response = null;
      }
    }
    return result;
  }

  /**
   * Fetches items from Campaign Manager 360 based on the provided parameters and handles 
   * pagination by fetching all pages. This uses the list method of the API.
   *
   *  @param {string} entity - The name of the Campaign Manager 360 API entity.
   *  @param {string} listName - Name of the list returned by the API.
   *  @param {obj} options - Additional options to be passed to the list API call.
   *
   *  @return {array[obj]} result - Array with all items that match the specified search.
   */
  fetch(entity, secondEntity, options, profileId) {
    if(!secondEntity) {
      // For Entities such as accounts, campaigns, etc
      return DoubleClickCampaigns[entity].list(profileId, options);
    } else {
      // For reports
      return DoubleClickCampaigns[entity][secondEntity].list(profileId, options);
     }
  }

  /**
   * List items from Campaign Manager 360 based on the provided parameters.
   *
   *  @param {string} entity - The name of the Campaign Manager 360 API entity.
   *  @param {string} secondEntity - The name of a second Campaign Manager 360 API entity 
   *  (this is for getting report files i.e. Reports.Files).
   *  @param {string} listName - Name of the list returned by the API.
   *  @param {obj} options - Additional options to be passed to the list API call.
   *
   *  @return {array[obj]} - Array with all items that match the specified search.
   **/
  list(entity, secondEntity, listName, options) {
    return this.fetchAll(entity, secondEntity, listName, options);
  }

  /**
   * Gets the latest run report by report id from Campaign Manager 360.
   * 
   *  @param {string} reportId - The id of the report in CM360.
   *  
   *  @return {obj} latestReportFile - The latest report file in the report.
   **/
  getLatestReportFile(reportId) {
    let sleepDuration = 2;
    while(true) {
      const response = DoubleClickCampaigns.Reports.Files.list(this.profileId, reportId);
      const latestReportFile = response.items.length > 0 ? response.items[0] : null;
      //Status of the report, could be processing or ready
      if (latestReportFile && latestReportFile.status === REPORT_AVAILABLE_STATUS) {
        Logger.log(`The report ${reportId} is available!`);
        return latestReportFile
      } else { // maximum allowed value
        // Use exponential backoff to wait and retry until report is ready
        Logger.log(`Waiting for report ${reportId} to be ready...`);
        // Return close to the maximum allowed value for the sleep function
        if(sleepDuration * 1000 >= 64000) {
          Logger.log('Stop waiting for report to avoid execution time limit errors...');
          return
        }
        Utilities.sleep(sleepDuration * 1000);
        sleepDuration = sleepDuration ** 2;
      }
    }
  }

  /**
   * Gets the latest run report by report id from Campaign Manager 360
   * using the redirect URL retrieved by the API.
   * 
   *  @param {obj} latestReportFile - The latest report file in the report.
   * 
   *  @return {obj} reportResponse - The latest report file data.
   **/
  getLatestReportFileDataByRedirectURL(latestReportFile) {
    let options = {
      'method' : 'GET'
    };
    const reportResponse = apiCall('', options, latestReportFile.urls.apiUrl);
    Logger.log(`Retrieving data for report ${latestReportFile['reportId']}...`);
    return reportResponse;
  }

  /**
   * Creates and runs a Campaign Manager 360 report.
   * 
   *  @param {string} useCase - The Margin Protection use case
   *  @param {string} dateRange - The date range of the report
   *  @param {list} filters - A list of filters to be applied to the report
   *  @param {obj} extraParams - Any extra params that are required for the use case
   *  For now, only the 'advertiserId' filter is supported.
   *  Format for the filters: advertiserId=123,456,789;otherFilter=334,5566
   * 
   *  @return {obj} report - The newly created report.
   */
  createAndRunReport(useCase, dateRange, filters, extraParams) {
    const dimensionFilters = this.buildReportDimensionFilters(filters);
    const reportBody = this.buildReportSchemaByUseCase(useCase, dateRange, dimensionFilters, extraParams);
    const report = DoubleClickCampaigns.Reports.insert(reportBody, this.profileId);
    DoubleClickCampaigns.Reports.run(this.profileId, report['id']);
    return report
  }

  /**
   * Builds a Campaign Manager 360 report dimension filters based on the 
   * provided user input in the Reports Config tab.
   * 
   * @param {list} filters - A list of filters to be applied to the report.
   * For now, only the 'advertiserId' is supported.
   * Format for the filters: advertiserId=123,456,789;otherFilter=334,5566
   * 
   * @return {obj} dimensionFilters - The dimension filters object for the new report
   */
  buildReportDimensionFilters(filters){
    const filterItems = filters.split(';');
    let dimensionFilters = [];
    filterItems.forEach(filter => {
      if (!filter) {
        return
      }
      const sFItems = filter.split('=');
      const dimensionName = (sFItems.length > 0) ? sFItems[0] : '';
      // Check if dimension filter is supported
      if(!this.isDimensionFilterSupported(dimensionName)) {
        Logger.log(`Dimension filter not supported. Skipping ${dimensionName} dimension filter.`);
        return
      }
      // Add each value as a dimension filter
      const values = (sFItems.length > 1) ? sFItems[1].split(',') : [];
      values.forEach(value => {
        if (!value) {
          return
        }
        dimensionFilters.push( {
          "dimensionName": dimensionName,
          "value": value.trim(),
          "matchType": 'EXACT',
          "kind": 'dfareporting#dimensionValue',
        })
      });
    })
    return dimensionFilters
  }

  /**
  * Checks if a dimension filter is supported.
  * 
  *   @param {string} dimensionName - The name of the dimension filter
  *   @return {boolean} - True if the dimension filter is supported, false otherwise.
  */
  isDimensionFilterSupported(dimensionName) {
    const supportedFilters = ['advertiserId'];
    const dimensionFound = supportedFilters.filter(item => item === dimensionName);
    return dimensionFound && dimensionFound.length > 0
  }

  /**
  * Builds the schema for a new report in Campaign Manager 360
  * using the provided dimensionFilters. For now, only dimension filters 
  * (advertiserId) are supported. 
  * 
  *   @param {string} useCase - The Margin Protection use case
  *   @param {string} dateRange - The date range of the report
  *   @param {obj} dimensionFilters - The dimension filters object for the new report
  *   @param {obj} extraParams - Any extra params that are required for the use case
  *
  *   @return {obj} - The CM360 report schema
  */
  buildReportSchemaByUseCase(useCase, dateRange, dimensionFilters, extraParams) {
    const useCaseSchemas = {
      [GHOST_PLACEMENTS_KEY] : {
        'type': 'STANDARD',
        'name': `CM360 ${useCase} Monitor Report`,
        'criteria': {
          'dateRange': {
            'kind': 'dfareporting#dateRange',
            'relativeDateRange': dateRange
          },
          'dimensions': [
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'date'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiserId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiser'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaignId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaign'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'site'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placement'
            }
          ],
          'dimensionFilters': dimensionFilters,
          'metricNames': [
            'impressions',
            'clicks',
            'totalConversions'
          ]
        },
        'schedule': {
          'active': true,
          'repeats': 'WEEKLY',
          'every': 1,
          'repeatsOnWeekDays': 'MONDAY',
          'startDate': '2023-05-10',
          'expirationDate': '2050-05-10'
        }
      },
      [DEFAULT_ADS_RATE_KEY] : {
        'type': 'STANDARD',
        'name': `CM360 ${useCase} Monitor Report`,
        'criteria': {
          'dateRange': {
            'kind': 'dfareporting#dateRange',
            'relativeDateRange': dateRange
          },
          'dimensions': [
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'date'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiserId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiser'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaignId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaign'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'site'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placement'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'adId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'ad'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'adType'
            }
          ],
          'dimensionFilters': dimensionFilters,
          'metricNames': [
            'impressions',
            'clicks'
          ]
        },
        'schedule': {
          'active': true,
          'repeats': 'WEEKLY',
          'every': 1,
          'repeatsOnWeekDays': 'MONDAY',
          'startDate': '2023-05-10',
          'expirationDate': '2050-05-10'
        }
      },
      [FLOODLIGHT_TRENDS_KEY] : {
        'type': 'FLOODLIGHT',
        'name': `CM360 ${useCase} Monitor Report`,
        'floodlightCriteria': {
          'dateRange': {
            'kind': 'dfareporting#dateRange',
            'relativeDateRange': dateRange
          },
          'floodlightConfigId': {
            'kind': 'dfareporting#dimensionValue',
            'dimensionName': 'floodlightConfigId',
            'value': extraParams,
            'matchType': 'EXACT',
          },
          'dimensions': [
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'week'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'floodlightConfigId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'activityId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'activity'
            }
          ],
          'dimensionFilters': dimensionFilters,
          'metricNames': [
            'floodlightImpressions'
          ]
        },
        'schedule': {
          'active': true,
          'repeats': 'WEEKLY',
          'every': 1,
          'repeatsOnWeekDays': 'MONDAY',
          'startDate': '2023-05-10',
          'expirationDate': '2050-05-10'
        }
      },
      [OUT_OF_FLIGHT_PLACEMENTS_KEY] : {
        'type': 'STANDARD',
        'name': `CM360 ${useCase} Monitor Report`,
        'criteria': {
          'dateRange': {
            'kind': 'dfareporting#dateRange',
            'relativeDateRange': dateRange
          },
          'dimensions': [
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'date'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiserId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiser'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaignId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaign'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'site'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placement'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementStartDate'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementEndDate'
            }
          ],
          'dimensionFilters': dimensionFilters,
          'metricNames': [
            'impressions',
            'clicks'
          ]
        },
        'schedule': {
          'active': true,
          'repeats': 'WEEKLY',
          'every': 1,
          'repeatsOnWeekDays': 'MONDAY',
          'startDate': '2023-05-10',
          'expirationDate': '2050-05-10'
        }
      },
      [TRACKING_ADS_KEY]: {
        'type': 'STANDARD',
        'name': `CM360 ${useCase} Monitor Report`,
        'criteria': {
          'dateRange': {
            'kind': 'dfareporting#dateRange',
            'relativeDateRange': dateRange
          },
          'dimensions': [
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'date'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiserId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'advertiser'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaignId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'campaign'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'site'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placementId'
            },
            {
              'kind': 'fareporting#sortedDimension',
              'name': 'placement'
            }
          ],
          'dimensionFilters': dimensionFilters,
          'metricNames': [
            'impressions',
            'clicks'
          ]
        },
        'schedule': {
          'active': true,
          'repeats': 'WEEKLY',
          'every': 1,
          'repeatsOnWeekDays': 'MONDAY',
          'startDate': '2023-05-10',
          'expirationDate': '2050-05-10'
        }
      },
    }
    return useCaseSchemas[useCase]
  }
}