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
import { publishOnce } from "./publish-once.ts";
import { buildSdoPostText, buildSdoSourceReplyText } from "./post-utils.ts";

const SDO_IMAGES = [
  {
    alt: "The Sun seen in extreme ultraviolet light by NASA's Solar Dynamics Observatory AIA 193 angstrom channel.",
    label: "AIA 193",
    url: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg",
  },
  {
    alt: "The Sun's visible surface seen by NASA's Solar Dynamics Observatory HMI intensitygram.",
    label: "HMI intensitygram",
    url: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg",
  },
  {
    alt: "The Sun seen in extreme ultraviolet light by NASA's Solar Dynamics Observatory AIA 304, 211, and 171 angstrom channels.",
    label: "AIA 304, 211, 171",
    url: "https://sdo.gsfc.nasa.gov/assets/img/latest/f_304_211_171_1024.jpg",
  },
] as const;

async function publishSdoPost(agent: Agent) {
  const uploads = await Promise.all(
    SDO_IMAGES.map(async (image) => {
      const upload = await uploadImageBlob(agent, image.url);
      return {
        alt: image.alt,
        aspectRatio: upload.aspectRatio,
        image: upload.data.blob,
      };
    }),
  );

  return agent.post({
    ...(await createPostRecord(agent, buildSdoPostText())),
    embed: {
      $type: "app.bsky.embed.images",
      images: uploads,
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          images: SDO_IMAGES.map(({ label, url }) => ({ label, url })),
          mainPostText: buildSdoPostText(),
          sourceReplyText: buildSdoSourceReplyText(),
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
    itemKey: `sdo:${new Date().toISOString().slice(0, 10)}`,
    publishMainPost: () => publishSdoPost(agent),
    source: "sdo",
    sourceReplyText: buildSdoSourceReplyText(),
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
        imageUrls: SDO_IMAGES.map((image) => image.url),
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
