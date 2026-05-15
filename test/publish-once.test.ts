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

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { type TestContext } from "node:test";
import { type Agent } from "@atproto/api";
import { type PostRef } from "../src/bluesky.ts";
import { publishOnce } from "../src/publish-once.ts";
import { readBotState } from "../src/state.ts";

const mainPost: PostRef = {
  cid: "main-cid",
  uri: "at://did:example:bot/app.bsky.feed.post/main",
};
const sourceReply: PostRef = {
  cid: "reply-cid",
  uri: "at://did:example:bot/app.bsky.feed.post/reply",
};

test("publishOnce publishes main and reply when no state exists", async (t) => {
  await withTemporaryState(t);
  let mainPostCount = 0;
  let replyCount = 0;

  const result = await publishOnce({
    agent: {} as Agent,
    itemKey: "item-1",
    publishMainPost: async () => {
      mainPostCount += 1;
      return mainPost;
    },
    publishSourceReply: async () => {
      replyCount += 1;
      return sourceReply;
    },
    source: "test",
    sourceReplyText: "source",
  });

  assert.equal(mainPostCount, 1);
  assert.equal(replyCount, 1);
  assert.equal(result.mainPostCreated, true);
  assert.equal(result.sourceReplyCreated, true);
  assert.equal(result.skipped, false);
  assert.deepEqual(await readBotState(), {
    posts: {
      test: {
        itemKey: "item-1",
        mainPost,
        sourceReply,
      },
    },
  });
});

test("publishOnce resumes from mainPost-only state", async (t) => {
  await withTemporaryState(t, {
    posts: {
      test: {
        itemKey: "item-1",
        mainPost,
      },
    },
  });
  let mainPostCount = 0;
  let replyCount = 0;

  const result = await publishOnce({
    agent: {} as Agent,
    itemKey: "item-1",
    publishMainPost: async () => {
      mainPostCount += 1;
      return mainPost;
    },
    publishSourceReply: async () => {
      replyCount += 1;
      return sourceReply;
    },
    source: "test",
    sourceReplyText: "source",
  });

  assert.equal(mainPostCount, 0);
  assert.equal(replyCount, 1);
  assert.equal(result.mainPostCreated, false);
  assert.equal(result.sourceReplyCreated, true);
  assert.equal(result.skipped, false);
});

test("publishOnce skips when mainPost and sourceReply already exist", async (t) => {
  await withTemporaryState(t, {
    posts: {
      test: {
        itemKey: "item-1",
        mainPost,
        sourceReply,
      },
    },
  });
  let mainPostCount = 0;
  let replyCount = 0;

  const result = await publishOnce({
    agent: {} as Agent,
    itemKey: "item-1",
    publishMainPost: async () => {
      mainPostCount += 1;
      return mainPost;
    },
    publishSourceReply: async () => {
      replyCount += 1;
      return sourceReply;
    },
    source: "test",
    sourceReplyText: "source",
  });

  assert.equal(mainPostCount, 0);
  assert.equal(replyCount, 0);
  assert.equal(result.mainPostCreated, false);
  assert.equal(result.sourceReplyCreated, false);
  assert.equal(result.skipped, true);
});

test("publishOnce stores mainPost when source reply fails", async (t) => {
  await withTemporaryState(t);

  await assert.rejects(
    publishOnce({
      agent: {} as Agent,
      itemKey: "item-1",
      publishMainPost: async () => mainPost,
      publishSourceReply: async () => {
        throw new Error("reply failed");
      },
      source: "test",
      sourceReplyText: "source",
    }),
    /reply failed/,
  );

  assert.deepEqual(await readBotState(), {
    posts: {
      test: {
        itemKey: "item-1",
        mainPost,
      },
    },
  });
});

test("readBotState reports invalid JSON explicitly", async (t) => {
  const statePath = await withTemporaryState(t);
  await writeFile(statePath, "{not json");

  await assert.rejects(readBotState(), /Invalid bot state JSON/);
});

async function withTemporaryState(t: TestContext, state?: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "sublime-space-bot-"));
  const statePath = join(directory, ".bot-state.json");
  const previousStatePath = process.env.BOT_STATE_PATH;
  process.env.BOT_STATE_PATH = statePath;

  if (state) {
    await writeFile(statePath, `${JSON.stringify(state)}\n`);
  }

  t.after(async () => {
    if (previousStatePath === undefined) {
      delete process.env.BOT_STATE_PATH;
    } else {
      process.env.BOT_STATE_PATH = previousStatePath;
    }
    await rm(directory, { force: true, recursive: true });
  });

  return statePath;
}
