import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIRECTORY_NAME = 'cairn-photos';

export type PersistPhotoResult = {
  uri: string;
  ok: boolean;
  error?: unknown;
};

function extensionFor(uri: string) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

function photoDirectory() {
  const directory = new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory;
}

function isStoredCairnPhoto(uri: string) {
  return uri.startsWith(`${Paths.document.uri}${PHOTO_DIRECTORY_NAME}/`);
}

export async function persistPickedPhoto(uri: string) {
  if (isStoredCairnPhoto(uri)) {
    const stored = new File(uri);
    if (stored.exists) {
      return uri;
    }
  }

  const directory = photoDirectory();
  const source = new File(uri);
  const destination = new File(directory, `${Crypto.randomUUID()}.${extensionFor(uri)}`);

  source.copy(destination);
  if (!destination.exists) {
    throw new Error('Photo could not be saved.');
  }

  return destination.uri;
}

export async function persistPickedPhotos(uris: string[]): Promise<PersistPhotoResult[]> {
  const results: PersistPhotoResult[] = [];

  for (const uri of uris) {
    try {
      results.push({ uri: await persistPickedPhoto(uri), ok: true });
    } catch (error) {
      results.push({ uri, ok: false, error });
    }
  }

  return results;
}

export function existingPhotoUris(uris: string[]) {
  return uris.filter((uri) => {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  });
}
