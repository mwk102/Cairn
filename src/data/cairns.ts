import * as Crypto from 'expo-crypto';

import { Cairn, CairnInput, CairnPhoto, PLACE_TYPES, PlaceType, VisitLog, VisitLogInput } from '@/types/cairn';
import { getDb, initDb } from './db';
import { recordTagSuggestions } from './settings';

type CairnRow = Omit<Cairn, 'isFavorite' | 'photos' | 'placeType' | 'tags' | 'visitLogs'> & {
  isFavorite: number;
  placeType: string;
  tags: string;
};

type VisitLogRow = Omit<VisitLog, 'photos'>;

type CairnMigrationEntry = {
  id?: unknown;
  name?: unknown;
  story?: unknown;
  notes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  placeType?: unknown;
  tags?: unknown;
  isFavorite?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastVisitedAt?: unknown;
};

type CairnMigrationPayload = {
  type?: unknown;
  version?: unknown;
  exportedAt?: unknown;
  cairns?: unknown;
};

const PLACE_TYPE_SET = new Set<string>(PLACE_TYPES);

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return normalizeTags(parsed.filter((tag): tag is string => typeof tag === 'string'));
  } catch {
    return [];
  }
}

function cleanMigrationTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return normalizeTags(value.filter((tag): tag is string => typeof tag === 'string'));
}

function cleanMigrationDate(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function cleanMigrationEntry(entry: CairnMigrationEntry, now: string) {
  const latitude = Number(entry.latitude);
  const longitude = Number(entry.longitude);
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';

  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : Crypto.randomUUID(),
    name,
    story: typeof entry.story === 'string' ? entry.story.trim() : '',
    notes: typeof entry.notes === 'string' ? entry.notes.trim() : '',
    latitude,
    longitude,
    placeType: typeof entry.placeType === 'string' && PLACE_TYPE_SET.has(entry.placeType)
      ? entry.placeType
      : 'Other',
    tags: JSON.stringify(cleanMigrationTags(entry.tags)),
    isFavorite: entry.isFavorite === true ? 1 : 0,
    createdAt: cleanMigrationDate(entry.createdAt, now),
    updatedAt: now,
    lastVisitedAt: cleanMigrationDate(entry.lastVisitedAt, now),
  };
}

function galleryPhotos(photos: CairnPhoto[]) {
  return photos.filter((photo) => !photo.visitLogId);
}

function mapCairn(row: CairnRow, photos: CairnPhoto[], visitLogs: VisitLog[]): Cairn {
  const newestVisit = visitLogs[0];

  return {
    ...row,
    placeType: row.placeType as PlaceType,
    tags: parseTags(row.tags),
    isFavorite: row.isFavorite === 1,
    lastVisitedAt: newestVisit?.visitDate ?? row.createdAt,
    photos,
    visitLogs,
  };
}

async function photosFor(cairnIds: string[]) {
  if (cairnIds.length === 0) return new Map<string, CairnPhoto[]>();
  const db = await getDb();
  const placeholders = cairnIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<CairnPhoto>(
    `SELECT * FROM photos WHERE cairnId IN (${placeholders}) ORDER BY createdAt ASC`,
    ...cairnIds,
  );
  return rows.reduce((map, photo) => {
    const group = map.get(photo.cairnId) ?? [];
    group.push(photo);
    map.set(photo.cairnId, group);
    return map;
  }, new Map<string, CairnPhoto[]>());
}

async function visitLogsFor(cairnIds: string[], photosByCairn: Map<string, CairnPhoto[]>) {
  if (cairnIds.length === 0) return new Map<string, VisitLog[]>();
  const db = await getDb();
  const placeholders = cairnIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<VisitLogRow>(
    `SELECT * FROM visit_logs WHERE cairnId IN (${placeholders}) ORDER BY visitDate DESC, createdAt DESC`,
    ...cairnIds,
  );
  const photosByVisitLog = new Map<string, CairnPhoto[]>();

  for (const photos of photosByCairn.values()) {
    for (const photo of photos) {
      if (!photo.visitLogId) continue;
      const group = photosByVisitLog.get(photo.visitLogId) ?? [];
      group.push(photo);
      photosByVisitLog.set(photo.visitLogId, group);
    }
  }

  return rows.reduce((map, row) => {
    const visitLog: VisitLog = {
      ...row,
      photos: photosByVisitLog.get(row.id) ?? [],
    };
    const group = map.get(row.cairnId) ?? [];
    group.push(visitLog);
    map.set(row.cairnId, group);
    return map;
  }, new Map<string, VisitLog[]>());
}

