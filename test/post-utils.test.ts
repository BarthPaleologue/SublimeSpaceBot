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
  HUBBLE_ARCHIVE_IMAGE_COUNT,
  type Apod,
  type EpicImage,
  type HubbleImageDetail,
  buildAltText,
  buildEpicAltText,
  buildEpicImageUrl,
  buildEpicPostText,
  buildEpicSourceReplyText,
  buildExternalDescription,
  buildHubbleAltText,
  buildHubbleArchiveImageId,
  buildHubbleImageUrl,
  buildHubblePostText,
  buildHubbleSourceReplyText,
  buildMainPostText,
  buildSourceReplyText,
  buildWebbAltText,
  buildWebbImageUrl,
  buildWebbPostText,
  buildWebbSourceReplyText,
  detectImageMimeType,
  getWeeklyArchiveOffset,
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

function createHubbleDetail(overrides: Partial<HubbleImageDetail> = {}): HubbleImageDetail {
  return {
    Credit: "b'ESA/Hubble & NASA\\xe2\\x80\\x99s A. Example'",
    Date: "2010-04-22T20:10:05",
    Description: "b'<p>A deep view of a nebula &amp; surrounding stars.</p>'",
    ID: "potw1001a",
    ReferenceURL: "https://esahubble.org/images/potw2601a/",
    Title: "b'Hubble captures a nebula'",
    formats_url: {
      large: "https://cdn.esahubble.org/archives/images/large/detail.jpg",
      screen: "https://cdn.esahubble.org/archives/images/screen/detail.jpg",
    },
    ...overrides,
  };
}

function createWebbDetail(overrides: Partial<HubbleImageDetail> = {}): HubbleImageDetail {
  return createHubbleDetail({
    Credit: "b'ESA/Webb, NASA & CSA, G. Duch\\xc3\\xaane'",
    Description: "b'<p>A Webb view of planet-forming discs &amp; nearby stars.</p>'",
    ID: "potm2603a",
    ReferenceURL: "https://esawebb.org/images/potm2603a/",
    Title: "b'A pair of planet-forming discs'",
    formats_url: {
      large: "https://cdn.esawebb.org/archives/images/large/potm2603a.jpg",
      screen: "https://cdn.esawebb.org/archives/images/screen/potm2603a.jpg",
    },
    ...overrides,
  });
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

test("buildHubblePostText includes the title and adds hashtags", () => {
  assert.equal(
    buildHubblePostText(createHubbleDetail()),
    "Hubble captures a nebula\n\n#Hubble #Space",
  );
});

test("buildHubbleSourceReplyText includes credit and source", () => {
  assert.equal(
    buildHubbleSourceReplyText(createHubbleDetail()),
    "Credit: ESA/Hubble & NASA’s A. Example\nSource: https://esahubble.org/images/potw2601a/",
  );
});

test("buildHubbleAltText decodes escaped bytes and strips HTML", () => {
  assert.equal(
    buildHubbleAltText(createHubbleDetail()),
    "A deep view of a nebula & surrounding stars.",
  );
});

test("buildHubbleImageUrl uses the largest detail image URL", () => {
  assert.equal(
    buildHubbleImageUrl(createHubbleDetail()),
    "https://cdn.esahubble.org/archives/images/large/detail.jpg",
  );
});

test("buildHubbleArchiveImageId maps weekly offsets to ESA/Hubble POTW IDs", () => {
  assert.equal(buildHubbleArchiveImageId(0), "potw1101a");
  assert.equal(buildHubbleArchiveImageId(51), "potw1152a");
  assert.equal(buildHubbleArchiveImageId(52), "potw1201a");
  assert.equal(buildHubbleArchiveImageId(HUBBLE_ARCHIVE_IMAGE_COUNT - 1), "potw2552a");
  assert.equal(buildHubbleArchiveImageId(HUBBLE_ARCHIVE_IMAGE_COUNT), "potw1101a");
});

test("buildWebbPostText includes the title and adds hashtags", () => {
  assert.equal(
    buildWebbPostText(createWebbDetail()),
    "A pair of planet-forming discs\n\n#JWST #Space",
  );
});

test("buildWebbSourceReplyText includes decoded credit and source", () => {
  assert.equal(
    buildWebbSourceReplyText(createWebbDetail()),
    "Credit: ESA/Webb, NASA & CSA, G. Duchêne\nSource: https://esawebb.org/images/potm2603a/",
  );
});

test("buildWebbAltText decodes escaped bytes and strips HTML", () => {
  assert.equal(
    buildWebbAltText(createWebbDetail()),
    "A Webb view of planet-forming discs & nearby stars.",
  );
});

test("buildWebbImageUrl uses the largest detail image URL", () => {
  assert.equal(
    buildWebbImageUrl(createWebbDetail()),
    "https://cdn.esawebb.org/archives/images/large/potm2603a.jpg",
  );
});

test("getWeeklyArchiveOffset counts elapsed whole weeks", () => {
  assert.equal(
    getWeeklyArchiveOffset(new Date("2026-05-15T00:00:00Z"), new Date("2026-05-15T00:00:00Z")),
    0,
  );
  assert.equal(
    getWeeklyArchiveOffset(new Date("2026-05-22T00:00:00Z"), new Date("2026-05-15T00:00:00Z")),
    1,
  );
  assert.equal(
    getWeeklyArchiveOffset(new Date("2026-05-14T00:00:00Z"), new Date("2026-05-15T00:00:00Z")),
    0,
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
