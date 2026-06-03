import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function safeFilename(value = '') {
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(value || ''));
  } catch (_) {
    return '';
  }
  const base = path.basename(decoded);
  if (!base || base !== decoded) return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return '';
  return base;
}

export async function GET(_request, { params }) {
  const filename = safeFilename(params?.filename);
  if (!filename) return new NextResponse('Not found', { status: 404 });

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'public', 'uploads', 'avatars', filename),
    path.join(cwd, 'uploads', 'avatars', filename),
  ];

  for (const filePath of candidates) {
    try {
      const buffer = await readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    } catch (_) {}
  }

  return new NextResponse('Not found', { status: 404 });
}
