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

import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";

const CRON_MARKER_PREFIX = "sublime-space-bot:";

const repoRoot = realpathSync(join(import.meta.dirname, ".."));
const npmPath = getExecutablePath("npm");
const jobs = [
  {
    marker: `${CRON_MARKER_PREFIX}post-apod`,
    schedule: "0 17 * * *",
    command: `${shellQuote(npmPath)} run run:with-retries -- post:apod`,
  },
  {
    marker: `${CRON_MARKER_PREFIX}post-epic`,
    schedule: "0 19 * * 3",
    command: `${shellQuote(npmPath)} run run:with-retries -- post:epic`,
  },
  {
    marker: `${CRON_MARKER_PREFIX}post-hubble`,
    schedule: "0 19 * * 5",
    command: `${shellQuote(npmPath)} run run:with-retries -- post:hubble`,
  },
  {
    marker: `${CRON_MARKER_PREFIX}post-webb`,
    schedule: "0 18 * * *",
    command: `${shellQuote(npmPath)} run run:with-retries -- post:webb`,
  },
  {
    marker: `${CRON_MARKER_PREFIX}post-sdo`,
    schedule: "30 18 * * 1",
    command: `${shellQuote(npmPath)} run run:with-retries -- post:sdo`,
  },
];

function getExecutablePath(command: string): string {
  const result = spawnSync("which", [command], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to find ${command} executable`);
  }

  return result.stdout.trim();
}

function readCurrentCrontab(): string[] {
  const result = spawnSync("crontab", ["-l"], {
    encoding: "utf8",
  });

  if (result.status === 0) {
    return result.stdout.split("\n").filter((line) => line.length > 0);
  }

  if (result.stderr.includes("no crontab for")) {
    return [];
  }

  throw new Error(result.stderr || "Failed to read current crontab");
}

const existingLines = readCurrentCrontab().filter((line) => !line.includes(CRON_MARKER_PREFIX));
const botLines = jobs.map(
  (job) =>
    `${job.schedule} cd ${shellQuote(repoRoot)} && ${job.command} >> bot.log 2>&1 # ${job.marker}`,
);
const nextCrontab = [...existingLines, ...botLines].join("\n") + "\n";

execFileSync("crontab", ["-"], {
  input: nextCrontab,
});

console.log("Installed cron jobs:");
for (const line of botLines) {
  console.log(line);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
