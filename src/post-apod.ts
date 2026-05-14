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

import { Agent, CredentialSession, RichText } from "@atproto/api";
import sharp from "sharp";
import {
  type Apod,
  buildAltText,
  buildExternalDescription,
  buildMainPostText,
  buildSourceReplyText,
  detectImageMimeType,
  requireEnv,
} from "./post-utils.ts";

const MAX_BSKY_IMAGE_BYTES = 1_000_000;
const TARGET_IMAGE_BYTES = 950_000;

type DownloadedImage = {
  bytes: Buffer;
  mimeType: string;
};

type PostRef = {
  cid: string;
  uri: string;
};

async function createRichText(agent: Agent, text: string): Promise<RichText> {
  const richText = new RichText({ text });
  await richText.detectFacets(agent);
  return richText;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url.toString()} failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchApod(): Promise<Apod> {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("thumbs", "true");

  return fetchJson<Apod>(url);
}

async function downloadImage(imageUrl: string): Promise<DownloadedImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`GET ${imageUrl} failed: ${response.status} ${response.statusText}`);
  }

  const mimeType = detectImageMimeType(response, imageUrl);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mimeType };
}

async function compressForBluesky(bytes: Buffer): Promise<DownloadedImage> {
  let width = 1800;
  let quality = 86;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const output = await sharp(bytes)
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length <= TARGET_IMAGE_BYTES) {
      return { bytes: output, mimeType: "image/jpeg" };
    }

    width = Math.max(900, Math.round(width * 0.82));
    quality = Math.max(62, quality - 6);
  }

  throw new Error(`Could not compress image under ${MAX_BSKY_IMAGE_BYTES} bytes`);
}

async function publishTextPost(agent: Agent, apod: Apod) {
  const richText = await createRichText(agent, buildMainPostText(apod));

  return agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
  });
}

async function publishImagePost(agent: Agent, apod: Apod) {
  const imageUrl = apod.hdurl || apod.url;
  const downloaded = await downloadImage(imageUrl);
  const image =
    downloaded.bytes.length <= MAX_BSKY_IMAGE_BYTES
      ? downloaded
      : await compressForBluesky(downloaded.bytes);

  const upload = await agent.uploadBlob(image.bytes, {
    encoding: image.mimeType,
  });
  const richText = await createRichText(agent, buildMainPostText(apod));

  return agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildAltText(apod),
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function uploadImageBlob(agent: Agent, imageUrl: string) {
  const downloaded = await downloadImage(imageUrl);
  const image =
    downloaded.bytes.length <= MAX_BSKY_IMAGE_BYTES
      ? downloaded
      : await compressForBluesky(downloaded.bytes);

  return agent.uploadBlob(image.bytes, {
    encoding: image.mimeType,
  });
}

async function publishVideoPost(agent: Agent, apod: Apod) {
  const richText = await createRichText(agent, buildMainPostText(apod));
  const thumb = apod.thumbnail_url ? await uploadImageBlob(agent, apod.thumbnail_url) : null;

  return agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
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

async function publishSourceReply(agent: Agent, apod: Apod, parent: PostRef) {
  const richText = await createRichText(agent, buildSourceReplyText(apod));

  return agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
    reply: {
      root: parent,
      parent,
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

  const session = new CredentialSession(
    new URL(process.env.BLUESKY_SERVICE || "https://bsky.social"),
  );
  const agent = new Agent(session);

  await session.login({
    identifier: requireEnv("BLUESKY_HANDLE"),
    password: requireEnv("BLUESKY_APP_PASSWORD"),
  });

  const result =
    apod.media_type === "image"
      ? await publishImagePost(agent, apod)
      : apod.media_type === "video"
        ? await publishVideoPost(agent, apod)
        : await publishTextPost(agent, apod);
  const reply = await publishSourceReply(agent, apod, result);

  console.log(
    JSON.stringify(
      {
        posted: true,
        uri: result.uri,
        cid: result.cid,
        sourceReplyUri: reply.uri,
        sourceReplyCid: reply.cid,
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
