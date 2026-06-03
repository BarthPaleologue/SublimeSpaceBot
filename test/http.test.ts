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

import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetries, redactSensitiveUrl } from "../src/http.ts";

test("redactSensitiveUrl redacts API keys and token-like query params", () => {
  const url = new URL(
    "https://api.nasa.gov/planetary/apod?api_key=secret&thumbs=true&access_token=hidden",
  );

  assert.equal(
    redactSensitiveUrl(url),
    "https://api.nasa.gov/planetary/apod?api_key=%3Credacted%3E&thumbs=true&access_token=%3Credacted%3E",
  );
});

test("fetchWithRetries retries until the fetcher succeeds", async () => {
  let attempts = 0;

  const result = await fetchWithRetries(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary failure");
      }

      return "ok";
    },
    {
      retryCount: 5,
      retryDelayMs: 0,
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("fetchWithRetries throws the last error after all retries fail", async () => {
  let attempts = 0;
  const lastError = new Error("last failure");

  await assert.rejects(
    () =>
      fetchWithRetries(
        async () => {
          attempts += 1;
          throw lastError;
        },
        {
          retryCount: 2,
          retryDelayMs: 0,
        },
      ),
    lastError,
  );

  assert.equal(attempts, 3);
});
