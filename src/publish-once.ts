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

import { type Agent } from "@atproto/api";
import { type PostRef, publishReply } from "./bluesky.ts";
import { getPublishedPostState, readBotState, savePublishedPostState, toPostRef } from "./state.ts";

type PublishOnceInput = {
  agent: Agent;
  itemKey: string;
  publishSourceReply?: (agent: Agent, text: string, parent: PostRef) => Promise<PostRef>;
  publishMainPost: () => Promise<PostRef>;
  source: string;
  sourceReplyText: string;
};

type PublishOnceResult = {
  mainPost?: PostRef;
  mainPostCreated: boolean;
  skipped: boolean;
  sourceReply?: PostRef;
  sourceReplyCreated: boolean;
};

export async function publishOnce(input: PublishOnceInput): Promise<PublishOnceResult> {
  const state = await readBotState();
  const published = getPublishedPostState(state, input.source, input.itemKey);

  if (published?.sourceReply) {
    return {
      mainPost: published.mainPost,
      mainPostCreated: false,
      skipped: true,
      sourceReply: published.sourceReply,
      sourceReplyCreated: false,
    };
  }

  if (published?.mainPost) {
    const sourceReply = toPostRef(await publishSourceReply(input, published.mainPost));
    await savePublishedPostState(state, input.source, {
      ...published,
      sourceReply,
    });

    return {
      mainPost: published.mainPost,
      mainPostCreated: false,
      skipped: false,
      sourceReply,
      sourceReplyCreated: true,
    };
  }

  const mainPost = toPostRef(await input.publishMainPost());
  const stateAfterMainPost = await savePublishedPostState(state, input.source, {
    itemKey: input.itemKey,
    mainPost,
  });
  const sourceReply = toPostRef(await publishSourceReply(input, mainPost));
  await savePublishedPostState(stateAfterMainPost, input.source, {
    itemKey: input.itemKey,
    mainPost,
    sourceReply,
  });

  return {
    mainPost,
    mainPostCreated: true,
    skipped: false,
    sourceReply,
    sourceReplyCreated: true,
  };
}

function publishSourceReply(input: PublishOnceInput, parent: PostRef): Promise<PostRef> {
  return (input.publishSourceReply ?? publishReply)(input.agent, input.sourceReplyText, parent);
}
