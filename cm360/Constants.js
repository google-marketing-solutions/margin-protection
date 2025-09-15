/**
 * @fileoverview This file contains global constants used throughout the CM360
 * Launch Monitor solution. These constants define configuration values such as
 * sheet names, column indexes, color codes, and API keys, ensuring consistency
 * and ease of maintenance.
 */

//
// Sheet Names
//

/** @const {string} */
const REPORTS_CONFIG_SHEET_NAME = 'Reports Config';

/** @const {string} */
const USE_CASES_CONFIG_SHEET_NAME = 'Use Cases Config';

/** @const {string} */
const GHOST_PLACEMENTS_SHEET_NAME = 'Ghost Placements';

/** @const {string} */
const DEFAULT_ADS_RATE_SHEET_NAME = 'Default Ads Rate';

//
// 'Reports Config' Sheet Column Indexes
//

/** @const {number} */
const REPORTS_CONFIG_ROW_START = 2;

/** @const {number} */
const REPORTS_CONFIG_COL_START = 1;

/** @const {number} */
const REPORTS_CONFIG_USE_CASE_COLUMN = 1;

/** @const {number} */
const REPORTS_CONFIG_PROFILE_ID_COLUMN = 2;

/** @const {number} */
const REPORTS_CONFIG_ACCOUNT_ID_COLUMN = 3;

/** @const {number} */
const REPORTS_CONFIG_REPORT_ID_COLUMN = 4;

/** @const {number} */
const REPORTS_CONFIG_REPORT_DATE_RANGE = 5;

/** @const {number} */
const REPORTS_CONFIG_FILTERS_COLUMN = 6;

/** @const {number} */
const REPORTS_CONFIG_THRESHOLD_COLUMN = 7;

/** @const {number} */
const REPORTS_CONFIG_EXTRA_PARAMS_COLUMN = 8;

/** @const {number} */
const REPORTS_CONFIG_EMAILS_COLUMN = 9;

/** @const {number} */
const REPORTS_CONFIG_EMAIL_MESSAGE_COLUMN = 10;

/** @const {number} */
const REPORTS_CONFIG_ENABLED_COLUMN = 11;

/** @const {number} */
const REPORTS_CONFIG_EXECUTION_STATUS_COLUMN = 12;

/** @const {number} */
const REPORTS_CONFIG_LAST_EXECUTION_COLUMN = 13;

//
// Report Data Sheet Column Indexes
//

/** @const {number} */
const REPORT_DATA_ADVERTISER_COLUMN = 3;

//
// 'Use Cases Config' Sheet Column Indexes
//

/** @const {number} */
const USE_CASES_CONFIG_ROW_START = 2;

/** @const {number} */
const USE_CASES_CONFIG_COL_START = 1;

/** @const {number} */
const USE_CASES_CONFIG_NAME_COLUMN = 0;

/** @const {number} */
const USE_CASES_CONFIG_THRESHOLD_COLUMN = 3;

//
// Other Configurations
//

/** @const {string} */
const RED_RGB_COLOR = '#ea4335';

/** @const {string} */
const BLUE_RGB_COLOR = '#4285f4';

//
// Use Case Keys
//

/** @const {string} */
const GHOST_PLACEMENTS_KEY = 'GHOST_PLACEMENTS';

/** @const {string} */
const DEFAULT_ADS_RATE_KEY = 'DEFAULT_ADS_RATE';

/** @const {string} */
const FLOODLIGHT_TRENDS_KEY = 'FLOODLIGHT_TRENDS';

/** @const {string} */
const OUT_OF_FLIGHT_PLACEMENTS_KEY = 'OUT_OF_FLIGHT_PLACEMENTS';

/** @const {string} */
const TRACKING_ADS_KEY = 'TRACKING_ADS';

/** @const {string} */
const DEFAULT_LANDING_PAGE_KEY = 'DEFAULT_LANDING_PAGE';

//
// General Use Case Alert Headers
//

/** @const {string} */
const WEEK_LABEL_HEADER = 'Week Label';

/** @const {string} */
const FLAG_COLUMN_HEADER = 'Flag';

/** @const {string} */
const BROKEN_RULES_COLUMN_HEADER = 'Rules';

//
// Ghost Placements Alert Column Indexes
//

/** @const {number} */
const GP_DATE_COLUMN = 1;

/** @const {number} */
const GP_ADVERTISER_NAME_COLUMN = 3;

/** @const {number} */
const GP_CAMPAIGN_NAME_COLUMN = 5;

/** @const {number} */
const GP_PLACEMENT_ID_COLUMN = 7;

/** @const {number} */
const GP_PLACEMENT_NAME_COLUMN = 8;

/** @const {number} */
const GP_TOTAL_CONVERSIONS_COLUMN = 11;

//
// Default Ads Rate Alert Column Indexes
//

/** @const {number} */
const DA_DATE_COLUMN = 1;

/** @const {number} */
const DA_PLACEMENT_ID_COLUMN = 7;

/** @const {number} */
const DA_PLACEMENT_NAME_COLUMN = 8;

/** @const {number} */
const DA_AD_TYPE_COLUMN = 11;

/** @const {number} */
const DA_IMPRESSIONS_COLUMN = 12;

/** @const {string} */
const DA_DEFAULT_AD_TYPE = 'Default';

//
// Floodlight Trends Alert Column Indexes
//

/** @const {number} */
const FT_WEEK_COLUMN = 2;

/** @const {number} */
const FT_FLOODLIGHT_CONFIG_COLUMN = 3;

/** @const {number} */
const FT_ACTIVITY_ID_COLUMN = 4;

/** @const {number} */
const FT_ACTIVITY_NAME_COLUMN = 5;

/** @const {number} */
const FT_FLOODLIGHT_IMPRESSIONS_COLUMN = 6;

//
// Out of Flight Placements Alert Column Indexes
//

/** @const {number} */
const OFP_DATE_COLUMN = 1;

/** @const {number} */
const OFP_PLACEMENT_ID_COLUMN = 7;

/** @const {number} */
const OFP_PLACEMENT_END_DATE_COLUMN = 10;

/** @const {number} */
const OFP_IMPRESSIONS_COLUMN = 11;

//
// Tracking Ads Alert Column Indexes
//

/** @const {number} */
const TA_DATE_COLUMN = 1;

/** @const {number} */
const TA_PLACEMENT_ID_COLUMN = 7;

/** @const {number} */
const TA_PLACEMENT_NAME_COLUMN = 8;

/** @const {number} */
const TA_IMPRESSIONS_COLUMN = 9;

/** @const {number} */
const TA_CLICKS_COLUMN = 10;

//
// Default Landing Page Alert Column Indexes
//

/** @const {number} */
const DLP_DATE_COLUMN = 1;

/** @const {number} */
const DLP_LANDING_PAGE_COLUMN = 8;
