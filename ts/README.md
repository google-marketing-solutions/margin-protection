# Launch Monitor - TypeScript

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
If you're just testing the script, use the [Updating Launch Monitor
Guide](/docs/updating-launch-monitor.md#clasp---the-technical-way).