export async function listCairns() {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<CairnRow>(
    'SELECT * FROM cairns ORDER BY updatedAt DESC',
  );
  const groupedPhotos = await photosFor(rows.map((row) => row.id));
  const groupedVisitLogs = await visitLogsFor(rows.map((row) => row.id), groupedPhotos);
  return rows.map((row) => mapCairn(row, groupedPhotos.get(row.id) ?? [], groupedVisitLogs.get(row.id) ?? []));
}

export async function getCairn(id: string) {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<CairnRow>(
    'SELECT * FROM cairns WHERE id = ?',
    id,
  );
  if (!row) return null;
  const groupedPhotos = await photosFor([id]);
  const groupedVisitLogs = await visitLogsFor([id], groupedPhotos);
  return mapCairn(row, groupedPhotos.get(id) ?? [], groupedVisitLogs.get(id) ?? []);
}

export async function createCairn(input: CairnInput) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  const photoIds = input.photos.map(() => Crypto.randomUUID());
  const primaryPhotoIndex = input.primaryPhotoUri
    ? input.photos.indexOf(input.primaryPhotoUri)
    : -1;
  const primaryPhotoId = primaryPhotoIndex >= 0
    ? photoIds[primaryPhotoIndex]
    : input.primaryPhotoId ?? photoIds[0] ?? null;
  const tags = JSON.stringify(normalizeTags(input.tags));

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO cairns
      (id, name, story, notes, latitude, longitude, placeType, tags, isFavorite, primaryPhotoId, sharedByName, sharedById, sharedAt, createdAt, updatedAt, lastVisitedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.story.trim(),
      input.notes.trim(),
      input.latitude,
      input.longitude,
      input.placeType,
      tags,
      input.isFavorite ? 1 : 0,
      primaryPhotoId,
      input.sharedByName?.trim() || null,
      input.sharedById?.trim() || null,
      input.sharedAt ?? null,
      now,
      now,
      now,
    );
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, visitLogId, localUri, createdAt) VALUES (?, ?, NULL, ?, ?)',
        photoIds[index],
        id,
        localUri,
        now,
      );
    }
  });
  await recordTagSuggestions(input.tags);

  return id;
}

