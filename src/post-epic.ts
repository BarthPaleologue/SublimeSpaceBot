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
  type EpicImage,
  buildEpicAltText,
  buildEpicImageUrl,
  buildEpicPostText,
  buildEpicSourceReplyText,
  epicImagesSchema,
} from "./post-utils.ts";

async function fetchLatestEpicImage(): Promise<EpicImage> {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
  const url = new URL("https://api.nasa.gov/EPIC/api/natural");
  url.searchParams.set("api_key", apiKey);

  const images = await fetchJson(url, epicImagesSchema);
  const latestImage = images.at(-1);
  if (!latestImage) {
    throw new Error("NASA EPIC did not return any natural color images");
  }

  return latestImage;
}

async function publishEpicPost(agent: Agent, epicImage: EpicImage, imageUrl: string) {
  const upload = await uploadImageBlob(agent, imageUrl);

  return agent.post({
    ...(await createPostRecord(agent, buildEpicPostText())),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildEpicAltText(epicImage),
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const epicImage = await fetchLatestEpicImage();
  const imageUrl = buildEpicImageUrl(epicImage);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          date: epicImage.date,
          mainPostText: buildEpicPostText(),
          sourceReplyText: buildEpicSourceReplyText(imageUrl),
          imageUrl,
        },
        null,
        2,
      ),
    );
    return;
  }

  const agent = await createAgent();

  const result = await publishEpicPost(agent, epicImage, imageUrl);
  const reply = await publishReply(agent, buildEpicSourceReplyText(imageUrl), result);

  console.log(
    JSON.stringify(
      {
        posted: true,
        uri: result.uri,
        cid: result.cid,
        sourceReplyUri: reply.uri,
        sourceReplyCid: reply.cid,
        date: epicImage.date,
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
