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
import { createAgent, createPostRecord, uploadImageBlob } from "./bluesky.ts";
import { fetchJson } from "./http.ts";
import { publishOnce } from "./publish-once.ts";
import {
  type HubbleImageDetail,
  buildHubbleAltText,
  buildHubbleArchiveImageId,
  buildHubbleImageUrl,
  buildHubblePostText,
  buildHubbleSourceReplyText,
  getWeeklyArchiveOffset,
  hubbleImageDetailSchema,
} from "./post-utils.ts";

const HUBBLE_ARCHIVE_START_DATE = new Date("2026-05-15T00:00:00.000Z");

type HubblePostInput = {
  archiveOffset: number;
  detail: HubbleImageDetail;
  imageId: string;
};

async function fetchHubbleArchiveImage(): Promise<HubblePostInput> {
  const archiveOffset = getWeeklyArchiveOffset(new Date(), HUBBLE_ARCHIVE_START_DATE);
  const imageId = buildHubbleArchiveImageId(archiveOffset);

  const detailUrl = new URL(`https://esahubble.org/images/${imageId}/api/json/`);
  const detail = await fetchJson(detailUrl, hubbleImageDetailSchema);

  return { archiveOffset, detail, imageId };
}

async function publishHubblePost(agent: Agent, input: HubblePostInput) {
  const upload = await uploadImageBlob(agent, buildHubbleImageUrl(input.detail));

  return agent.post({
    ...(await createPostRecord(agent, buildHubblePostText(input.detail))),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildHubbleAltText(input.detail),
          aspectRatio: upload.aspectRatio,
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const input = await fetchHubbleArchiveImage();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          archiveOffset: input.archiveOffset,
          imageId: input.imageId,
          releaseDate: input.detail.Date,
          mainPostText: buildHubblePostText(input.detail),
          sourceReplyText: buildHubbleSourceReplyText(input.detail),
          imageUrl: buildHubbleImageUrl(input.detail),
          sourceUrl: input.detail.ReferenceURL ?? `https://esahubble.org/images/${input.imageId}/`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const agent = await createAgent();

  const publication = await publishOnce({
    agent,
    itemKey: `hubble:${input.imageId}`,
    publishMainPost: () => publishHubblePost(agent, input),
    source: "hubble",
    sourceReplyText: buildHubbleSourceReplyText(input.detail),
  });

  console.log(
    JSON.stringify(
      {
        mainPostCreated: publication.mainPostCreated,
        skipped: publication.skipped,
        sourceReplyCreated: publication.sourceReplyCreated,
        uri: publication.mainPost?.uri,
        cid: publication.mainPost?.cid,
        sourceReplyUri: publication.sourceReply?.uri,
        sourceReplyCid: publication.sourceReply?.cid,
        archiveOffset: input.archiveOffset,
        imageId: input.imageId,
        releaseDate: input.detail.Date,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
