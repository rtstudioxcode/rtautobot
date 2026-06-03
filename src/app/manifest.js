export default function manifest() {
  return {
    name: 'RTAUTOBOT',
    short_name: 'RTAUTOBOT',
    description: 'ระบบ Bonustime LINE Bot อัตโนมัติ',
    start_url: '/',
    display: 'standalone',
    background_color: '#06111f',
    theme_color: '#07a84a',
    icons: [
      { src: '/assets/logo/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { src: '/assets/logo/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/assets/logo/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/logo/favicon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/assets/logo/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
