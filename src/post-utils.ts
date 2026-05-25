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

import { z } from "zod";

const BLUESKY_TEXT_LIMIT = 300;
const MAIN_POST_HASHTAGS = "#Astronomy #Space";
const EPIC_POST_TEXT =
  "Today's Earth selfie from Sun-Earth L1, about 1.5 million km away\n\n#Earth #Space";
const HUBBLE_POST_HASHTAGS = "#Hubble #Space";
const SDO_POST_TEXT = "The Sun today, seen by NASA's Solar Dynamics Observatory\n\n#Sun #Space";
const WEBB_POST_HASHTAGS = "#JWST #Space";
const HUBBLE_FIRST_ARCHIVE_YEAR = 2011;
const HUBBLE_LAST_ARCHIVE_YEAR = 2025;
const HUBBLE_ARCHIVE_YEAR_WEEKS = 52;
export const HUBBLE_ARCHIVE_IMAGE_COUNT =
  (HUBBLE_LAST_ARCHIVE_YEAR - HUBBLE_FIRST_ARCHIVE_YEAR + 1) * HUBBLE_ARCHIVE_YEAR_WEEKS;

export const apodSchema = z.object({
  copyright: z.string().optional(),
  date: z.string(),
  explanation: z.string(),
  hdurl: z.url().optional(),
  media_type: z.string(),
  thumbnail_url: z.url().optional(),
  title: z.string(),
  url: z.url(),
});

export type Apod = z.infer<typeof apodSchema>;

export const epicImageSchema = z.object({
  caption: z.string(),
  date: z.string(),
  image: z.string(),
});

export const epicImagesSchema = z.array(epicImageSchema);

export type EpicImage = z.infer<typeof epicImageSchema>;

export const hubbleImageDetailSchema = z
  .object({
    Credit: z.string().optional(),
    Date: z.string().optional(),
    Description: z.string(),
    ID: z.string(),
    ReferenceURL: z.url().optional(),
    Title: z.string(),
    formats_url: z
      .object({
        large: z.url().optional(),
        screen: z.url(),
      })
      .passthrough(),
  })
  .passthrough();

export type HubbleImageDetail = z.infer<typeof hubbleImageDetailSchema>;

export const webbPotmImageSchema = z
  .object({
    image: z.string().nullable(),
    release_date: z.string(),
    title: z.string(),
  })
  .passthrough();

export const webbPotmImagesSchema = z.array(webbPotmImageSchema);

export type WebbPotmImage = z.infer<typeof webbPotmImageSchema>;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function truncateText(text: string, limit = BLUESKY_TEXT_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }

  const ellipsis = "...";
  const max = limit - ellipsis.length;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const safeCut = lastSpace > Math.floor(max * 0.7) ? lastSpace : max;

  return `${text.slice(0, safeCut).trimEnd()}${ellipsis}`;
}

export function buildMainPostText(apod: Apod): string {
  const separator = "\n\n";
  const maxTitleLength = BLUESKY_TEXT_LIMIT - separator.length - MAIN_POST_HASHTAGS.length;
  return `${truncateText(apod.title, maxTitleLength)}${separator}${MAIN_POST_HASHTAGS}`;
}

export function buildSourceReplyText(apod: Apod): string {
  const credit = apod.copyright || "NASA";
  const source = `Source: ${apod.url}`;
  const creditPrefix = "Credit: ";
  const separator = "\n";
  const maxCreditLength =
    BLUESKY_TEXT_LIMIT - source.length - separator.length - creditPrefix.length;

  if (maxCreditLength <= 0) {
    return truncateText(source);
  }

  return `${creditPrefix}${truncateText(credit, maxCreditLength)}${separator}${source}`;
}

export function buildAltText(apod: Apod): string {
  const credit = apod.copyright ? ` Credit: ${apod.copyright}.` : "";
  return truncateText(`${apod.title}. ${apod.explanation}${credit}`, 1000);
}

export function buildExternalDescription(apod: Apod): string {
  return truncateText(apod.explanation);
}

export function buildEpicPostText(): string {
  return EPIC_POST_TEXT;
}

export function buildEpicSourceReplyText(imageUrl: string): string {
  return `Credit: NASA EPIC/DSCOVR\nSource: ${imageUrl}`;
}

export function buildEpicAltText(epicImage: EpicImage): string {
  return truncateText(`${epicImage.caption}. Captured on ${epicImage.date}.`, 1000);
}

export function buildEpicImageUrl(epicImage: EpicImage): string {
  const [date] = epicImage.date.split(" ");
  if (!date) {
    throw new Error(`Invalid EPIC image date: ${epicImage.date}`);
  }

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) {
    throw new Error(`Invalid EPIC image date: ${epicImage.date}`);
  }
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    throw new Error(`Invalid EPIC image date: ${epicImage.date}`);
  }

  return `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/png/${epicImage.image}.png`;
}

