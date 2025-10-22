# Build Process for Google Apps Script

This project uses [tsup](https://tsup.egoist.dev/), a fast and powerful bundler powered by [esbuild](https://esbuild.github.io/), to compile our TypeScript code into a single JavaScript file that is ready for deployment on Google Apps Script (GAS).

## Why `tsup` and `esbuild`?

- **Speed:** `esbuild` is written in Go and is significantly faster than traditional JavaScript-based bundlers. This results in near-instantaneous builds, improving developer productivity.
- **Simplicity:** `tsup` provides a simple configuration layer on top of `esbuild`, making it easy to set up and maintain our build process.
- **Apps Script Compatibility:** The build process is configured to output a single, IIFE-formatted (`.js`) file that wraps all our code. This is essential for the Google Apps Script runtime, which does not support standard module formats like CommonJS or ES Modules.

## Configuration

The build configuration is managed through `tsup.config.ts` files located in each package directory (`client/`, `dv360/`, `sa360/`).

### Shared Configuration (`common/build.ts`)

To avoid duplication, a shared configuration generator is located in `common/build.ts`. The `getTsupConfig` function provides a standard setup for our Apps Script packages.

Key features of the shared configuration include:

- **Entry Point:** Sets the entry point to `src/main.ts` within the package.
- **Output Format:** Configured to `iife` (Immediately Invoked Function Expression) to ensure the code is self-contained and runs correctly in the GAS environment.
- **Banner:** A banner is prepended to the output file. This banner defines global functions (`onOpen`, `initializeSheets`, etc.) that are required by Google Apps Script to act as entry points from the user interface (e.g., custom menu items). It also ensures a `global` object is available, mimicking the Apps Script environment.
- **`onSuccess` Hook:** After a successful build, the `appsscript.json` manifest file is copied into the `dist` directory alongside the bundled code.

### Package-Specific Configurations

- **`dv360/tsup.config.ts`:** This file imports and uses the shared `getTsupConfig` function, providing its own package root directory.
- **`client/tsup.config.ts` and `sa360/tsup.config.ts`:** These packages contain their own `tsup` configuration. While they replicate some of the logic from the shared configuration, they demonstrate the flexibility to have package-specific build steps if needed.

## How it Works

When you run the build command for a package, `tsup` performs the following steps:

1.  It reads the `tsup.config.ts` file for that package.
2.  It traverses the TypeScript source files, starting from the entry point (`src/main.ts`).
3.  `esbuild` compiles, bundles, and minifies all imported TypeScript files into a single JavaScript file.
4.  The specified banner is added to the top of the bundled file.
5.  The final `.js` file and the `appsscript.json` manifest are placed in the `dist` directory.

The contents of the `dist` directory are then ready to be pushed to a Google Apps Script project using a tool like `clasp`. This streamlined process allows for rapid development and deployment of our TypeScript codebase to the Apps Script platform.
