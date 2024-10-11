# TypeScript in Launch Monitor

## Why TypeScript?

TypeScript is modular and autocompleting, making it simple to discover the APIs in an IDE.

It has the added benefits of

1. Compiling into a single file, which makes it easier to copy once in Apps Script
2. Modularity, which makes it easier to develop code and share code between libraries.
3. Speed, as JS code is optimized, especially when webpack production mode is turned on.

It has the corresponding drawbacks of

1. Being more verbose.
2. Being harder to read in Apps Script due to being compiled code.
3. Taking longer to develop. JS is generally faster to write as you can write it directly in Apps Script.
4. Overhead - you need to use node, `ts` and a number of other packages to run TypeScript code.

## Common features for TypeScript-based Launch Monitor tools

TypeScript-based solutions have a common code-base due to ease of modularity.

1. Create an Apps Script service to centrally manage updates, while distributing clients to people within your organization. Alternatively, you can run the code standalone.
2. The ability to create new rules without any UI changes.
3. A migration feature that makes it easy to modify the spreadsheet when adding new functionality, like a new general setting.

## Are all solutions moving to TypeScript?

There are no plans for this to happen. The DV360 and SA360 Launch Monitors in TypeScript were developed simultaneously by the same author, while other developers created the other tools. We are experimenting with TypeScript and JavaScript due to the the benefits and drawbacks of both approaches. Let us know what you think as a developer or as a user, as we try to make this tool useful for it's purpose: automating error mitigation checks across Google's ad products.
