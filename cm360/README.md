# CM360 Launch Monitor

The Campaign Manager 360 Margin Protection Monitor is a tool that identifies configuration errors and anomalies in CM360 and alerts the users by providing insights to fix the issue. The tool currently supports the following use cases: Ghost Placements, Default Ads Rate, Floodlight Trends, Out of Flight Placements. Please see the Use Cases Config tab for more information.	
			
## One Time Setup

1. (Optional) Setup Reports in Campaign Manager 360		
    
    **Note:** This is optional, and can be generated automatically. Skip to Step 2. for additional details.	
    
    1. Go to Campaign Manager and create a new Offline Report for your specific Use Case: GHOST_PLACEMENTS, DEFAULT_ADS_RATE, FLOODLIGHT_TRENDS, OUT_OF_FLIGHT_PLACEMENTS. 
    Use the settings below. Please verify especially the order of the fields, they should be in the same order as specified in the Report Schemas tab."	
    
    2. Title: CM360 [USE_CASE_NAME] Monitor Report	
    
    3.  Filter [Optional]: You can filter only by the Advertisers you care about. Or leave it blank.	
    
    4. Default Date range: LAST_7_DAYS	
    
    5.  Dimensions: Depends on the Use Case, please see more details about the report Schema in the Report Schemas tab.	
    
    6. Metrics: Depends on the Use Case, please see more details about the report Schema in the Report Schemas tab.	
    IMPORTANT: The Dimensions and Metrics in the report must follow the same order as specified in the Report Schemas tab.	
    
    7. Schedule: Active, Weekly.	
    
    8. Delivery Format: CSV	
        
    **Note:** Create 1 report for each Use Case and CM360 Account.	
			
2. Add Reports manually to the CM360 Margin Protection Tool		
    
    - The CM360 Margin Protection Monitor tool does a lookup on the user Profile ID that you specify in the Reports Config tab to build the reports for you. Please add your Profile ID and leave the CM360 Account ID and Report ID blank if you want the tool to generate the reports. If you already created a report in CM360, please add the Report ID and Profile ID.	
        
    1. Select the Use Case that you want to configure.	
    
    2. Take note of each Report ID you created on the previous step. If the tool created the reports for you, the Report ID should be populated automatically.	
    
    3. Go to tab Reports Config and write down all the Report IDs for each account, the Profile IDs of the user running or scheduling the script and the CM360 Account IDs. If the tool created the reports for you, the Report IDs and CM360 Account IDs should be populated automatically.	
        
    **IMPORTANT:** Report creation using the tool - Reports might take some time to run after creation. Running tasks for some reports might take longer than the execution time in Apps Scripts (5 mins), once you execute the script and the reports are created, if you see a warning message, please wait until the report is ready and run the tool again. For long running reports, you will see a warning message per report. This happens only at creation time, that's why it is important that the reports run before this tool executes, to make sure that the report is ready to download.	
			
3. Configure Date Range for the reports		
		
    1. In the Reports Config tab, go to the Report Date Range column and select the relative date range for your report. 	
			
	**Note:** This column will be used the first time the report is created. If you want to change the date range for the reports later, you can do it directly in the CM360 UI. Changes in this column after the report has been created will not take effect. If no date is provided, it will default to LAST_7_DAYS.	
			
4. (Optional) Configure Filters for the reports in CM360		
    
    - The tool supports filter configuration for Advertiser IDs. This is an optional step and you can also do this directly in the CM360 UI. This feature will only apply the first time the report is created. Changes in this column after the report has been created will not take effect. 	
			
	1. In the Report Config tab go to the Report Filters column and add the advertiser ids that you would like to include in the report. The format should be as follows: advertiserId=1234,34565;	
	
    **Note:** Please note the semicolon at the end.	
			
5. (Optional) Configure a Threshold for each Use Case		
    
    - The tool uses default Threholds that are configured in the Use Cases Config tab. If you would like to set up a custom threshold for each entry in the Reports Config tab, you can add a value to the Threshold column in the Reports Config tab and the script will override the default value from the Use Cases Config tab.  If left blank, the default value will be used.	
			