export async function updateCairn(id: string, input: CairnInput) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const previous = await getCairn(id);
  const photoIdByUri = new Map(galleryPhotos(previous?.photos ?? []).map((photo) => [photo.localUri, photo.id]));
  const photoIds = input.photos.map((localUri) => photoIdByUri.get(localUri) ?? Crypto.randomUUID());
  const primaryPhotoIndex = input.primaryPhotoUri
    ? input.photos.indexOf(input.primaryPhotoUri)
    : -1;
  const primaryPhotoId = primaryPhotoIndex >= 0
    ? photoIds[primaryPhotoIndex]
    : input.primaryPhotoId && photoIds.includes(input.primaryPhotoId)
      ? input.primaryPhotoId
      : photoIds[0] ?? null;
  const tags = JSON.stringify(normalizeTags(input.tags));
  const sharedByName = input.sharedByName?.trim() || previous?.sharedByName || null;
  const sharedById = input.sharedById?.trim() || previous?.sharedById || null;
  const sharedAt = input.sharedAt ?? previous?.sharedAt ?? null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE cairns SET
        name = ?, story = ?, notes = ?, latitude = ?, longitude = ?, placeType = ?, tags = ?,
        isFavorite = ?, primaryPhotoId = ?, sharedByName = ?, sharedById = ?, sharedAt = ?, updatedAt = ?
      WHERE id = ?`,
      input.name.trim(),
      input.story.trim(),
      input.notes.trim(),
      input.latitude,
      input.longitude,
      input.placeType,
      tags,
      input.isFavorite ? 1 : 0,
      primaryPhotoId,
      sharedByName,
      sharedById,
      sharedAt,
      now,
      id,
    );
    await db.runAsync('DELETE FROM photos WHERE cairnId = ? AND visitLogId IS NULL', id);
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, visitLogId, localUri, createdAt) VALUES (?, ?, NULL, ?, ?)',
        photoIds[index],
        id,
        localUri,
        now,
      );
    }
  });
  await recordTagSuggestions(input.tags);
}

export async function deleteCairn(id: string) {
  await initDb();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM photos WHERE cairnId = ?', id);
    await db.runAsync('DELETE FROM visit_logs WHERE cairnId = ?', id);
    await db.runAsync('DELETE FROM cairns WHERE id = ?', id);
  });
}

export async function getVisitLog(cairnId: string, visitLogId: string) {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<VisitLogRow>(
    'SELECT * FROM visit_logs WHERE id = ? AND cairnId = ?',
    visitLogId,
    cairnId,
  );

  if (!row) return null;

  const photos = await db.getAllAsync<CairnPhoto>(
    'SELECT * FROM photos WHERE visitLogId = ? ORDER BY createdAt ASC',
    visitLogId,
  );

  return { ...row, photos };
}

export async function createVisitLog(cairnId: string, input: VisitLogInput) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  const photoIds = input.photos.map(() => Crypto.randomUUID());

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO visit_logs
      (id, cairnId, visitDate, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      cairnId,
      input.visitDate,
      input.notes.trim(),
      now,
      now,
    );
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, visitLogId, localUri, createdAt) VALUES (?, ?, ?, ?, ?)',
        photoIds[index],
        cairnId,
        id,
        localUri,
        now,
      );
    }
    await db.runAsync('UPDATE cairns SET updatedAt = ? WHERE id = ?', now, cairnId);
  });

  return id;
}

export async function updateVisitLog(cairnId: string, visitLogId: string, input: VisitLogInput) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const previous = await getVisitLog(cairnId, visitLogId);
  const photoIdByUri = new Map(previous?.photos.map((photo) => [photo.localUri, photo.id]) ?? []);
  const photoIds = input.photos.map((localUri) => photoIdByUri.get(localUri) ?? Crypto.randomUUID());

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE visit_logs SET visitDate = ?, notes = ?, updatedAt = ? WHERE id = ? AND cairnId = ?',
      input.visitDate,
      input.notes.trim(),
      now,
      visitLogId,
      cairnId,
    );
    await db.runAsync('DELETE FROM photos WHERE visitLogId = ?', visitLogId);
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, visitLogId, localUri, createdAt) VALUES (?, ?, ?, ?, ?)',
        photoIds[index],
        cairnId,
        visitLogId,
        localUri,
        now,
      );
    }
    await db.runAsync('UPDATE cairns SET updatedAt = ? WHERE id = ?', now, cairnId);
  });
}

export async function deleteVisitLog(cairnId: string, visitLogId: string) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM photos WHERE visitLogId = ?', visitLogId);
    await db.runAsync('DELETE FROM visit_logs WHERE id = ? AND cairnId = ?', visitLogId, cairnId);
    await db.runAsync('UPDATE cairns SET updatedAt = ? WHERE id = ?', now, cairnId);
  });
}

export async function setCairnFavorite(id: string, isFavorite: boolean) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'UPDATE cairns SET isFavorite = ?, updatedAt = ? WHERE id = ?',
    isFavorite ? 1 : 0,
    new Date().toISOString(),
    id,
  );
}

export async function setCairnPrimaryPhoto(id: string, primaryPhotoId: string) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'UPDATE cairns SET primaryPhotoId = ?, updatedAt = ? WHERE id = ?',
    primaryPhotoId,
    new Date().toISOString(),
    id,
  );
}

export function createCairnMigrationJson(cairns: Cairn[]) {
  return JSON.stringify({
    type: 'cairn-migration',
    version: 1,
    exportedAt: new Date().toISOString(),
    cairns: cairns.map((cairn) => ({
      id: cairn.id,
      name: cairn.name,
      story: cairn.story,
      notes: cairn.notes,
      latitude: cairn.latitude,
      longitude: cairn.longitude,
      placeType: cairn.placeType,
      tags: cairn.tags,
      isFavorite: cairn.isFavorite,
      createdAt: cairn.createdAt,
      updatedAt: cairn.updatedAt,
      lastVisitedAt: cairn.lastVisitedAt,
    })),
  });
}

export async function importCairnsFromMigrationJson(json: string) {
  let payload: CairnMigrationPayload;

  try {
    payload = JSON.parse(json) as CairnMigrationPayload;
  } catch {
    throw new Error('That clipboard text is not a Cairn export.');
  }

  if (payload.type !== 'cairn-migration' || !Array.isArray(payload.cairns)) {
    throw new Error('That clipboard text is not a Cairn export.');
  }

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const entries = payload.cairns
    .map((entry) => cleanMigrationEntry(entry as CairnMigrationEntry, now))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (entries.length === 0) {
    throw new Error('No valid Cairns were found in that export.');
  }

  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO cairns
        (id, name, story, notes, latitude, longitude, placeType, tags, isFavorite, primaryPhotoId, createdAt, updatedAt, lastVisitedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          story = excluded.story,
          notes = excluded.notes,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          placeType = excluded.placeType,
          tags = excluded.tags,
          isFavorite = excluded.isFavorite,
          updatedAt = excluded.updatedAt,
          lastVisitedAt = excluded.lastVisitedAt`,
        entry.id,
        entry.name,
        entry.story,
        entry.notes,
        entry.latitude,
        entry.longitude,
        entry.placeType,
        entry.tags,
        entry.isFavorite,
        entry.createdAt,
        entry.updatedAt,
        entry.lastVisitedAt,
      );
    }
  });

  return entries.length;
}
