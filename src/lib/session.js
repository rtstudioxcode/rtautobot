import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'rtautobot-dev-secret-change-in-production-32chars',
  cookieName: 'rtsmm.sid',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600,
  },
};

export async function getSession() {
  return getIronSession(await cookies(), sessionOptions);
}

export async function getSessionFromRequest(req) {
  return getIronSession(req, sessionOptions);
}

export function requireUser(session) {
  if (!session?.user?._id) return null;
  return session.user;
}

export function requireAdmin(session) {
  const user = requireUser(session);
  if (!user || user.role !== 'admin') return null;
  return user;
}
