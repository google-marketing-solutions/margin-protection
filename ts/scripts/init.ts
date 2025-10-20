import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';

const CURDIR = process.cwd();

const PROJECTS = ['client', 'dv360', 'googleads', 'sa360'];
const ENVIRONMENTS = ['development', 'production'];

const TEMPLATES: Record<string, { url: string; group: string }> = {
  dv360: {
    url: 'https://docs.google.com/spreadsheets/d/1zpmA0tmVg-IzGgO5sxjwY8i0XM3bHzgpqOI9xkN35Ns/copy',
    group:
      'https://groups.google.com/a/professional-services.goog/g/solutions_launch_monitor-readers',
  },
  sa360: {
    url: 'https://docs.google.com/spreadsheets/d/1hUdgSKYwr95UIyi4zhsELurEQVXO4HO_XpD9tiKR4no/edit',
    group:
      'https://groups.google.com/a/professional-services.goog/g/solutions_launch_monitor-readers',
  },
};

async function main() {
  console.log('========================================');
  console.log('  Launch Monitor Interactive Deployer');
  console.log('========================================\n');

  const { project } = await inquirer.prompt([
    {
      type: 'list',
      name: 'project',
      message: 'Select the project to deploy:',
      choices: PROJECTS,
    },
  ]);

  const { environment } = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: 'Select the environment to deploy to:',
      choices: ENVIRONMENTS,
    },
  ]);

  const projectDir = path.join(CURDIR, project);
  const claspProjectFile = `.clasp.${environment}.json`;
  const claspProjectPath = path.join(projectDir, claspProjectFile);

  if (!fs.existsSync(claspProjectPath)) {
    console.log(`⚠️  Clasp project file not found at '${claspProjectPath}'.`);
    const { createNew } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createNew',
        message: 'Do you want to create a new Apps Script project now?',
        default: true,
      },
    ]);

    if (createNew) {
      const template = TEMPLATES[project];
      if (template) {
        // Template-based project (dv360, sa360)
        console.log(
          '\nPlease manually copy the template sheet for this project.',
        );
        console.log(`1. Open this URL in your browser: ${template.url}`);
        console.log('2. Make a copy of the sheet in your Google Drive.');
        console.log(
          `   (If you get a permissions error, you may need to join this Google Group: ${template.group})\n`,
        );

        const { newSheetUrl } = await inquirer.prompt([
          {
            type: 'input',
            name: 'newSheetUrl',
            message: 'Please paste the URL of YOUR NEWLY COPIED sheet here:',
            validate: (input) =>
              !!input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/),
          },
        ]);

        const parentId = newSheetUrl.match(
          /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        )[1];

        console.log('\nNext, we need the Script ID to link your local code.');
        console.log(`1. Open your new sheet: ${newSheetUrl}`);
        console.log("2. In the sheet, go to 'Extensions > Apps Script'.");
        console.log(
          "3. In the Apps Script editor, click the 'Project Settings' (gear) icon.",
        );
        console.log("4. Copy the 'Script ID' from the settings page.\n");

        const { scriptIdUrl } = await inquirer.prompt([
          {
            type: 'input',
            name: 'scriptIdUrl',
            message: 'Please paste the Script ID or the full URL here:',
          },
        ]);

        const scriptId =
          scriptIdUrl.match(/projects\/([a-zA-Z0-9-_]+)/)?.[1] ?? scriptIdUrl;

        console.log('🚀 Creating project configuration file...');
        const claspJsonContent = {
          scriptId: scriptId,
          rootDir: './dist',
          parentId: parentId,
        };

        fs.writeFileSync(
          claspProjectPath,
          JSON.stringify(claspJsonContent, null, 2),
        );
        console.log(
          `✅ Successfully created and configured '${claspProjectPath}'.`,
        );
      } else {
        // Standalone project (client, googleads)
        console.log(
          `🚀 Creating a new standalone Apps Script project for '${project}' (${environment})...`,
        );
        try {
          execSync(
            `npx clasp create --title "Launch Monitor - ${project} (${environment})"`,
            { cwd: projectDir, stdio: 'inherit' },
          );
          if (fs.existsSync(path.join(projectDir, '.clasp.json'))) {
            fs.renameSync(
              path.join(projectDir, '.clasp.json'),
              claspProjectPath,
            );
            console.log(
              `✅ Successfully created and configured '${claspProjectPath}'.`,
            );
          } else {
            throw new Error('.clasp.json not created.');
          }
        } catch (_error) {
          console.error(
            "\n❌ ERROR: Failed to create clasp project. Please run 'npx clasp login' and try again.",
          );
          process.exit(1);
        }
      }
    } else {
      console.log(
        `🛑 Deployment cancelled. Please set up your '${claspProjectPath}' file manually.`,
      );
      process.exit(0);
    }
  }

  // --- Command Execution ---
  let buildCommand = '';
  if (environment === 'development') {
    buildCommand =
      project === 'googleads'
        ? 'build --mode development --devtool source-map'
        : 'build:dev';
  } else {
    buildCommand =
      project === 'googleads' ? 'build --mode production' : 'build:prod';
  }

  const buildFullCommand = `yarn ${buildCommand}`;
  const pushFullCommand = `npx clasp push --project ${path.basename(claspProjectPath)}`;

  console.log(
    `\nThe following commands will be executed inside the './${project}' directory:`,
  );
  console.log(`  1. ${buildFullCommand}`);
  console.log(`  2. ${pushFullCommand}\n`);

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Do you want to proceed?',
      default: true,
    },
  ]);

  if (proceed) {
    try {
      console.log(`\n🚀 Building ${project} for ${environment}...`);
      execSync(buildFullCommand, { cwd: projectDir, stdio: 'inherit' });

      console.log(`\n🚀 Deploying ${project} to ${environment}...`);
      execSync(pushFullCommand, { cwd: projectDir, stdio: 'inherit' });

      console.log(
        `\n✅ Deployment of ${project} to ${environment} completed successfully.\n`,
      );
    } catch (_error) {
      console.error(
        "\n❌ ERROR: Deployment failed. Make sure you are logged in ('npx clasp login').",
      );
      process.exit(1);
    }
  } else {
    console.log('\n🛑 Deployment cancelled.\n');
  }
}

main().catch((error) => {
  console.error('\nAn unexpected error occurred:', error);
  process.exit(1);
});
