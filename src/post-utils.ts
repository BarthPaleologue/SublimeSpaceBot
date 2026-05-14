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

const BLUESKY_TEXT_LIMIT = 300;
const MAIN_POST_HASHTAGS = "#Astronomy #Space";

export type Apod = {
  copyright?: string;
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: "image" | "video" | string;
  thumbnail_url?: string;
  title: string;
  url: string;
};

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
