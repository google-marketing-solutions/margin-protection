# Dashboard Import

## Overview
Runs an ingestion script based on a single drive ID, importing to a single
BigQuery dataset (one table per rule, plus some views).

The end result is a data warehouse of errors that have occurred over time.

## Installation
This script should be deployed to a Cloud Function to be triggered by Pubsub.

## How to use
You can leverage the BigQuery functions with Looker Studio or export to another
database for further use. Alternatively, you can treat this code as reference
implementation and create a version for your own purposes.