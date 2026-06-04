export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/dashboard', '/bonustime', '/topup', '/account', '/wallet'],
      },
    ],
    sitemap: 'https://rtautobot.com/sitemap.xml',
  };
}