export function buildSdoPostText(): string {
  return SDO_POST_TEXT;
}

export function buildSdoSourceReplyText(): string {
  return "Credit: NASA/SDO/AIA\nSource: https://sdo.gsfc.nasa.gov/data/";
}

export function buildHubblePostText(detail: HubbleImageDetail): string {
  const separator = "\n\n";
  const maxTitleLength = BLUESKY_TEXT_LIMIT - separator.length - HUBBLE_POST_HASHTAGS.length;
  return `${truncateText(normalizeImageDetailText(detail.Title), maxTitleLength)}${separator}${HUBBLE_POST_HASHTAGS}`;
}

export function buildHubbleSourceReplyText(detail: HubbleImageDetail): string {
  const credit = normalizeImageDetailText(detail.Credit) || "ESA/Hubble & NASA";
  const source = detail.ReferenceURL ?? `https://esahubble.org/images/${detail.ID}/`;
  return buildCreditSourceReply(credit, source);
}

export function buildHubbleAltText(detail: HubbleImageDetail): string {
  return truncateText(stripHtml(normalizeImageDetailText(detail.Description)), 1000);
}

export function buildHubbleImageUrl(detail: HubbleImageDetail): string {
  return detail.formats_url.large ?? detail.formats_url.screen;
}

export function buildWebbPostText(detail: HubbleImageDetail): string {
  const separator = "\n\n";
  const maxTitleLength = BLUESKY_TEXT_LIMIT - separator.length - WEBB_POST_HASHTAGS.length;
  return `${truncateText(normalizeImageDetailText(detail.Title), maxTitleLength)}${separator}${WEBB_POST_HASHTAGS}`;
}

export function buildWebbSourceReplyText(detail: HubbleImageDetail): string {
  const credit = normalizeImageDetailText(detail.Credit) || "ESA/Webb, NASA & CSA";
  const source = detail.ReferenceURL ?? `https://esawebb.org/images/${detail.ID}/`;
  return buildCreditSourceReply(credit, source);
}

export function buildWebbAltText(detail: HubbleImageDetail): string {
  return truncateText(stripHtml(normalizeImageDetailText(detail.Description)), 1000);
}

export function buildWebbImageUrl(detail: HubbleImageDetail): string {
  return detail.formats_url.large ?? detail.formats_url.screen;
}

export function buildHubbleArchiveImageId(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`Invalid ESA/Hubble archive offset: ${offset}`);
  }

  const normalizedOffset = offset % HUBBLE_ARCHIVE_IMAGE_COUNT;
  const year = HUBBLE_FIRST_ARCHIVE_YEAR + Math.floor(normalizedOffset / HUBBLE_ARCHIVE_YEAR_WEEKS);
  const week = (normalizedOffset % HUBBLE_ARCHIVE_YEAR_WEEKS) + 1;
  return buildHubbleImageId(year, week);
}

export function getWeeklyArchiveOffset(currentDate: Date, startDate: Date): number {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const elapsedMs = currentDate.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(elapsedMs / weekMs));
}

function buildHubbleImageId(year: number, week: number): string {
  return `potw${String(year).slice(-2)}${String(week).padStart(2, "0")}a`;
}

function buildCreditSourceReply(credit: string, source: string): string {
  const creditPrefix = "Credit: ";
  const sourceLine = `Source: ${source}`;
  const separator = "\n";
  const maxCreditLength =
    BLUESKY_TEXT_LIMIT - creditPrefix.length - separator.length - sourceLine.length;

  if (maxCreditLength <= 0) {
    return truncateText(sourceLine);
  }

  return `${creditPrefix}${truncateText(credit, maxCreditLength)}${separator}${sourceLine}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageDetailText(text: string | undefined): string {
  if (!text) {
    return "";
  }

  const bytesLiteral = /^b(['"])(.*)\1$/s.exec(text);
  return decodeEscapedBytes(bytesLiteral?.[2] || text);
}

function decodeEscapedBytes(text: string): string {
  if (!text.includes("\\x")) {
    return text;
  }

  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\\" && text[index + 1] === "x") {
      const hex = text.slice(index + 2, index + 4);
      if (/^[\da-f]{2}$/i.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 3;
        continue;
      }
    }

    bytes.push(...new TextEncoder().encode(text[index]));
  }

  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function detectImageMimeType(response: Response, imageUrl: string): string {
  const contentType = response.headers.get("content-type");
  if (contentType?.startsWith("image/")) {
    return contentType.split(";")[0].toLowerCase();
  }

  if (imageUrl.endsWith(".png")) {
    return "image/png";
  }

  if (imageUrl.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}
