import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { createCairn, listCairns } from '@/data/cairns';
import { Cairn, CairnInput, CairnPhoto, PLACE_TYPES, PlaceType } from '@/types/cairn';

export const SHARED_CAIRN_PACKAGE_TYPE = 'cairn-shared-place';
export const SHARED_CAIRN_VERSION = 1;

const SHARED_PHOTO_DIRECTORY_NAME = 'cairn-shared-photos';
const PLACE_TYPE_SET = new Set<string>(PLACE_TYPES);

export type SharedCairnPackage = {
  type: typeof SHARED_CAIRN_PACKAGE_TYPE;
  formatVersion: number;
  name: string;
  latitude: number;
  longitude: number;
  placeType: PlaceType;
  tags: string[];
  referenceNotes?: string;
  coverPhoto?: {
    mimeType: string;
    extension: string;
    base64: string;
  };
  createdBy: {
    displayName: string;
    id: string;
  };
  createdAt: string;
  sharedAt: string;
};

export type SharedCairnOptions = {
  includeReferenceNotes: boolean;
  includeCoverPhoto: boolean;
  creatorName: string;
};

export type DuplicateCandidate = {
  id: string;
  name: string;
  distanceKm: number;
};

function cleanTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function extensionFor(uri: string, mimeType?: string) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  if (match?.[1]) return match[1].toLowerCase();
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  return 'jpg';
}

function mimeTypeFor(photo: CairnPhoto) {
  const extension = extensionFor(photo.localUri);
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function assertDate(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function parseSharedCairnPackage(json: string): SharedCairnPackage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That is not a readable Cairn share package.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('That is not a readable Cairn share package.');
  }

  const entry = parsed as Record<string, unknown>;
  const latitude = Number(entry.latitude);
  const longitude = Number(entry.longitude);
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const placeType = typeof entry.placeType === 'string' && PLACE_TYPE_SET.has(entry.placeType)
    ? entry.placeType as PlaceType
    : null;
  const now = new Date().toISOString();
  const createdBy = entry.createdBy && typeof entry.createdBy === 'object'
    ? entry.createdBy as Record<string, unknown>
    : {};
  const creatorName = typeof createdBy.displayName === 'string' && createdBy.displayName.trim()
    ? createdBy.displayName.trim()
    : 'A Cairn user';
  const creatorId = typeof createdBy.id === 'string' && createdBy.id.trim()
    ? createdBy.id.trim()
    : Crypto.randomUUID();
  const coverPhoto = entry.coverPhoto && typeof entry.coverPhoto === 'object'
    ? entry.coverPhoto as Record<string, unknown>
    : null;

  if (
    entry.type !== SHARED_CAIRN_PACKAGE_TYPE
    || entry.formatVersion !== SHARED_CAIRN_VERSION
    || !name
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || !placeType
  ) {
    throw new Error('That Cairn share package is missing required place information.');
  }

  return {
    type: SHARED_CAIRN_PACKAGE_TYPE,
    formatVersion: SHARED_CAIRN_VERSION,
    name,
    latitude,
    longitude,
    placeType,
    tags: cleanTags(entry.tags),
    referenceNotes: typeof entry.referenceNotes === 'string' ? entry.referenceNotes.trim() : '',
    coverPhoto: coverPhoto
      && typeof coverPhoto.base64 === 'string'
      && typeof coverPhoto.mimeType === 'string'
      ? {
        base64: coverPhoto.base64,
        mimeType: coverPhoto.mimeType,
        extension: typeof coverPhoto.extension === 'string' ? coverPhoto.extension : extensionFor('', coverPhoto.mimeType),
      }
      : undefined,
    createdBy: {
      displayName: creatorName,
      id: creatorId,
    },
    createdAt: assertDate(entry.createdAt, now),
    sharedAt: assertDate(entry.sharedAt, now),
  };
}

export async function createSharedCairnPackage(cairn: Cairn, options: SharedCairnOptions) {
  const primaryPhoto = cairn.photos.find((photo) => photo.id === cairn.primaryPhotoId) ?? cairn.photos[0];
  const trimmedCreatorName = options.creatorName.trim() || 'A Cairn user';
  const packageData: SharedCairnPackage = {
    type: SHARED_CAIRN_PACKAGE_TYPE,
    formatVersion: SHARED_CAIRN_VERSION,
    name: cairn.name,
    latitude: cairn.latitude,
    longitude: cairn.longitude,
    placeType: cairn.placeType,
    tags: cairn.tags,
    referenceNotes: options.includeReferenceNotes ? cairn.notes : '',
    createdBy: {
      displayName: trimmedCreatorName,
      id: `local-${trimmedCreatorName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cairn-user'}`,
    },
    createdAt: cairn.createdAt,
    sharedAt: new Date().toISOString(),
  };

  if (options.includeCoverPhoto && primaryPhoto?.localUri) {
    try {
      const file = new File(primaryPhoto.localUri);
      const mimeType = file.type || mimeTypeFor(primaryPhoto);
      packageData.coverPhoto = {
        mimeType,
        extension: extensionFor(primaryPhoto.localUri, mimeType),
        base64: await file.base64(),
      };
    } catch {
      // Photo inclusion is optional. If the image cannot be read, share the Cairn without it.
    }
  }

  return JSON.stringify(packageData, null, 2);
}

export function sharedCairnFilename(cairnName: string) {
  const slug = cairnName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44) || 'shared-cairn';

  return `${slug}.cairn`;
}

async function persistCoverPhoto(packageData: SharedCairnPackage) {
  if (!packageData.coverPhoto) return null;

  const directory = new Directory(Paths.document, SHARED_PHOTO_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  const extension = extensionFor('', packageData.coverPhoto.mimeType || undefined);
  const file = new File(directory, `${Crypto.randomUUID()}.${extension}`);
  file.create({ intermediates: true, overwrite: true });
  file.write(packageData.coverPhoto.base64, { encoding: 'base64' });

  return file.uri;
}

export async function duplicateCandidatesForSharedCairn(packageData: SharedCairnPackage) {
  const cairns = await listCairns();
  const normalizedName = packageData.name.trim().toLowerCase();

  return cairns
    .map((cairn) => ({
      id: cairn.id,
      name: cairn.name,
      distanceKm: distanceKm(
        packageData.latitude,
        packageData.longitude,
        cairn.latitude,
        cairn.longitude,
      ),
      nameMatches: cairn.name.trim().toLowerCase() === normalizedName,
    }))
    .filter((candidate) => candidate.nameMatches || candidate.distanceKm <= 1.6)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(({ id, name, distanceKm }) => ({ id, name, distanceKm }));
}

export async function importSharedCairnPackage(packageData: SharedCairnPackage) {
  const coverPhotoUri = await persistCoverPhoto(packageData);
  const input: CairnInput = {
    name: packageData.name,
    story: '',
    notes: packageData.referenceNotes ?? '',
    latitude: packageData.latitude,
    longitude: packageData.longitude,
    placeType: packageData.placeType,
    tags: packageData.tags,
    isFavorite: false,
    primaryPhotoUri: coverPhotoUri,
    photos: coverPhotoUri ? [coverPhotoUri] : [],
    sharedByName: packageData.createdBy.displayName,
    sharedById: packageData.createdBy.id,
    sharedAt: packageData.sharedAt,
  };

  return createCairn(input);
}

function distanceKm(latA: number, lonA: number, latB: number, lonB: number) {
  const earthKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB))
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}
