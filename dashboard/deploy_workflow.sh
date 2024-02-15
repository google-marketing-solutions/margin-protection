#!/bin/bash

#################################################
# Copyright 2023 Google.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#################################################

###
# Enable strict mode. Fail if anything fails.
###
set -euxo pipefail


###
# Set the name of the service account to create
###
SERVICE_ACCOUNT=performance-monitor-manager

###
# Set the name of the project to use (blank by default).
###
PROJECT_ID=

###
# Set the name of the dataset. Changing this may break Looker Studio reports.
###
DATASET_ID=performance_monitor

###
# Set the shared Drive ID for launch_monitor where reports live.
###
DRIVE_ID=

###
# Set the region in which to deploy your services
###
REGION=us-central1

###
# Set the name of the cloud function
###
PERFORMANCE_MONITOR_FN_NAME=performance_monitor_ingest

###
# Set the name of the cloud workflow
###
WORKFLOW_NAME=performance-monitor-workflow

###
# Set the timezone for scheduling workflows
###
TIME_ZONE='America/New_York'

#while test $# -gt 0; do
#  case "$1" in
#    -h|--help)
#      shift
#      cat <<EOF
#      ./deploy_workflow.sh - Create a workflow and cloud function for performance monitor."
#
#      ./deploy_workflow.sh [options]"
#
#      -h, --help                show this message
#      -p, --project_id          the project ID to deploy to
#      -i, --dataset_id          the dataset ID to deploy reports to.
#      -r, --region              the region to set up services. Default is 'us-east1'
#      -s, --service_account     the service account to create/use. Default is 'performance-monitor-manager'
#      -d, --drive_id            the drive ID to pull reports from. Should be the "reports" folder.
#      -t, --time_zone           the timezone (default is 'America/New_York')
#      -w, --workflow_name       the name of the workflow to be deployed. Default is 'performance-monitor-workflow'
#      -f, --function_name       the name of the cloud function. Default is 'performance-monitor-ingest'
#EOF
#      exit 1
#      ;;
#    -p|--project_id)
#      shift
#      PROJECT_ID=$1
#      shift
#      ;;
#    -s|--service_account)
#      shift
#      SERVICE_ACCOUNT=$1
#      shift
#      ;;
#    -i|--dataset_id)
#      shift
#      DATASET_ID=$1
#      shift
#      ;;
#    -d|--drive_id)
#      shift
#      DRIVE_ID=$1
#      shift
#      ;;
#    -t|--time_zone)
#      shift
#      TIME_ZONE=$1
#      shift
#      ;;
#    -w|--workflow_name)
#      shift
#      WORKFLOW_NAME=$1
#      shift
#      ;;
#    -f|--function_name)
#      shift
#      PERFORMANCE_MONITOR_FN_NAME=$1
#      shift
#      ;;
#    -r|--region)
#      shift
#      REGION=$1
#      shift
#      ;;
#  esac
#done

PROJECT_ID=$1
DRIVE_ID=$2

[[ -z "$PROJECT_ID" ]] && echo "Please set --project_id" && exit 1
[[ -z "$DRIVE_ID" ]] && echo "Please set --drive_id" && exit 1

###
# Set the schedule for the workflow (unix-cron format). For example, to
# schedule your workflow to execute every 5 minutes, type `*/5 * * * *`.
# To run at midnight, use `0 0 * * *`.
# See: grontab.guru
###
SCHEDULE='0 0 * * *'  # run at midnight

###
# The arguments to pass into cloud workflow. You probably won't need to edit
# this directly, but if you do, make sure you pass in JSON.
###

gcloud config set project $PROJECT_ID
# create the service account
gcloud iam service-accounts create ${SERVICE_ACCOUNT}

SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com

# assign roles for Cloud Run invoker and viewer
MEMBER="serviceAccount:${SERVICE_ACCOUNT_EMAIL}"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/bigquery.jobs.create"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/run.invoker"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/run.viewer"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/serviceusage.serviceUsageConsumer"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/workflows.invoker"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/bigquery.user"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member $MEMBER \
  --role "roles/logging.logWriter"

# deploy the function
gcloud functions deploy $PERFORMANCE_MONITOR_FN_NAME --gen2 \
  --runtime=python311 \
  --region=${REGION} \
  --service-account=${SERVICE_ACCOUNT_EMAIL} \
  --entry-point=import_dashboard \
  --trigger-http \
  --memory=512MB

gcloud functions add-invoker-policy-binding $PERFORMANCE_MONITOR_FN_NAME \
  --member=${MEMBER}

# deploy the workflow
gcloud workflows deploy $WORKFLOW_NAME \
  --source=cloud_workflow.yaml \
  --location=${REGION} \
  --service-account=${SERVICE_ACCOUNT_EMAIL}

CLOUD_FUNCTION_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${PERFORMANCE_MONITOR_FN_NAME}"
ARGS="{"'"'"cloud_function_url"'"'": "'"'"${CLOUD_FUNCTION_URL}"'"'", "'"'"dataset_id"'"'": "'"'"${DATASET_ID}"'"'", "'"'"drive_id"'"'": "'"'"${DRIVE_ID}"'"'"}"
JSON_STR=$(echo $ARGS | jq -R)

cd $(dirname $(realpath "$0"))
# add a schedule (https://cloud.google.com/workflows/docs/schedule-workflow#schedule_a_workflow)
gcloud scheduler jobs create http "${WORKFLOW_NAME}-job" \
  --schedule="$SCHEDULE" \
  --uri="https://workflowexecutions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/workflows/${WORKFLOW_NAME}/executions" \
  --message-body="{\"argument\": $JSON_STR}" \
  --time-zone="${TIME_ZONE}" \
  --oauth-service-account-email="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --location=${REGION}


###
# BQ permissions
###
