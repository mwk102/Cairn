import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('cairn.db');
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cairns (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      story TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      placeType TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      isFavorite INTEGER NOT NULL,
      primaryPhotoId TEXT,
      sharedByName TEXT,
      sharedById TEXT,
      sharedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastVisitedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY NOT NULL,
      cairnId TEXT NOT NULL,
      visitLogId TEXT,
      localUri TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (cairnId) REFERENCES cairns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      cairnId TEXT NOT NULL,
      visitDate TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (cairnId) REFERENCES cairns(id) ON DELETE CASCADE
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cairns)');
  if (!columns.some((column) => column.name === 'primaryPhotoId')) {
    await db.execAsync('ALTER TABLE cairns ADD COLUMN primaryPhotoId TEXT;');
  }
  if (!columns.some((column) => column.name === 'story')) {
    await db.execAsync("ALTER TABLE cairns ADD COLUMN story TEXT NOT NULL DEFAULT '';");
  }
  if (!columns.some((column) => column.name === 'tags')) {
    await db.execAsync("ALTER TABLE cairns ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';");
  }
  if (!columns.some((column) => column.name === 'sharedByName')) {
    await db.execAsync('ALTER TABLE cairns ADD COLUMN sharedByName TEXT;');
  }
  if (!columns.some((column) => column.name === 'sharedById')) {
    await db.execAsync('ALTER TABLE cairns ADD COLUMN sharedById TEXT;');
  }
  if (!columns.some((column) => column.name === 'sharedAt')) {
    await db.execAsync('ALTER TABLE cairns ADD COLUMN sharedAt TEXT;');
  }

  const photoColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(photos)');
  if (!photoColumns.some((column) => column.name === 'visitLogId')) {
    await db.execAsync('ALTER TABLE photos ADD COLUMN visitLogId TEXT;');
  }
}
