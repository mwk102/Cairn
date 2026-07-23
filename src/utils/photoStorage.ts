import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIRECTORY_NAME = 'cairn-photos';

function extensionFor(uri: string) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

export async function persistPickedPhoto(uri: string) {
  const directory = new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  const source = new File(uri);
  const destination = new File(directory, `${Crypto.randomUUID()}.${extensionFor(uri)}`);
  source.copy(destination);

  return destination.uri;
}
