export default function sitemap() {
  const base = 'https://rtautobot.com';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/page/terms-of-use`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
