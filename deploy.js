#! /usr/bin/env node
/* eslint-disable no-console */
/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const shelljs = require('shelljs');
const {
  executeCommands,
} = require('@hollowverse/common/helpers/executeCommands');
const { createZipFile } = require('@hollowverse/common/helpers/createZipFile');
const fs = require('fs');
const awsSdk = require('aws-sdk');

const { IS_PULL_REQUEST, AWS_REGION = 'us-east-1' } = shelljs.env;

const isPullRequest = IS_PULL_REQUEST !== 'false';

async function main() {
  const buildCommands = ['yarn clean', 'yarn test'];
  const deploymentCommands = [
    'yarn build',
    () => createZipFile('build.zip', ['dist/**/*'], ['secrets/**/*.enc']),
    async () => {
      const lambda = new awsSdk.Lambda({
        apiVersion: '2015-03-31',
        region: AWS_REGION,
      });

      try {
        await lambda
          .updateFunctionCode({
            FunctionName: 'cropFace',
            Publish: true,
            ZipFile: fs.readFileSync('build.zip'),
          })
          .promise();
      } catch (error) {
        console.error(error.message);
      }
    },
  ];

  let isDeployment = false;
  if (isPullRequest === true) {
    console.info('Skipping deployment commands in PRs');
  } else {
    isDeployment = true;
  }

  try {
    await executeCommands(
      isDeployment ? [...buildCommands, ...deploymentCommands] : buildCommands,
    );
  } catch (e) {
    console.error('Build/deployment failed:', e);
    process.exit(1);
  }
}

main();
