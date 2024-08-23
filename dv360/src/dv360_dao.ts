import { google, displayvideo_v3} from 'googleapis';
import {BodyResponseCallback} from 'googleapis-common';
import {ClientInterface} from './types';
import {GaxiosPromise} from 'gaxios';

let client: displayvideo_v3.Displayvideo;

function getClient(): displayvideo_v3.Displayvideo {
  if (!client) {
    client = google.displayvideo({
      version: 'v3',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      },
    });
  }
  return client;
}

export function Start<T extends RequestFunction<T, R>, R>(f: T) {
    return (callback: Function) {
  do {
    let retries = 0;
    try {
      let result = await f({
        targetingType: 'TARGETING_TYPE_GEO_REGION',
      });
      nextToken = result.data.nextPageToken;
      callback(result.data.assignedTargetingOptions);
    } catch (e) {
      console.error(e);
      if (++retries <= 3) {
        console.log(`retrying ${retries}/3`);
      } else {
        break;
      }
    }
  } while (nextToken);
    }
}

export async function targetingOptionsList(
  callback: (result: displayvideo_v3.Schema$AssignedTargetingOption[]) => void,
) {
  let nextToken: string | null = null;
  const targetingOptionsApi =
    getClient().advertisers.adGroups.targetingTypes.assignedTargetingOptions;
  do {
    let retries = 0;
    try {
      let result = await targetingOptionsApi.list({
        targetingType: 'TARGETING_TYPE_GEO_REGION',
      });
      nextToken = result.data.nextPageToken;
      callback(result.data.assignedTargetingOptions);
    } catch (e) {
      console.error(e);
      if (++retries <= 3) {
        console.log(`retrying ${retries}/3`);
      } else {
        break;
      }
    }
  } while (nextToken);
}

export async function paginationHandler<T extends RequestFunction<T, R>, R extends ResultPayload<R>>(request: T, parameters: Parameters<T>, callback: (response: R) => void) {
    let nextPageToken: string | null;

    do {
        const currentRequest = (await request(parameters, nextPageToken)).data;
        nextPageToken = currentRequest.nextPageToken;
        
        callback(currentRequest.data);
    } while (nextPageToken);
}

interface Response {
    nextPageToken?: string | null;
}

interface RequestFunction<T extends RequestFunction<T, R>, R extends ResultPayload<R>> {
    (
    ...options: any[],
    ): R extends void ? never : GaxiosPromise<R>;
}

interface ResultPayload<T> {
    data: T;
    nextPageToken?: string|null;
}