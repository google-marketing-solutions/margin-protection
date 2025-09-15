/**
 * @license
 * Copyright 2024 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file defines the specific report structures for the SA360
 * Launch Monitor. It leverages the generic `makeReport` factory function from
 * the `common/ads_api` module to create several pre-defined report
 * configurations.
 */

import { makeReport } from 'common/ads_api';
import { buildQuery } from 'common/ads_api_types';

/**
 * A report that fetches basic information about campaigns, including their
 * status and customer details.
 */
export const CAMPAIGN_REPORT = makeReport({
  output: [
    'customerId',
    'customerName',
    'campaignId',
    'campaignName',
    'campaignStatus',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'campaign.name',
      'campaign.status',
    ] as const,
    queryFrom: 'campaign',
  }),

  transform(result) {
    return [
      result.campaign.id as string,
      {
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        campaignName: result.campaign.name as string,
        campaignStatus: result.campaign.status as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches basic information about ad groups, including their
 * status and associated campaign and customer details.
 */
export const AD_GROUP_REPORT = makeReport({
  output: [
    'customerId',
    'customerName',
    'campaignId',
    'adGroupId',
    'adGroupName',
    'adGroupStatus',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'ad_group.id',
      'ad_group.name',
      'ad_group.status',
    ],
    queryFrom: 'ad_group',
  }),
  transform(result) {
    return [
      result.adGroup.id as string,
      {
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        adGroupId: result.adGroup.id as string,
        adGroupName: result.adGroup.name as string,
        adGroupStatus: result.adGroup.status as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches details about geographic target constants, such as
 * their canonical name and country code.
 */
export const GEO_TARGET_REPORT = makeReport({
  output: ['location'],
  query: buildQuery({
    queryParams: [
      'geo_target_constant.resource_name',
      'geo_target_constant.country_code',
      'geo_target_constant.id',
      'geo_target_constant.canonical_name',
    ],
    queryFrom: 'geo_target_constant',
  }),

  transform(result) {
    return [
      result.geoTargetConstant.id as string,
      {
        location: result.geoTargetConstant.canonicalName as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches location targeting information at the campaign level.
 * It joins with the `GEO_TARGET_REPORT` to resolve the location's canonical
 * name.
 */
export const CAMPAIGN_TARGET_REPORT = makeReport({
  output: [
    'criterionId',
    'customerId',
    'customerName',
    'campaignId',
    'location',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'campaign.name',
      'campaign_criterion.criterion_id',
    ],
    queryFrom: 'campaign_criterion',
    joins: {
      'campaignCriterion.criterionId': GEO_TARGET_REPORT,
    },
  }),
  transform(result, joins) {
    return [
      result.campaignCriterion.criterionId as string,
      {
        criterionId: result.campaignCriterion.criterionId as string,
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        location: joins['campaignCriterion.criterionId'][
          result.campaignCriterion.criterionId as string
        ]?.location as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches age range targeting information from the
 * `age_range_view`.
 */
export const AGE_TARGET_REPORT = makeReport({
  output: [
    'criterionId',
    'customerId',
    'customerName',
    'campaignId',
    'adGroupId',
    'ageRange',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'ad_group.id',
      'ad_group_criterion.age_range.type',
      'ad_group_criterion.criterion_id',
    ],
    queryFrom: 'age_range_view',
  }),

  transform(result) {
    return [
      result.adGroupCriterion.criterionId as string,
      {
        criterionId: result.adGroupCriterion.criterionId as string,
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        adGroupId: result.adGroup.id as string,
        ageRange: result.adGroupCriterion.ageRange.type as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches gender targeting information from the `gender_view`.
 */
export const GENDER_TARGET_REPORT = makeReport({
  output: [
    'criterionId',
    'customerId',
    'customerName',
    'campaignId',
    'adGroupId',
    'gender',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'ad_group.id',
      'ad_group_criterion.gender.type',
      'ad_group_criterion.criterion_id',
    ],
    queryFrom: 'gender_view',
  }),

  transform(result) {
    return [
      result.adGroupCriterion.criterionId as string,
      {
        criterionId: result.adGroupCriterion.criterionId as string,
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        adGroupId: result.adGroup.id as string,
        gender: result.adGroupCriterion.gender.type as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches details about user lists, including their name and
 * type.
 */
export const USER_LIST_REPORT = makeReport({
  output: ['userListName', 'userListType'],
  query: buildQuery({
    queryParams: [
      'user_list.resource_name',
      'user_list.name',
      'user_list.type',
      'user_list.id',
    ],
    queryFrom: 'user_list',
  }),
  transform(result) {
    return [
      result.userList.resourceName as string,
      {
        userListName: result.userList.name as string,
        userListType: result.userList.type as string,
      },
    ] as const;
  },
});

/**
 * A report that fetches user list (audience) targeting information at the
 * campaign level. It joins with the `USER_LIST_REPORT` to resolve the user
 * list's name.
 */
export const CAMPAIGN_USER_LIST_REPORT = makeReport({
  output: [
    'criterionId',
    'customerId',
    'customerName',
    'campaignId',
    'userListName',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'campaign_criterion.resource_name',
      'campaign_criterion.user_list.user_list',
      'campaign_criterion.type',
      'campaign_criterion.criterion_id',
    ],
    queryFrom: 'campaign_audience_view',
    joins: {
      'campaignCriterion.userList.userList': USER_LIST_REPORT,
    },
    queryWheres: ['campaign_criterion.type = "USER_LIST"'],
  }),
  transform(result, joins) {
    const userList =
      joins['campaignCriterion.userList.userList'][
        result.campaignCriterion.userList.userList as string
      ];
    return [
      result.campaignCriterion.criterionId as string,
      {
        criterionId: result.campaignCriterion.criterionId as string,
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        userListName: userList.userListName,
      },
    ];
  },
});

/**
 * A report that fetches user list (audience) targeting information at the ad
 * group level. It joins with the `USER_LIST_REPORT` to resolve the user list's
 * name.
 */
export const AD_GROUP_USER_LIST_REPORT = makeReport({
  output: [
    'criterionId',
    'customerId',
    'customerName',
    'campaignId',
    'adGroupId',
    'userListName',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.resource_name',
      'campaign.id',
      'ad_group.id',
      'ad_group_criterion.resource_name',
      'ad_group_criterion.user_list.user_list',
      'ad_group_criterion.type',
      'ad_group_criterion.criterion_id',
    ],
    queryFrom: 'ad_group_audience_view',
    joins: {
      'adGroupCriterion.userList.userList': USER_LIST_REPORT,
    },
    queryWheres: ['ad_group_criterion.type = "USER_LIST"'],
  }),
  transform(result, joins) {
    const userList =
      joins['adGroupCriterion.userList.userList'][
        result.adGroupCriterion.userList.userList as string
      ];
    return [
      result.adGroupCriterion.criterionId as string,
      {
        criterionId: result.adGroupCriterion.criterionId as string,
        customerId: result.customer.id as string,
        customerName: result.customer.resourceName as string,
        campaignId: result.campaign.id as string,
        adGroupId: result.adGroup.id as string,
        userListName: userList.userListName,
      },
    ] as const;
  },
});

/**
 * A report that fetches campaign performance metrics, specifically focusing on
 * budget and spend (`cost_micros`).
 */
export const CAMPAIGN_PACING_REPORT = makeReport({
  output: ['campaignId', 'campaignName', 'budget', 'spend'],
  query: buildQuery({
    queryParams: [
      'campaign.id',
      'campaign.name',
      'campaign_budget.amount_micros',
      'campaign.status',
      'campaign.advertising_channel_type',
      'metrics.cost_micros',
    ],
    queryFrom: 'campaign',
    queryWheres: ["campaign.status = 'ENABLED'"],
  }),
  transform(result) {
    return [
      result.campaign.id as string,
      {
        campaignId: result.campaign.id as string,
        campaignName: result.campaign.name as string,
        budget: result.campaignBudget.amountMicros as string,
        spend: (result.metrics?.costMicros ?? '') as string,
      },
    ];
  },
});
