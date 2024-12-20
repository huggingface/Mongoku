#!/usr/bin/env node

import * as child_process from 'child_process';
import * as path from 'path';

import { createCommand } from 'commander';
import * as figlet from 'figlet';
import chalk from 'chalk';
import * as server from './server';

const program = createCommand();
program
  .version(require('../package.json').version)
  .usage('start [--pm2] [--forever]')
  .description('MongoDB client for the web')
  .option('--pm2', 'Run using pm2')
  .option('--forever', 'Run using forever')
  .action((args) => { start(args.cmd, args.options); })
  .parse(process.argv);

async function start(cmd: 'start', options: any) {
  console.log(chalk.rgb(175, 188, 207)(figlet.textSync('Mongoku')) + '\n');

  if (cmd !== "start") {
    return program.help();
  }

  const pm2 = options.pm2;
  const forever = options.forever;
  const entryPath = path.join(__dirname, 'server.js');

  if (pm2 && forever) {
    console.log("Cannot launch with both PM2 and Forever. You need to chose one.");
    console.log("Use 'mongoku --help' for more info");
    process.exit(1);
  }

  if (pm2) {
    // Start for pm2
    return child_process.exec(`pm2 start --name mongoku ${entryPath}`, (err, stdout, stderr) => {
      if (err) {
        console.log("Error while launching with pm2: ", err);
      } else {
        console.log(stdout, stderr);
        console.log("[Mongoku] Launched with PM2.\nAvailable at http://localhost:3100/");
      }
    });
  }

  if (forever) {
    // Start for forever
    return child_process.exec(`forever --uid mongoku start -a ${entryPath}`, (err, stdout, stderr) => {
      if (err) {
        console.log("Error while launching with forever: ", err);
      } else {
        console.log(stdout, stderr);
        console.log("[Mongoku] Launched with forever.\nAvailable at http://localhost:3100/");
      }
    });
  }

  await server.start();
}
