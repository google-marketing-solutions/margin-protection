/**
 * @license
 * Copyright 2025 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { generateTestClient, AdvertiserTemplateConverter, CampaignTemplateConverter, InsertionOrderTemplateConverter } from './client_helpers';
import { IDType } from '../types';
import { mockAppsScript } from 'common/test_helpers/mock_apps_script';

describe('Client Helpers', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  describe('generateTestClient for Partner View', () => {
    it('should include advertiserName in campaign objects', async () => {
      // ARRANGE
      const allAdvertisers: Record<string, AdvertiserTemplateConverter[]> = {
        'adv1': [(adv) => {
          adv.id = 'adv1';
          adv.displayName = 'Test Advertiser 1';
          return adv;
        }],
      };

      const allCampaigns: Record<string, CampaignTemplateConverter[]> = {
        'adv1': [(campaign) => {
          campaign.id = 'camp1';
          campaign.advertiserId = 'adv1';
          return campaign;
        }],
      };

      const allInsertionOrders: Record<string, InsertionOrderTemplateConverter[]> = {
        'adv1': [(io) => {
          io.campaignId = 'camp1';
          return io;
        }],
      };

      const client = generateTestClient({
        id: 'partner1',
        clientArgs: { id: 'partner1', idType: IDType.PARTNER, label: 'Test' },
        allAdvertisers,
        allCampaigns,
        allInsertionOrders,
      });

      sinon.stub(client, 'getAllAdvertisersForPartner').returns([
        { advertiserId: 'adv1', advertiserName: 'Test Advertiser 1' },
      ]);

      // ACT
      const campaigns = await client.getAllCampaigns();

      // ASSERT
      expect(campaigns).to.have.lengthOf(1);
      expect(campaigns[0]).to.have.property('advertiserName', 'Test Advertiser 1');
    });
  });

  describe('generateTestClient for Advertiser View', () => {
    it('should NOT include advertiserName in campaign objects', async () => {
      // ARRANGE
      const allCampaigns: Record<string, CampaignTemplateConverter[]> = {
        'adv1': [(campaign) => {
          campaign.id = 'camp1';
          campaign.advertiserId = 'adv1';
          return campaign;
        }],
      };

      const allInsertionOrders: Record<string, InsertionOrderTemplateConverter[]> = {
        'adv1': [(io) => {
          io.campaignId = 'camp1';
          return io;
        }],
      };

      const client = generateTestClient({
        id: 'adv1',
        clientArgs: { id: 'adv1', idType: IDType.ADVERTISER, label: 'Test' },
        allCampaigns,
        allInsertionOrders,
      });

      // ACT
      const campaigns = await client.getAllCampaigns();

      // ASSERT
      expect(campaigns).to.have.lengthOf(1);
      expect(campaigns[0]).not.to.have.property('advertiserName');
    });
  });
});
