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
import { z } from "zod";
import { createAgent, createPostRecord, uploadImageBlob } from "./bluesky.ts";
import { fetchText } from "./http.ts";
import { publishOnce } from "./publish-once.ts";
import {
  type NoirlabImageOfTheWeek,
  buildNoirlabAltText,
  buildNoirlabImageId,
  buildNoirlabPostText,
  buildNoirlabSourceReplyText,
  noirlabImageOfTheWeekSchema,
} from "./post-utils.ts";

const NOIRLAB_IOTW_FEED_URL = "https://noirlab.edu/public/images/iotw/feed/";
const noirlabFeedItemsSchema = z.array(noirlabImageOfTheWeekSchema).nonempty();

async function fetchLatestNoirlabImage(): Promise<NoirlabImageOfTheWeek> {
  const xml = await fetchText(new URL(NOIRLAB_IOTW_FEED_URL));
  return noirlabFeedItemsSchema.parse(parseNoirlabFeedItems(xml))[0];
}

function parseNoirlabFeedItems(xml: string): NoirlabImageOfTheWeek[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const itemXml = match[1] ?? "";
    return {
      description: readTag(itemXml, "description"),
      guid: normalizeNoirlabUrl(readTag(itemXml, "guid")),
      imageUrl: readEnclosureUrl(itemXml),
      link: normalizeNoirlabUrl(readTag(itemXml, "link")),
      pubDate: readTag(itemXml, "pubDate"),
      title: readTag(itemXml, "title"),
    };
  });
}

function readTag(xml: string, tagName: string): string {
  const match = new RegExp(
    `<${tagName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`,
  ).exec(xml);
  const value = match?.[1] ?? match?.[2];
  if (!value) {
    throw new Error(`NOIRLab RSS item is missing <${tagName}>`);
  }

  return value.trim();
}

function readEnclosureUrl(xml: string): string {
  const match = /<enclosure\b[^>]*\burl="([^"]+)"/.exec(xml);
  if (!match?.[1]) {
    throw new Error("NOIRLab RSS item is missing an enclosure URL");
  }

  return match[1];
}

function normalizeNoirlabUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname === "noirlab.edu") {
    parsed.protocol = "https:";
  }

  return parsed.toString();
}

async function publishNoirlabPost(agent: Agent, image: NoirlabImageOfTheWeek) {
  const upload = await uploadImageBlob(agent, image.imageUrl);

  return agent.post({
    ...(await createPostRecord(agent, buildNoirlabPostText(image))),
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: buildNoirlabAltText(image),
          aspectRatio: upload.aspectRatio,
          image: upload.data.blob,
        },
      ],
    },
  });
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const image = await fetchLatestNoirlabImage();
  const imageId = buildNoirlabImageId(image);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          imageId,
          imageUrl: image.imageUrl,
          mainPostText: buildNoirlabPostText(image),
          pubDate: image.pubDate,
          sourceReplyText: buildNoirlabSourceReplyText(image),
          sourceUrl: image.guid,
          wouldPost: true,
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
    itemKey: `noirlab:${imageId}`,
    publishMainPost: () => publishNoirlabPost(agent, image),
    source: "noirlab",
    sourceReplyText: buildNoirlabSourceReplyText(image),
  });

  console.log(
    JSON.stringify(
      {
        imageId,
        mainPostCreated: publication.mainPostCreated,
        skipped: publication.skipped,
        sourceReplyCreated: publication.sourceReplyCreated,
        uri: publication.mainPost?.uri,
        cid: publication.mainPost?.cid,
        sourceReplyUri: publication.sourceReply?.uri,
        sourceReplyCid: publication.sourceReply?.cid,
        pubDate: image.pubDate,
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
