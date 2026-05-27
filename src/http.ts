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

export const FETCH_TIMEOUT_MS = 45_000;

export async function fetchJson<T>(url: URL, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${url.toString()} failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `GET ${url.toString()} returned invalid JSON: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export async function fetchText(url: URL): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${url.toString()} failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
