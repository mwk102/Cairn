import * as Crypto from 'expo-crypto';

import { Cairn, CairnInput, CairnPhoto, PlaceType } from '@/types/cairn';
import { getDb, initDb } from './db';

type CairnRow = Omit<Cairn, 'isFavorite' | 'photos' | 'placeType' | 'tags'> & {
  isFavorite: number;
  placeType: string;
  tags: string;
};

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

function mapCairn(row: CairnRow, photos: CairnPhoto[]): Cairn {
  return {
    ...row,
    placeType: row.placeType as PlaceType,
    tags: parseTags(row.tags),
    isFavorite: row.isFavorite === 1,
    photos,
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

export async function listCairns() {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<CairnRow>(
    'SELECT * FROM cairns ORDER BY updatedAt DESC',
  );
  const groupedPhotos = await photosFor(rows.map((row) => row.id));
  return rows.map((row) => mapCairn(row, groupedPhotos.get(row.id) ?? []));
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
  return mapCairn(row, groupedPhotos.get(id) ?? []);
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
      (id, name, story, notes, latitude, longitude, placeType, tags, isFavorite, primaryPhotoId, createdAt, updatedAt, lastVisitedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      now,
      now,
      now,
    );
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, localUri, createdAt) VALUES (?, ?, ?, ?)',
        photoIds[index],
        id,
        localUri,
        now,
      );
    }
  });

  return id;
}

export async function updateCairn(id: string, input: CairnInput) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const lastVisitedAt = input.lastVisitedAt ?? now;
  const previous = await getCairn(id);
  const photoIdByUri = new Map(previous?.photos.map((photo) => [photo.localUri, photo.id]) ?? []);
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

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE cairns SET
        name = ?, story = ?, notes = ?, latitude = ?, longitude = ?, placeType = ?, tags = ?,
        isFavorite = ?, primaryPhotoId = ?, lastVisitedAt = ?, updatedAt = ?
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
      lastVisitedAt,
      now,
      id,
    );
    await db.runAsync('DELETE FROM photos WHERE cairnId = ?', id);
    for (const [index, localUri] of input.photos.entries()) {
      await db.runAsync(
        'INSERT INTO photos (id, cairnId, localUri, createdAt) VALUES (?, ?, ?, ?)',
        photoIds[index],
        id,
        localUri,
        now,
      );
    }
  });
}

export async function deleteCairn(id: string) {
  await initDb();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM photos WHERE cairnId = ?', id);
    await db.runAsync('DELETE FROM cairns WHERE id = ?', id);
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
