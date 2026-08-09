import * as Crypto from 'expo-crypto';

import { getDb, initDb } from './db';

const ONBOARDING_KEY = 'onboardingComplete';
const SHARING_DISPLAY_NAME_KEY = 'sharingDisplayName';
const SHARING_CREATOR_ID_KEY = 'sharingCreatorId';
const LAST_SELECTED_CAIRN_ID_KEY = 'lastSelectedCairnId';
const TAG_SUGGESTIONS_KEY = 'tagSuggestions';
const MAX_TAG_SUGGESTIONS = 18;

export type SharingIdentity = {
  displayName: string;
  creatorId: string;
};

type StoredTagSuggestion = {
  tag: string;
  count: number;
  lastUsedAt: string;
};

async function getSetting(key: string) {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

export async function isOnboardingComplete() {
  return await getSetting(ONBOARDING_KEY) === 'true';
}

export async function setOnboardingComplete() {
  await setSetting(ONBOARDING_KEY, 'true');
}

export async function getSharingIdentity(): Promise<SharingIdentity> {
  const existingDisplayName = await getSetting(SHARING_DISPLAY_NAME_KEY);
  const existingCreatorId = await getSetting(SHARING_CREATOR_ID_KEY);
  const displayName = existingDisplayName?.trim() || 'Cairn User';
  const creatorId = existingCreatorId?.trim() || Crypto.randomUUID();

  if (!existingDisplayName) {
    await setSetting(SHARING_DISPLAY_NAME_KEY, displayName);
  }
  if (!existingCreatorId) {
    await setSetting(SHARING_CREATOR_ID_KEY, creatorId);
  }

  return { displayName, creatorId };
}

export async function updateSharingDisplayName(displayName: string) {
  const trimmed = displayName.trim() || 'Cairn User';
  await setSetting(SHARING_DISPLAY_NAME_KEY, trimmed);
  return getSharingIdentity();
}

export async function getLastSelectedCairnId() {
  return getSetting(LAST_SELECTED_CAIRN_ID_KEY);
}

export async function setLastSelectedCairnId(cairnId: string) {
  await setSetting(LAST_SELECTED_CAIRN_ID_KEY, cairnId);
}

function cleanTags(tags: string[]) {
  return Array.from(
    new Map(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag] as const),
    ).values(),
  );
}

function parseTagSuggestions(value: string | null): StoredTagSuggestion[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is StoredTagSuggestion =>
        entry
        && typeof entry.tag === 'string'
        && typeof entry.count === 'number'
        && typeof entry.lastUsedAt === 'string',
      )
      .filter((entry) => entry.tag.trim());
  } catch {
    return [];
  }
}

export async function getTagSuggestions() {
  const stored = parseTagSuggestions(await getSetting(TAG_SUGGESTIONS_KEY));

  return stored
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);
    })
    .map((entry) => entry.tag)
    .slice(0, MAX_TAG_SUGGESTIONS);
}

export async function recordTagSuggestions(tags: string[]) {
  const cleaned = cleanTags(tags);
  if (cleaned.length === 0) return;

  const now = new Date().toISOString();
  const existing = parseTagSuggestions(await getSetting(TAG_SUGGESTIONS_KEY));
  const next = new Map(existing.map((entry) => [entry.tag.toLowerCase(), entry]));

  cleaned.forEach((tag) => {
    const key = tag.toLowerCase();
    const current = next.get(key);
    next.set(key, {
      tag: current?.tag ?? tag,
      count: (current?.count ?? 0) + 1,
      lastUsedAt: now,
    });
  });

  const ranked = Array.from(next.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);
    })
    .slice(0, MAX_TAG_SUGGESTIONS);

  await setSetting(TAG_SUGGESTIONS_KEY, JSON.stringify(ranked));
}
