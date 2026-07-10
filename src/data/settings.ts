import { getDb, initDb } from './db';

const ONBOARDING_KEY = 'onboardingComplete';

export async function isOnboardingComplete() {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ONBOARDING_KEY,
  );
  return row?.value === 'true';
}

export async function setOnboardingComplete() {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ONBOARDING_KEY,
    'true',
  );
}
