// Sublime Space Bot - Daily Bluesky bot for space-related posts.
// Copyright (C) 2026 Barthélemy Paléologue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const ALLOWED_COMMANDS = new Set(["post:apod", "post:epic", "post:hubble"]);

const command = process.argv[2];
if (!command || !ALLOWED_COMMANDS.has(command)) {
  console.error(`Usage: npm run run:with-retries -- ${[...ALLOWED_COMMANDS].join("|")}`);
  process.exitCode = 2;
} else {
  await runWithRetries(command);
}

async function runWithRetries(command: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    log(command, `attempt ${attempt}/${MAX_ATTEMPTS} started`);
    const exitCode = await runNpmScript(command);

    if (exitCode === 0) {
      log(command, `attempt ${attempt}/${MAX_ATTEMPTS} succeeded`);
      return;
    }

    log(command, `attempt ${attempt}/${MAX_ATTEMPTS} failed with exit code ${exitCode}`);
    if (attempt < MAX_ATTEMPTS) {
      log(command, `waiting ${RETRY_DELAY_MS / 1000}s before retry`);
      await setTimeout(RETRY_DELAY_MS);
    }
  }

  log(command, `failed after ${MAX_ATTEMPTS} attempts`);
  process.exitCode = 1;
}

async function runNpmScript(command: string): Promise<number> {
  return new Promise((resolve) => {
    const npm = getNpmInvocation();
    const child = spawn(npm.command, [...npm.args, "run", command], {
      stdio: "inherit",
    });

    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

function getNpmInvocation(): { args: string[]; command: string } {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    return { args: [], command: "npm" };
  }

  if (npmExecPath.endsWith(".js")) {
    return { args: [npmExecPath], command: process.execPath };
  }

  return { args: [], command: npmExecPath };
}

function log(command: string, message: string): void {
  console.log(`[${new Date().toISOString()}] [${command}] ${message}`);
}
