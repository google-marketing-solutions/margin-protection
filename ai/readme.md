# Being a Good Assistant

This file provides context and rules for AI assistants to follow to be most effective in this project.

## Helpful Initial Links

To get a full context of this project, please review the following:

- The `docs/` folder for project documentation.
- The `ai/docs/` folder for AI-specific documentation and roadmaps.
- The `ai/issues/` folder for the error tracking process.

If you can't read any of these files, please let your human code partner know.

## Initial Rules

| Instruction Name                   | Category        | Instruction                                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editing                            | Workflow        | Unless an edit is very small, you should create a plan in a new folder, ai/plans, along with a helpful AI explanation of done state and when the plan can be considered done, to be deleted. If a plan already exists, you can begin implementing it, but any deviations or inconsistencies or challenges in the plan should be treated as stopping points where the plan needs to be revised or discussed with a human. |
| File Docstring                     | Code Style      | Always add a @fileoverview docstring to the top of a file.                                                                                                                                                                                                                                                                                                                                                               |
| Git commit early and often         | Workflow        | Git commit each time you make an edit on a per-file basis explaining the changes.                                                                                                                                                                                                                                                                                                                                        |
| Prefer tools and human-in-the-loop | Troubleshooting | Core Requirement: Rather than collate and analyze large amounts of data, use tools. If you can execute a tool or command directly, do so instead of asking the user. For example, instead of asking the user to run `ls -R`, execute it yourself and analyze the output.                                                                                                                                                 |
| Docstring Generation               | Code Style      | Always add docstrings to my code and to the top of my files. I am an active editor so if you don't understand why code is there, or if you don't fully understand what a file does, place comments asking: # TODO(seancjones) instead of making edits to the code.                                                                                                                                                       |
| Code Brevity                       | Code Style      | Do not generate code for lines that are self-explanatory. Remove comments from lines that would idiomatically be understood. Remove comments that don't add semantic value, like // assign value to var1 on const var1 = value;                                                                                                                                                                                          |
| Import Management                  | Code Style      | If you see missing imports, add them. If you see imports in the wrong style, fix them. In Python and TypeScript, follow the Google style guide as best as possible.                                                                                                                                                                                                                                                      |
| Complicated Tasks                  | Workflow        | Give me a recommended plan and ask to execute when it's complicated.                                                                                                                                                                                                                                                                                                                                                     |
| Refactoring Notes                  | Code Edits      | Add TODO($USER_NAME) to any block of code that might need future refactoring but is off topic.                                                                                                                                                                                                                                                                                                                           |
| Unit Testing                       | Testing         | When a test is difficult to debug, write more fundamental unit tests rather than editing a large test with assumed fixes.                                                                                                                                                                                                                                                                                                |
| Test File Creation                 | Testing         | Always create a test file for a function if one doesn't exist yet. Check for appropriate code coverage and add notes on the functions tested by each unit test.                                                                                                                                                                                                                                                          |
| Change Log                         | Logging         | Core Requirement: Add a git commit with changes                                                                                                                                                                                                                                                                                                                                                                          |
| Tooling: replace                   | Tooling         | When using the replace tool, use 'new_string' instead of 'newContent'. If you find a successful way to use 'replace' share it in your output so I can add it to your rules. See ai/tools and add snippets here for difficult-to-design clients.                                                                                                                                                                          |

## CLI Commands

| Command | Description                                                                                                                               |
| :------ | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `init`  | Initializes the Terraform binary, prompts the user for configuration values, and runs Terraform to set up the GCP OAuth Workflow project. |

## Logging

This directory serves as a repository for tracking repeated and frustrating errors that are difficult to debug.

### Core Principle

Remember that while you are a powerful AI, humans possess a unique ability for intuitive pattern recognition. Some problems that seem intractable to you might have simple solutions that a human can spot by recognizing a a pattern from past experience. When you encounter a persistent and difficult-to-debug error, it is crucial to log it here to provide visibility for human engineers.

### Error Tracking Workflow

1.  **Identify a recurring, difficult error:** When you encounter an error that you have seen before and are struggling to resolve, it's time to log it.

2.  **Create an issue file:** For each unique error, create a new file in the `ai/issues/` directory. The filename should be a short, descriptive name for the error (e.g., `infinite-change-detection-loop.csv`).

3.  **Log the error in CSV format:** Each file will be a CSV to track occurrences. The format should be:
    `"Timestamp","Error Message","File Path","Line Number","Count"`

4.  **Track repetitions:**
    - If the file for the error already exists, check if the exact same "Error Message" is already present.
    - If it is, increment the `Count` for that row.
    - If it is a new variation or context, add a new row with a `Count` of 1.

### Example: `some-error.csv`

```csv
"Timestamp","Error Message","File Path","Line Number","Count"
"2023-10-27T10:00:00Z","TypeError: Cannot read properties of undefined (reading 'x')","/path/to/problematic/file.ts","42","5"
"2023-10-27T11:30:00Z","TypeError: Cannot read properties of undefined (reading 'y')","/path/to/another/file.ts","101","2"
```

By following this process, you will create a valuable dataset for human engineers to identify and resolve the most persistent and challenging bugs in this codebase.

### ACK request

If you have read this README in its totality, and spent time reading the rules to understand them, please notify the user. Incorporate reminders into each prompt you give to cite the rules you are following.
