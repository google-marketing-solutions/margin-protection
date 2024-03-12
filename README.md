# Launch Monitor
NOTE: This is a work-in-progress. Contact your Google representative for support
in getting this solution to work for you.

## Problem
This solution helps to automate pre-launch and just-launched checklists for
customers in order to avoid errors or detect them quickly.

New rules can be programmed in as needed in customer-specific implementations.

This space is the home of SA360, DV360+DBM, and other product-specific
launch monitor implementations, with a common folder for shared logic.

## Recommended Installation (library)
1. Run `clasp create`
2. Run `yarn && yarn push`
3. Create a [library](https://developers.google.com/apps-script/guides/libraries#create_and_share_a_library) called `Launch Monitor` with the code provided.
4. Copy the script ID from the URL of the library.
5. Follow the instructions in the [client](client) library to create a client you can copy and share.

## Alternative Installation (standalone)
Note that any updates to your script will need to be manually shared with other users.
If you're just testing the script, this is an easier installation path.

1. Copy the spreadsheet template provided by your Google Representative
2. Run `clasp create --parentId=[parentId]` where [parentId] is the ID of the copied spreadsheet.
3. Run `yarn && yarn push` to get your code pushed to the sheet.
4. Follow the instructions on the Launch Monitor tool to complete installation by adding triggers and a Project Number.
5. Give people access to your script in read only and share the link with them (replacing **edit/** with **copy/** in the URL).

