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

import test from "node:test";
import assert from "node:assert/strict";
import {
  type Apod,
  type EpicImage,
  buildAltText,
  buildEpicAltText,
  buildEpicImageUrl,
  buildEpicPostText,
  buildEpicSourceReplyText,
  buildExternalDescription,
  buildMainPostText,
  buildSourceReplyText,
  detectImageMimeType,
  truncateText,
} from "../src/post-utils.ts";

function createApod(overrides: Partial<Apod> = {}): Apod {
  return {
    date: "2026-05-13",
    explanation: "A test explanation.",
    media_type: "image",
    title: "A Test Nebula",
    url: "https://apod.nasa.gov/test",
    ...overrides,
  };
}

function createEpicImage(overrides: Partial<EpicImage> = {}): EpicImage {
  return {
    caption: "This image was taken by NASA's EPIC camera onboard the NOAA DSCOVR spacecraft",
    date: "2026-05-14 12:34:56",
    image: "epic_1b_20260514123456",
    ...overrides,
  };
}

test("truncateText keeps short text unchanged", () => {
  assert.equal(truncateText("hello", 10), "hello");
});

test("truncateText respects limit", () => {
  const text = truncateText("one two three four five", 12);
  assert.ok(text.length <= 12);
  assert.ok(text.endsWith("..."));
});

test("buildMainPostText includes the APOD title and discovery hashtags", () => {
  const post = buildMainPostText(
    createApod({
      copyright: "NASA",
    }),
  );

  assert.equal(post, "A Test Nebula\n\n#Astronomy #Space");
});

test("buildMainPostText preserves hashtags when title is long", () => {
  const post = buildMainPostText(
    createApod({
      title: "A".repeat(500),
    }),
  );

  assert.ok(post.length <= 300);
  assert.ok(post.endsWith("\n\n#Astronomy #Space"));
});

test("buildSourceReplyText includes credit and source", () => {
  const reply = buildSourceReplyText(
    createApod({
      copyright: "NASA",
    }),
  );

  assert.equal(reply, "Credit: NASA\nSource: https://apod.nasa.gov/test");
});

test("buildSourceReplyText falls back to NASA credit", () => {
  const reply = buildSourceReplyText(createApod());

  assert.equal(reply, "Credit: NASA\nSource: https://apod.nasa.gov/test");
});

test("buildSourceReplyText preserves source URL when credit is long", () => {
  const source = "https://apod.nasa.gov/test";
  const reply = buildSourceReplyText(
    createApod({
      copyright: "A".repeat(500),
      url: source,
    }),
  );

  assert.ok(reply.length <= 300);
  assert.ok(reply.endsWith(`\nSource: ${source}`));
  assert.match(reply, /^Credit: A+\.\.\./);
});

test("buildEpicPostText includes Earth discovery hashtags", () => {
  assert.equal(
    buildEpicPostText(),
    "Today's Earth selfie from one million miles away\n\n#Earth #Space",
  );
});

test("buildEpicSourceReplyText includes NASA EPIC credit and source", () => {
  assert.equal(
    buildEpicSourceReplyText("https://example.com/earth.png"),
    "Credit: NASA EPIC/DSCOVR\nSource: https://example.com/earth.png",
  );
});

test("buildEpicAltText includes caption and capture date", () => {
  const alt = buildEpicAltText(createEpicImage());

  assert.match(alt, /^This image was taken/);
  assert.match(alt, /Captured on 2026-05-14 12:34:56/);
});

test("buildEpicImageUrl builds the official EPIC archive URL", () => {
  assert.equal(
    buildEpicImageUrl(createEpicImage()),
    "https://epic.gsfc.nasa.gov/archive/natural/2026/05/14/png/epic_1b_20260514123456.png",
  );
});

test("buildEpicImageUrl rejects invalid dates", () => {
  assert.throws(
    () =>
      buildEpicImageUrl(
        createEpicImage({
          date: "not-a-date",
        }),
      ),
    /Invalid EPIC image date/,
  );
});

test("buildAltText includes title and explanation", () => {
  const alt = buildAltText(
    createApod({
      title: "Moonrise",
      explanation: "The Moon rises over the horizon.",
      copyright: "A. Example",
    }),
  );

  assert.match(alt, /^Moonrise/);
  assert.match(alt, /The Moon rises/);
  assert.match(alt, /Credit: A\. Example/);
});

test("buildExternalDescription includes a truncated explanation", () => {
  const description = buildExternalDescription(
    createApod({
      explanation: "A ".repeat(250),
    }),
  );

  assert.ok(description.length <= 300);
  assert.ok(description.endsWith("..."));
});

test("detectImageMimeType reads image content-type", () => {
  const response = new Response("", {
    headers: { "content-type": "image/png; charset=binary" },
  });

  assert.equal(detectImageMimeType(response, "https://example.com/image"), "image/png");
});

test("detectImageMimeType falls back from URL", () => {
  const response = new Response("");
  assert.equal(detectImageMimeType(response, "https://example.com/image.webp"), "image/webp");
  assert.equal(detectImageMimeType(response, "https://example.com/image"), "image/jpeg");
});
