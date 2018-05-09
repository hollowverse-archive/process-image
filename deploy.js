#! /usr/bin/env node
/* eslint-disable no-console */
/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const shelljs = require('shelljs');
const {
  executeCommands,
} = require('@hollowverse/utils/helpers/executeCommands');

const { IS_PULL_REQUEST, BRANCH } = shelljs.env;

const isPullRequest = IS_PULL_REQUEST !== 'false';

async function main() {
  const buildCommands = ['yarn test'];

  if (isPullRequest === true) {
    buildCommands.push(
      'NODE_ENV=production yarn serverless package --stage production',
    );
  }

  const deploymentCommands = [
    `NODE_ENV=production yarn serverless deploy
      --stage production
      --force
      --aws-s3-accelerate
    `,
  ];

  let isDeployment = false;
  if (isPullRequest === true) {
    console.info('Skipping deployment commands in PRs');
  } else if (BRANCH === 'master') {
    isDeployment = true;
  } else {
    console.info('Skipping deployment commands in non-master branch');
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
