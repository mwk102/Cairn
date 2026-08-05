import * as Crypto from 'expo-crypto';

import { getDb, initDb } from './db';

const ONBOARDING_KEY = 'onboardingComplete';
const SHARING_DISPLAY_NAME_KEY = 'sharingDisplayName';
const SHARING_CREATOR_ID_KEY = 'sharingCreatorId';
const LAST_SELECTED_CAIRN_ID_KEY = 'lastSelectedCairnId';

export type SharingIdentity = {
  displayName: string;
  creatorId: string;
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
