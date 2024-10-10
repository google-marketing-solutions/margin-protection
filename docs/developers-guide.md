# Developer's Guide

## General

While there are differences between different Launch Monitor implementations, here are some common steps to help you get started developing.

### Read about [how to contribute](contributing.md)

If you are contributing from outside of Google, you will need to ensure you have a CLA signed.

### Set up your environment

1. Install [node/npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
2. (Optional) Install yarn:

```
npm install -g yarn
```

3.  Install pre-commit hooks for developing. This will auto-format your code and prevent code from being rejected due to formatting.

        yarn prepare

    or

        npm run prepare

### Testing

The test suite is [mocha](https://mochajs.org/), [chai](https://www.chaijs.com/) for assertions, and [sinon](https://sinonjs.org/) for testing. New code should have tests. Tests ensure that no regressions are introduced by a future developer.

#### Unit tests or end-to-end tests?

- Unit tests should be used for small branching logic functions, like rules.
- Integration or end-to-end tests should be used to ensure that a process works. For example, an end-to-end test should be runing for each major Apps Script function.

#### Test coverage

We don't have a specific coverage target, but PRs will be reviewed test-first, meaning that the reviewer may ask for new test cases for areas of code that they feel are under-tested. High complexity functions are more likely to need tests than low complexity functions. For example, we don't need to test a function that adds `a+b`.

#### Running tests

Tests are run on pre-commit and will trigger an error if they fail in GitHub. To test locally:

1.  In the [base directory](/), run the following:

        yarn

    or

        npm install

2.  Then, to test, run:

        yarn test

##### VSCode Implementation

To enable debugging with breakpoints within VSCode, navigate to .vscode/launch.json. Add the following in the `configurations` array.

    {
        "args": [
            "--timeout",
            "999999",
            "--colors",
            "--inspect-brk",
            "${file}"
        ],
        "internalConsoleOptions": "openOnSessionStart",
        "name": "Test File",
        "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
        "request": "launch",
        "skipFiles": [
            "<node_internals>/**"
        ],
        "type": "node"
    }

## TypeScript

Inside of the Launch Monitor tool you want to use (i.e. [SA360](/ts/sa360) or [DV360](/ts/dv360/)) run the following:

    yarn

or

    npm install

This will give you type completions and more in order to make it easier to code in the IDE.
