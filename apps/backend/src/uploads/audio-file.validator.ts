import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  AUDIO_EXTENSIONS,
  AUDIO_MIME_BY_EXTENSION,
  AUDIO_MIME_TYPES,
  COVER_MAX_BYTES,
  COVER_MIME_BY_EXTENSION,
  COVER_MIME_TYPES,
  extensionOf,
} from './multer.config';

export type UploadedFileLike = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type ValidatedFile = {
  /** Canonical extension (`wav`, `mp3`, `flac`, `aiff`, `png`, ...). */
  extension: string;
  /** Canonical MIME type derived from the extension. */
  mime: string;
  size: number;
  buffer: Buffer;
  originalName: string;
};

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} mb`;
}

/**
 * Second line of defence behind the multer filter: the same allow-list, plus
 * a size check with a readable message, plus MIME canonicalisation (browsers
 * disagree on `audio/x-wav` vs `audio/wav`).
 */
export function validateAudioFile(
  file: UploadedFileLike | undefined,
  maxBytes: number,
): ValidatedFile {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('An audio file is required (field "audio")');
  }

  const extension = extensionOf(file.originalname);
  const mime = (file.mimetype ?? '').toLowerCase();

  if (!AUDIO_EXTENSIONS.includes(extension) || !AUDIO_MIME_TYPES.has(mime)) {
    throw new BadRequestException(
      `Unsupported audio file. Use wav, mp3, flac or aiff (got "${file.originalname}")`,
    );
  }

  if (file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `Audio file is ${formatMb(file.buffer.length)}; the limit is ${formatMb(maxBytes)}`,
    );
  }

  const canonicalExtension = extension === 'aif' ? 'aiff' : extension;

  return {
    extension: canonicalExtension,
    mime: AUDIO_MIME_BY_EXTENSION[canonicalExtension],
    size: file.buffer.length,
    buffer: file.buffer,
    originalName: file.originalname,
  };
}

export function validateCoverFile(file: UploadedFileLike | undefined): ValidatedFile {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('A cover image is required');
  }

  const extension = extensionOf(file.originalname);
  const mime = (file.mimetype ?? '').toLowerCase();

  if (!COVER_MIME_BY_EXTENSION[extension] || !COVER_MIME_TYPES.has(mime)) {
    throw new BadRequestException('Cover must be a png, jpg or webp image');
  }

  if (file.buffer.length > COVER_MAX_BYTES) {
    throw new PayloadTooLargeException(
      `Cover is ${formatMb(file.buffer.length)}; the limit is ${formatMb(COVER_MAX_BYTES)}`,
    );
  }

  const canonicalExtension = extension === 'jpeg' ? 'jpg' : extension;

  return {
    extension: canonicalExtension,
    mime: COVER_MIME_BY_EXTENSION[canonicalExtension],
    size: file.buffer.length,
    buffer: file.buffer,
    originalName: file.originalname,
  };
}
