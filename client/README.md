# Apps Script Client

Once you've set up client library, you can share it with other users. This is a
more sustainable way to distribute copies of the tool without asking the user to
update the code themselves.


**Important**: By default, this script will pin to **HEAD** on the library,
which means that any changes you make to the library will immediately be used
by the clients. As a result, you should probably have a separate library/script
you test changes on.

## Client Installation
1. Copy the spreadsheet template provided by your Google Representative
2. Add the correct libraryID replacing the brackets in [appsscript.json](appsscript.json).
3. Run `clasp create --parentId=[parentId]` where [parentId] is the ID of the copied spreadsheet.
4. Run `yarn && yarn push` to get your code pushed to the sheet.
5. Follow the instructions on the Launch Monitor tool to complete installation by adding triggers and a Project Number.
6. Give people access to your script in read only and share the link with them (replacing **edit/** with **copy/** in the URL).

