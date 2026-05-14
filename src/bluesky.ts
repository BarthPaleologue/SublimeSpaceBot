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
import { detectImageMimeType, requireEnv } from "./post-utils.ts";

const MAX_BSKY_IMAGE_BYTES = 1_000_000;
const TARGET_IMAGE_BYTES = 950_000;

type DownloadedImage = {
  bytes: Buffer;
  mimeType: string;
};

export type PostRef = {
  cid: string;
  uri: string;
};

export async function createAgent(): Promise<Agent> {
  const session = new CredentialSession(
    new URL(process.env.BLUESKY_SERVICE || "https://bsky.social"),
  );
  const agent = new Agent(session);

  await session.login({
    identifier: requireEnv("BLUESKY_HANDLE"),
    password: requireEnv("BLUESKY_APP_PASSWORD"),
  });

  return agent;
}

export async function createRichText(agent: Agent, text: string): Promise<RichText> {
  const richText = new RichText({ text });
  await richText.detectFacets(agent);
  return richText;
}

export async function createPostRecord(agent: Agent, text: string) {
  const richText = await createRichText(agent, text);
  return {
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
  };
}

export async function publishReply(agent: Agent, text: string, parent: PostRef) {
  return agent.post({
    ...(await createPostRecord(agent, text)),
    reply: {
      root: parent,
      parent,
    },
  });
}

export async function uploadImageBlob(agent: Agent, imageUrl: string) {
  const downloaded = await downloadImage(imageUrl);
  const image =
    downloaded.bytes.length <= MAX_BSKY_IMAGE_BYTES
      ? downloaded
      : await compressForBluesky(downloaded.bytes);

  return agent.uploadBlob(image.bytes, {
    encoding: image.mimeType,
  });
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
