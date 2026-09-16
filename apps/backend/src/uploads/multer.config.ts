import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const DEFAULT_MAX_UPLOAD_MB = 50;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

/** Canonical extension → MIME for the audio formats we accept. */
export const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
};

export const AUDIO_EXTENSIONS = Object.keys(AUDIO_MIME_BY_EXTENSION);

/** MIME types browsers report for those files (plus the "unknown" fallbacks). */
export const AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/mpeg3',
  'audio/x-mpeg-3',
  'audio/flac',
  'audio/x-flac',
  'audio/aiff',
  'audio/x-aiff',
  'application/octet-stream',
  '',
]);

export const COVER_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const COVER_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function extensionOf(filename: string | undefined): string {
  if (!filename) {
    return '';
  }

  const index = filename.lastIndexOf('.');
  return index === -1 ? '' : filename.slice(index + 1).toLowerCase();
}

/** Read at decorator-evaluation time; `main.ts` loads dotenv before AppModule. */
export function maxUploadBytes(): number {
  const raw = Number(process.env.MAX_UPLOAD_MB);
  const mb = Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MAX_UPLOAD_MB;
  return mb * 1024 * 1024;
}

function rejectUnlessAllowed(
  allowedExtensions: string[],
  allowedMimeTypes: Set<string>,
  label: string,
): MulterOptions['fileFilter'] {
  return (_req, file, callback) => {
    const extension = extensionOf(file.originalname);
    const mime = (file.mimetype ?? '').toLowerCase();

    if (!allowedExtensions.includes(extension) || !allowedMimeTypes.has(mime)) {
      callback(
        new BadRequestException(
          `${label} must be one of: ${allowedExtensions.join(', ')} (got "${file.originalname}")`,
        ),
        false,
      );
      return;
    }

    callback(null, true);
  };
}

/** Options for the `audio` (+ optional `cover`) fields of `POST /samples`. */
export function sampleUploadOptions(): MulterOptions {
  const audioFilter = rejectUnlessAllowed(AUDIO_EXTENSIONS, AUDIO_MIME_TYPES, 'audio');
  const coverFilter = rejectUnlessAllowed(
    Object.keys(COVER_MIME_BY_EXTENSION),
    COVER_MIME_TYPES,
    'cover',
  );

  return {
    storage: memoryStorage(),
    limits: { fileSize: maxUploadBytes(), files: 2 },
    fileFilter: (req, file, callback) => {
      if (file.fieldname === 'cover') {
        coverFilter?.(req, file, callback);
        return;
      }

      audioFilter?.(req, file, callback);
    },
  };
}

/** Options for the single `file` field of `POST /samples/:id/cover`. */
export function coverUploadOptions(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: COVER_MAX_BYTES, files: 1 },
    fileFilter: rejectUnlessAllowed(
      Object.keys(COVER_MIME_BY_EXTENSION),
      COVER_MIME_TYPES,
      'cover',
    ),
  };
}
