# Launch Monitor - Enterprise

This is the home to TypeScript-built code in Launch Monitor.

## Status

![SA360 Launch Monitor Build & Test](https://github.com/google-marketing-solutions/margin-protection/actions/workflows/sa360.yaml/badge.svg)

![DV360 Launch Monitor Build & Test](https://github.com/google-marketing-solutions/margin-protection/actions/workflows/dv360.yaml/badge.svg)

## Building

These projects are written in TypeScript and need to be built to be deployed to
Apps Script. The badge statuses above represent whether building is working or
not.

`yarn` contains scripts that make this simple.

### Recommended Installation (library)

1. Run the following command:

   ```
   clasp create
   yarn
   yarn push
   ```

2. Create a [library](https://developers.google.com/apps-script/guides/libraries#create_and_share_a_library) called `Launch Monitor` with the code provided.
3. Copy the script ID from the URL of the library.
4. Follow the instructions in the [client](client) library to create a client you can copy and share.

### Alternative Installation (standalone)

Note that any updates to your script will need to be manually shared with other users.
If you're just testing the script, this is an easier installation path.

1. Copy the spreadsheet template provided by your Google Representative
2. [Get the script ID](../docs/get-appsscript-id.md) from the copied spreadsheet.
3. Run `clasp clone [scriptId]` where [scriptId] is the ID of the copied spreadsheet.
4. Run `yarn && yarn push` to get your code pushed to the sheet.
5. Follow the instructions on the Launch Monitor tool to complete installation by adding triggers and a Project Number.
