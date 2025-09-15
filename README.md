# Launch Monitor

![Whole Repository Health](https://github.com/google-marketing-solutions/margin-protection/actions/workflows/build.yaml/badge.svg)

## Overview

The Launch Monitor is a suite of tools designed to automate pre-launch and post-launch checklists for media campaigns on various Google advertising platforms. By running automated checks against your campaign setups, it helps you prevent common configuration errors before they impact performance and quickly detect issues in live campaigns.

This repository contains several platform-specific implementations that use Google Sheets as a user interface and Google Apps Script to orchestrate checks against platform APIs. The framework is designed to be extensible, allowing developers to program new rules as needed for custom implementations.

## What's Included

This repository houses several distinct Launch Monitor solutions:

*   **[CM360 Launch Monitor](/cm360/)**: A pure Apps Script solution for monitoring Campaign Manager 360 campaigns.
*   **[DV360 Launch Monitor](/ts/dv360/)**: A TypeScript-based solution for Display & Video 360, offering robust, type-safe rules and checks.
*   **[SA360 Launch Monitor](/ts/sa360/)**: A TypeScript-based solution for the new Search Ads 360 experience.
*   **[Google Ads Launch Monitor](/googleads/)**: A pure Apps Script solution for monitoring Google Ads campaigns.
*   **[Dashboard](/dashboard/)**: A Python-based Google Cloud Function for ingesting report data from Google Drive into BigQuery for advanced analysis and visualization.

## Getting Started

To get started with a Launch Monitor, you first need to deploy it from the Google Apps Script environment.

1.  **Choose a Monitor**: Navigate to the directory of the Launch Monitor you wish to use (e.g., `/ts/dv360/` for the DV360 monitor).
2.  **Follow the Setup Guide**: Each monitor has its own `README.md` file with detailed, step-by-step instructions for deployment and setup. This typically involves:
    *   Creating a new Google Sheet from the provided template.
    *   Creating a new Apps Script project and copying in the code from this repository.
    *   Configuring the necessary API access and authorization.
    *   Filling out the settings in the Google Sheet.
3.  **Run the Checks**: Once set up, you can run the monitor's checks directly from the custom menu that will appear in your Google Sheet. You can also set up time-based triggers for automated, periodic checks.

## How It Works

The Launch Monitor tools share a common architectural pattern:

*   **Google Sheets UI**: Configuration for all rules and settings is managed in a Google Sheet. This provides a user-friendly interface where you can enable/disable rules, set thresholds, and specify which accounts or campaigns to monitor.
*   **Google Apps Script Backend**: The core logic is written in Apps Script (either as plain JavaScript or TypeScript). This script reads the configuration from the sheet, makes calls to the relevant platform APIs (e.g., DV360 API, Google Ads API) to fetch campaign data, executes the defined rules against that data, and writes the results back to the sheet.
*   **Extensible Rules Engine**: The system is designed to be modular. Each check is a self-contained "rule" that defines its parameters, its logic, and the conditions for flagging an anomaly. This makes it straightforward for developers to add new custom checks.

## Developing New Rules

One of the key features of the Launch Monitor is its extensibility. If you have custom quality assurance checks that are not covered by the default rules, you can write your own.

The process involves defining a new rule object with its parameters, description, and a `callback` function containing the core validation logic. For detailed instructions on how to develop and integrate new rules, please see the [Developer's Guide](docs/developers-guide.md).

## Key Links

### Solutions

- [CM360 Launch Monitor](/cm360/)
- [DV360 Launch Monitor](/ts/dv360/)
- [SA360 Launch Monitor](/ts/sa360/)
- [Google Ads Launch Monitor](/googleads/)

### Developer Documentation

- [Developer's Guide](docs/developers-guide.md)
- [How to update your version of Launch Monitor](docs/updating-launch-monitor.md)
- [About TypeScript in Launch Monitor](docs/typescript-in-launch-monitor.md)
- [Contributing Guidelines](docs/contributing.md)
