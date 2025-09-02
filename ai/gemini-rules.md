# Gemini Rules

- When using the `replace` tool, read the entirety of the file into memory, make edits, and then write. This is to handle a bug with the replace tool.
- In TypeScript, when the member type is not known, use index accessors (e.g., `someObject['someProperty']`) instead of dot notation (`someObject.someProperty`).
