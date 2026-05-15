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
import { createAgent, createPostRecord, publishReply, uploadImageBlob } from "./bluesky.ts";
import { fetchJson } from "./http.ts";
import {
  type HubbleImageDetail,
  type WebbPotmImage,
  buildWebbAltText,
  buildWebbImageUrl,
  buildWebbPostText,
  buildWebbSourceReplyText,
  hubbleImageDetailSchema,
  webbPotmImagesSchema,
} from "./post-utils.ts";
import { readBotState, writeBotState } from "./state.ts";

const WEBB_POTM_URL = "https://esawebb.org/images/potm/json/";

type WebbPostInput = {
  detail: HubbleImageDetail;
  listing: WebbPotmImage;
};

async function fetchLatestWebbImage(): Promise<WebbPostInput> {
  const images = await fetchJson(new URL(WEBB_POTM_URL), webbPotmImagesSchema);
  const listing = images.find((image) => image.image !== null);
  if (!listing?.image) {
    throw new Error("ESA/Webb POTM JSON did not return any image items");
  }

  const detailUrl = new URL(`https://esawebb.org/images/${listing.image}/api/json/`);
  const detail = await fetchJson(detailUrl, hubbleImageDetailSchema);

  return { detail, listing };
}

async function publishWebbPost(agent: Agent, input: WebbPostInput) {
  const upload = await uploadImageBlob(agent, buildWebbImageUrl(input.detail));

  return agent.post({
    ...(await createPostRecord(agent, buildWebbPostText(input.detail))),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildWebbAltText(input.detail),
          aspectRatio: upload.aspectRatio,
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const input = await fetchLatestWebbImage();
  const imageId = input.listing.image;
  if (!imageId) {
    throw new Error("ESA/Webb POTM image ID unexpectedly disappeared");
  }

  const state = await readBotState();
  if (state.webbLastPostedImageId === imageId) {
    console.log(
      JSON.stringify(
        {
          imageId,
          skipped: true,
          reason: "duplicate",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          imageId,
          lastPostedImageId: state.webbLastPostedImageId ?? null,
          mainPostText: buildWebbPostText(input.detail),
          releaseDate: input.detail.Date ?? input.listing.release_date,
          sourceReplyText: buildWebbSourceReplyText(input.detail),
          sourceUrl: input.detail.ReferenceURL ?? `https://esawebb.org/images/${imageId}/`,
          wouldPost: true,
        },
        null,
        2,
      ),
    );
    return;
  }

  const agent = await createAgent();

  const result = await publishWebbPost(agent, input);
  const reply = await publishReply(agent, buildWebbSourceReplyText(input.detail), result);
  await writeBotState({
    ...state,
    webbLastPostedImageId: imageId,
  });

  console.log(
    JSON.stringify(
      {
        imageId,
        posted: true,
        uri: result.uri,
        cid: result.cid,
        sourceReplyUri: reply.uri,
        sourceReplyCid: reply.cid,
        releaseDate: input.detail.Date ?? input.listing.release_date,
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
