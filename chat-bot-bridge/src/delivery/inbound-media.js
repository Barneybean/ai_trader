// Provider-neutral inbound-media validation and storage.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const MAX_INBOUND_IMAGES = 4;
export const MAX_INBOUND_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export function normalizedImageType(value) {
  const mime = String(value || '').toLowerCase().split(';')[0].trim();
  return IMAGE_TYPES.has(mime) ? mime : null;
}

export function imageSignatureMatches(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/gif') return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export function saveInboundImage(directory, bytes, declaredMime, now = Date.now()) {
  const mime = normalizedImageType(declaredMime);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!mime) throw new Error('unsupported image type');
  if (!buffer.length || buffer.length > MAX_INBOUND_IMAGE_BYTES) throw new Error('image exceeds size limit or is empty');
  if (!imageSignatureMatches(buffer, mime)) throw new Error('image content does not match its declared type');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filePath = path.join(directory, `${now}-${crypto.randomUUID()}${IMAGE_TYPES.get(mime)}`);
  fs.writeFileSync(filePath, buffer, { mode: 0o600, flag: 'wx' });
  return { path: filePath, mime, bytes: buffer.length };
}

export function imagePromptSuffix(attachments = []) {
  const images = attachments.slice(0, MAX_INBOUND_IMAGES).map((item) => item.path).filter(Boolean);
  if (!images.length) return '';
  return `The user attached ${images.length} image${images.length === 1 ? '' : 's'}. Inspect the image content directly before answering:\n${images.join('\n')}`;
}

export function codexImageArgs(attachments = []) {
  return attachments.slice(0, MAX_INBOUND_IMAGES)
    .flatMap((item) => item?.path ? ['--image', item.path] : []);
}

export function cleanupInboundImages(directory, olderThanMs = 7 * 24 * 3600_000, now = Date.now()) {
  let removed = 0;
  try {
    for (const name of fs.readdirSync(directory)) {
      const filePath = path.join(directory, name);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && now - stat.mtimeMs > olderThanMs) { fs.unlinkSync(filePath); removed++; }
      } catch { /* another cleanup may have won */ }
    }
  } catch { /* directory does not exist yet */ }
  return removed;
}
