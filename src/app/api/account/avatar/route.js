import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function extFromMime(mime = '') {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  return '.bin';
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || typeof file === 'string')
      return NextResponse.json({ ok: false, error: 'ไม่พบไฟล์รูปภาพ' }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ ok: false, error: 'รองรับเฉพาะ PNG, JPG, WEBP, GIF' }, { status: 400 });

    if (file.size > MAX_SIZE)
      return NextResponse.json({ ok: false, error: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' }, { status: 400 });

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    const ext = extFromMime(file.type);
    const uid = String(session.user._id);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${uid}-${unique}${ext}`;
    const filepath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const u = await User.findById(session.user._id);
    if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });

    u.avatarUrl = `/uploads/avatars/${filename}`;
    u.avatarVer = Number(u.avatarVer || 0) + 1;
    await u.save();

    // Update session
    session.user.avatarUrl = u.avatarUrl;
    await session.save();

    return NextResponse.json({
      ok: true,
      avatarUrl: u.avatarUrl,
      avatarVer: u.avatarVer,
    });
  } catch (e) {
    console.error('POST /api/account/avatar', e);
    return NextResponse.json({ ok: false, error: 'อัปโหลดรูปไม่สำเร็จ' }, { status: 500 });
  }
}
