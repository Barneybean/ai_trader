import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  cleanupInboundImages,
  codexImageArgs,
  imagePromptSuffix,
  normalizedImageType,
  saveInboundImage,
} from '../../src/delivery/inbound-media.js';

test('stores verified images privately and rejects spoofed content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-image-'));
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('test')]);
  const saved = saveInboundImage(dir, png, 'image/png', 1000);
  assert.equal(saved.mime, 'image/png');
  assert.equal(fs.statSync(saved.path).mode & 0o777, 0o600);
  assert.throws(() => saveInboundImage(dir, Buffer.from('not an image'), 'image/png'));
  assert.equal(normalizedImageType('image/svg+xml'), null);
  fs.rmSync(dir, { recursive: true });
});

test('builds a model-visible image prompt and expires old media', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-image-'));
  const file = path.join(dir, 'old.jpg');
  fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
  fs.utimesSync(file, new Date(0), new Date(0));
  assert.match(imagePromptSuffix([{ path: '/private/a.jpg' }]), /Inspect the image content directly/);
  assert.deepEqual(codexImageArgs([{ path: '/private/a.jpg' }, { path: '/private/b.png' }]),
    ['--image', '/private/a.jpg', '--image', '/private/b.png']);
  assert.equal(cleanupInboundImages(dir, 1000, 5000), 1);
  fs.rmSync(dir, { recursive: true });
});
