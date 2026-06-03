import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AffPage({ searchParams }) {
  const params = await searchParams;
  const affKey = params?.aff || params?.ref || params?.r || params?.key || '';

  const cookieStore = await cookies();
  if (affKey) {
    cookieStore.set('affiliate_ref', affKey, {
      httpOnly: false,
      maxAge: 90 * 24 * 3600,
      sameSite: 'lax',
      path: '/',
    });
  }

  redirect(affKey ? `/register?aff=${encodeURIComponent(affKey)}` : '/register');
}
