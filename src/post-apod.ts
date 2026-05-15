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
  type Apod,
  apodSchema,
  buildAltText,
  buildExternalDescription,
  buildMainPostText,
  buildSourceReplyText,
} from "./post-utils.ts";

async function fetchApod(): Promise<Apod> {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("thumbs", "true");

  return fetchJson(url, apodSchema);
}

async function publishTextPost(agent: Agent, apod: Apod) {
  return agent.post(await createPostRecord(agent, buildMainPostText(apod)));
}

async function publishImagePost(agent: Agent, apod: Apod) {
  const imageUrl = apod.hdurl || apod.url;
  const upload = await uploadImageBlob(agent, imageUrl);

  return agent.post({
    ...(await createPostRecord(agent, buildMainPostText(apod))),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildAltText(apod),
          aspectRatio: upload.aspectRatio,
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function publishVideoPost(agent: Agent, apod: Apod) {
  const thumb = apod.thumbnail_url ? await uploadImageBlob(agent, apod.thumbnail_url) : null;

  return agent.post({
    ...(await createPostRecord(agent, buildMainPostText(apod))),
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: apod.url,
        title: apod.title,
        description: buildExternalDescription(apod),
        ...(thumb ? { thumb: thumb.data.blob } : {}),
      },
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const apod = await fetchApod();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          mediaType: apod.media_type,
          mainPostText: buildMainPostText(apod),
          sourceReplyText: buildSourceReplyText(apod),
          imageUrl: apod.media_type === "image" ? apod.hdurl || apod.url : null,
          videoThumbnailUrl: apod.media_type === "video" ? apod.thumbnail_url || null : null,
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
    itemKey: `apod:${apod.date}`,
    publishMainPost: () =>
      apod.media_type === "image"
        ? publishImagePost(agent, apod)
        : apod.media_type === "video"
          ? publishVideoPost(agent, apod)
          : publishTextPost(agent, apod),
    source: "apod",
    sourceReplyText: buildSourceReplyText(apod),
  });

  console.log(
    JSON.stringify(
      {
        posted: !publication.skipped,
        skipped: publication.skipped,
        uri: publication.mainPost?.uri,
        cid: publication.mainPost?.cid,
        sourceReplyUri: publication.sourceReply?.uri,
        sourceReplyCid: publication.sourceReply?.cid,
        title: apod.title,
        date: apod.date,
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