6. (Required) Configure Extra Parameters for some use cases		
    
    - Some use cases, like the Floodlight Trends, require extra parameters to be passed. The Extra Parameters column in the Reports Config tab can be used to pass such parameters for the execution. See more details in the  Use Cases, Rules & Thresholds section.	
			
7. (Optional) Manually create a filter in each Report tab in the Google Spreadsheet		
	
    - This is an optional step in case the filters are not applied automatically. When you execute 
    the script manually or via Triggers, the filter will be created automatically.		
	
    1. Go to the Use Case tab and select the table range (including the headers) that you want to apply the filter to.	
    
    2. Go to the Data menu at the top and click on the Create a Filter option.	
	
    3. You will see that the table headers now have filters that can be applied. Now you can filter the data to see only the ISSUES.	
			
8. Set Up Alerts using Triggers		
	
    1. In the Report Config, populate the Emails for Alerts column with the email addresses that alerts should be sent to. The list should be a comma separated list of emails. For example: user1@company.com,user2@company.com,user3@company.com. If the column is empty, this step will be skipped.
    
    2. If you want to receive a custom email message, please fill out the Email Message column in the Reports Config tab. If this column is empty, a default message will be used.	
	
    3. Triggers. In order to retrieve the latest report data, the CM360 scheduled reports should run before this solution executes.	
		IMPORTANT - Follow the steps below to change your spreadsheet time zone to match your CM360 report time zone.	
	
    4. Go to File -> Settings menu at the top of your spreadsheet and change the time zone to match your CM360 report time zone. See the screenshot below.	
	
    5.  Go to Extensions -> Apps Script menu at the top of your spreadsheet and change the time zone to match your CM360 report time zone. See the screenshot below.	
	
    6. Once the time zone has been changed you can set up triggers to automatically execute the solution on a daily or weekly (Monday) basis. You can access these options in the Margin Protection Monitor menu. 	
			
			
## Run the Tool manually		
		
Prep. Make sure you setup the spreadsheet following the steps on the section One Time Setup above.	
			
1. Add all the required paramaters in the Reports Config tab as specified in the One Time Setup section.	

2. On the Margin Protection Monitor menu at the top click on Run to download the reports and identify the issues per use case.	

3. Once the tool runs, new tabs will be created with the name in the format: UseCaseName-ProfileID-AccountID-ReportID. For example: GHOST_PLACEMENTS-1234-567-11223344	
			

## Use Cases, Rules & Thresholds		

Please see more information about the Use Cases and rules in the Use Cases Config tab.	
What does the Threshold column in the Use Cases Config tab mean?	
This is a configurable column with a default threshold value for each use case. Users can change the value and the script will use it in the next execution. This value can be overriden in the Reports Config tab by providing a value in the Threshold column.	
    
**IMPORTANT:** Please don't change the values in the other columns, especially in the Use Case column since this is a fixed code to identify each use case.	
			
**FLOODLIGHT_TRENDS:** 

1. The Floodlight Configuration ID is an extra parameter that is required for this use case and should be provided in the Extra Parameters column. If left blank, the script will skip the execution for this use case.
2. The date range for this report must be LAST_14_DAYS since the script will compare last week conversions vs week before last conversions and the script runs on Mondays."	
			
**GHOST_PLACEMENTS:**

1. Access to both the advertisers and shadow advertisers [BidManager_Advertiser_DO_NOT_EDIT_XXXXXX, BidManager_SeparateSpotlightAdvertiser_DO_NOT_EDIT] where the ghost placements are generated.	

**DEFAUL_ADS_RATE:**

1. Make sure that you have access to advertisers that are not shadow accounts. Please check if your reports contain any Default Ads.	
			

## Important Notes		

* The yellow columns in the Reports Config tab are required columns. If you don't specify them, you will get an error when the script runs.	
* The gray columns in the Reports Config tab are optional columns.	
* Do not rename the spreadsheet tabs.	
* Make sure you have access to all accounts listed in the Reports Config tab, users executing the solution should have access to the CM360 Accounts and the reports. Please make sure that you have access to get the data for each Use Case.	
* Make sure your reports are scheduled to Run Weekly on Monday before this tool runs.	
    