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

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const STATE_PATH = join(import.meta.dirname, "..", ".bot-state.json");

const botStateSchema = z
  .object({
    webbLastPostedImageId: z.string().optional(),
  })
  .passthrough();

export type BotState = z.infer<typeof botStateSchema>;

export async function readBotState(): Promise<BotState> {
  try {
    const text = await readFile(STATE_PATH, "utf8");
    const json = JSON.parse(text);
    const result = botStateSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`Invalid bot state: ${z.prettifyError(result.error)}`);
    }

    return result.data;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return {};
    }

    throw error;
  }
}

export async function writeBotState(state: BotState): Promise<void> {
  const temporaryPath = `${STATE_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryPath, STATE_PATH);
}

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
