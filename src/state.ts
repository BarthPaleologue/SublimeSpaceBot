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
import { type PostRef } from "./bluesky.ts";

const DEFAULT_STATE_PATH = join(import.meta.dirname, "..", ".bot-state.json");

const postRefSchema = z.object({
  cid: z.string(),
  uri: z.string(),
});

const publishedPostStateSchema = z.object({
  itemKey: z.string(),
  mainPost: postRefSchema.optional(),
  sourceReply: postRefSchema.optional(),
});

const botStateSchema = z
  .object({
    posts: z.record(z.string(), publishedPostStateSchema).optional(),
  })
  .passthrough();

export type BotState = z.infer<typeof botStateSchema>;
export type PublishedPostState = z.infer<typeof publishedPostStateSchema>;

export async function readBotState(): Promise<BotState> {
  try {
    const text = await readFile(getStatePath(), "utf8");
    const json = parseStateJson(text);
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
  const statePath = getStatePath();
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryPath, statePath);
}

export function getPublishedPostState(
  state: BotState,
  source: string,
  itemKey: string,
): PublishedPostState | undefined {
  const published = state.posts?.[source];
  return published?.itemKey === itemKey ? published : undefined;
}

export async function savePublishedPostState(
  state: BotState,
  source: string,
  published: PublishedPostState,
): Promise<BotState> {
  const nextState = {
    ...state,
    posts: {
      ...state.posts,
      [source]: published,
    },
  };

  await writeBotState(nextState);
  return nextState;
}

export function toPostRef(post: PostRef): PostRef {
  return {
    cid: post.cid,
    uri: post.uri,
  };
}

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function getStatePath(): string {
  return process.env.BOT_STATE_PATH || DEFAULT_STATE_PATH;
}

function parseStateJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid bot state JSON: ${message}`);
  }
}
