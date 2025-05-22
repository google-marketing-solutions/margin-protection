# SA360 Launch Monitor

The Search Ads 360 Launch Monitor is a tool that identifies configuration errors and reported anomalies in SA360 and alerts users so that further manual checks can be made. The tool currently supports the following use cases:

- Geo Targeting settings check
- Geo Targeting impressions tracking
- Budget Pacing check

## One Time Setup

1. Join [the Google Group](https://github.com/google-marketing-solutions/margin-protection) to gain access to the Trix.
2. Make a copy of the [SA360 Launch Monitor template](https://docs.google.com/spreadsheets/d/1hUdgSKYwr95UIyi4zhsELurEQVXO4HO_XpD9tiKR4no/edit?resourcekey=0-1_3vkWl3oLtdancGfLp4pQ&gid=1285731396#gid=1285731396).
3. Follow the instructions for setting up in the sheet, including:
   1. Attach a Google Cloud Project project number to the Apps Script. This is required to interact with the SA360 API.
   2. Add an hourly trigger (or a cadence of your choosing) to run **launchMonitor**
      ![screenshot showing where triggers are in Apps Script](docs/resources/trigger.png)
4. Add your Agency ID or Advertiser ID under **General/Settings**. Note: Agency ID is **not recommended** for large agencies because it can exhaust time limits in Apps Script.
5. Manually run **Fetch Data** or **Pre-Launch QA** under the **Launch Monitor** menu in Google Sheets. You will probably need to do this twice: Once to authorize permissions Launch Monitor requests, and once to see results.
   ![screenshot showing Launch Monitor menu in Google Sheets](docs/resources/menu.png)
