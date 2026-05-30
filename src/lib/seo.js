// src/lib/seo.js
// Central SEO metadata for RTSMM-TH public landing/service pages.
// Keep this file deterministic: routes can spread seoMeta(path) into res.render().

const SITE_URL = 'https://rtsmm-th.com';
const SITE_NAME = 'RTSMM-TH.COM';
const BRAND = 'RTSMM-TH';
const DEFAULT_OG = `${SITE_URL}/static/og/og-default.png`;

export const SEO_PAGES = {
  '/': {
    title: 'RTSMM-TH.COM | ปั้มไลค์ OTP24 แอปพรีเมี่ยม Telegram Bot และเครื่องมือ 2FA',
    description: 'RTSMM-TH.COM ศูนย์รวมบริการการตลาดออนไลน์ ระบบปั้มไลค์ ปั้มผู้ติดตาม ปั้มวิว TikTok Instagram Facebook YouTube, บริการ OTP24 ชั่วโมง, แอปพรีเมี่ยม บัญชีโซเชียล, Telegram Bot และเครื่องมือ 2FA ครบในเว็บเดียว',
    keywords: 'ปั้มไลค์, ปั้มผู้ติดตาม, ปั้มวิว, ปั้มยอดวิว tiktok, ปั้มไลค์ facebook, ปั้มผู้ติดตาม instagram, ปั้มซับ youtube, smm panel ไทย, บริการ smm, otp24, รับ otp, เบอร์รับ otp, แอปพรีเมี่ยม, บัญชีพรีเมี่ยม, บัญชี netflix, บัญชี youtube, บัญชี facebook, telegram bot, บอทดึงสมาชิก, เครื่องมือ 2fa',
    serviceName: 'บริการการตลาดออนไลน์ OTP24 แอปพรีเมี่ยม Telegram Bot และ 2FA',
  },
  '/orders/new': {
    title: 'ปั้มไลค์ ปั้มผู้ติดตาม ปั้มวิว ราคาถูก | SMM Panel ไทย - RTSMM-TH',
    description: 'บริการ SMM Panel ไทยสำหรับปั้มไลค์ ปั้มผู้ติดตาม ปั้มวิว คอมเมนต์ แชร์ และ Engagement รองรับ Facebook TikTok Instagram YouTube และแพลตฟอร์มโซเชียลยอดนิยม สั่งซื้อง่าย มีระบบติดตามสถานะ',
    keywords: 'ปั้มไลค์, ปั้มผู้ติดตาม, ปั้มวิว, ปั้มไลค์ facebook, ปั้มผู้ติดตาม facebook, ปั้มวิว facebook, ปั้มไลค์ tiktok, ปั้มวิว tiktok, ปั้มผู้ติดตาม tiktok, ปั้มไลค์ instagram, ปั้มผู้ติดตาม instagram, ปั้มวิว youtube, ปั้มซับ youtube, เพิ่มยอดวิว, เพิ่มผู้ติดตาม, smm panel, smm panel ไทย, เว็บปั้มไลค์, เว็บปั้มผู้ติดตาม, เพิ่ม engagement',
    serviceName: 'SMM Panel และบริการเพิ่ม Engagement โซเชียล',
  },
  '/otp24': {
    title: 'OTP24 รับ OTP ออนไลน์ 24 ชั่วโมง | เบอร์รับ OTP ราคาคุ้ม - RTSMM-TH',
    description: 'บริการ OTP24 สำหรับรับรหัส OTP ออนไลน์ รองรับหลายประเทศและหลายแพลตฟอร์ม ใช้งานง่าย เลือกบริการได้ทันที เหมาะสำหรับงานยืนยันตัวตนและระบบที่ต้องใช้เบอร์รับ OTP',
    keywords: 'otp24, รับ otp, รับ otp ออนไลน์, เบอร์รับ otp, เบอร์ otp, otp 24 ชั่วโมง, เว็บรับ otp, เช่าเบอร์รับ otp, otp ราคาถูก, รับ sms otp, เบอร์รับ sms, sms otp online, otp ไทย, otp ต่างประเทศ',
    serviceName: 'บริการ OTP24 และเบอร์รับ OTP ออนไลน์',
  },
  '/apps': {
    title: 'แอปพรีเมี่ยม บัญชีโซเชียล Netflix YouTube Facebook | RTSMM-TH',
    description: 'รวมบริการแอปพรีเมี่ยมและบัญชีสำเร็จรูป บัญชีโซเชียล บัญชี Facebook, YouTube, Netflix, Gmail, VPN, AI Tools และบริการดิจิทัลอื่น ๆ ในที่เดียว เลือกซื้อสะดวก ตรวจสอบสถานะได้',
    keywords: 'แอปพรีเมี่ยม, แอพพรีเมี่ยม, บัญชีพรีเมี่ยม, บัญชีโซเชียล, ขายบัญชี facebook, ขายบัญชี youtube, บัญชี netflix, netflix ราคาถูก, youtube premium, gmail, บัญชี gmail, vpn premium, ai tools, แอคเคาท์พรีเมี่ยม, account premium',
    serviceName: 'บริการแอปพรีเมี่ยมและบัญชีดิจิทัล',
  },
  '/telegram': {
    title: 'Telegram Bot ดึงสมาชิกเข้ากลุ่ม บอทเทเลแกรม | RTSMM-TH',
    description: 'ระบบ Telegram Bot สำหรับจัดการบัญชี เทเลแกรมบอท และงานดึงสมาชิกเข้ากลุ่มหรือช่อง Telegram พร้อมระบบติดตามงานและประวัติการทำงาน เหมาะสำหรับงานคอมมูนิตี้และการตลาด',
    keywords: 'telegram bot, บอทเทเลแกรม, เทเลแกรมบอท, บอทดึงสมาชิก, ดึงสมาชิก telegram, เพิ่มสมาชิก telegram, telegram marketing, telegram group, telegram channel, บอทเพิ่มสมาชิกกลุ่ม, ระบบ telegram bot',
    serviceName: 'Telegram Bot และระบบดึงสมาชิกเข้ากลุ่ม',
  },
  '/2fa': {
    title: 'เครื่องมือ 2FA สร้างรหัสยืนยันสองชั้น | RTSMM-TH',
    description: 'เครื่องมือ 2FA สำหรับสร้างรหัสยืนยันตัวตนสองชั้นจาก Secret Key ใช้งานง่าย สะดวกสำหรับบัญชีที่ต้องใช้รหัส 2FA เพิ่มความปลอดภัยในการเข้าสู่ระบบ',
    keywords: '2fa, เครื่องมือ 2fa, two factor authentication, รหัส 2fa, สร้างรหัส 2fa, otp 2fa, google authenticator, authenticator code, รหัสยืนยันสองชั้น, 2fa code',
    serviceName: 'เครื่องมือสร้างรหัส 2FA',
  },
  '/mails': {
    title: 'เครื่องมือดู Mail และ OTP Mail | RTSMM-TH',
    description: 'เครื่องมือดูอีเมลสำหรับบริการที่ต้องเช็คข้อความหรือ OTP Mail ใช้งานสะดวกบนระบบ RTSMM-TH',
    keywords: 'mail otp, otp mail, เครื่องมือดูเมล, ดูอีเมล otp, mail tool, email otp',
    serviceName: 'เครื่องมือดู Mail และ OTP Mail',
  },
};

function normPath(path = '/') {
  const clean = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (clean.startsWith('/apps/') && clean !== '/apps/icon') return '/apps';
  if (clean.startsWith('/2fa')) return '/2fa';
  if (clean.startsWith('/mailz') || clean.startsWith('/mails')) return '/mails';
  return SEO_PAGES[clean] ? clean : '/';
}

function breadcrumbJsonLd(path) {
  const p = SEO_PAGES[normPath(path)] || SEO_PAGES['/'];
  const clean = normPath(path);
  const items = [
    { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE_URL },
  ];
  if (clean !== '/') items.push({ '@type': 'ListItem', position: 2, name: p.serviceName || p.title, item: `${SITE_URL}${clean}` });
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
}

function serviceJsonLd(path) {
  const clean = normPath(path);
  const p = SEO_PAGES[clean] || SEO_PAGES['/'];
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: p.serviceName,
    description: p.description,
    provider: {
      '@type': 'Organization',
      name: BRAND,
      url: SITE_URL,
      logo: `${SITE_URL}/static/logo/logo-rtssm-th.png`,
    },
    areaServed: { '@type': 'Country', name: 'Thailand' },
    serviceType: p.serviceName,
    url: `${SITE_URL}${clean}`,
  });
}

export function seoMeta(path = '/', overrides = {}) {
  const clean = normPath(path);
  const p = { ...(SEO_PAGES[clean] || SEO_PAGES['/']), ...overrides };
  return {
    title: p.title,
    pageTitle: p.title,
    metaDescription: p.description,
    metaKeywords: p.keywords,
    metaOgImage: p.ogImage || DEFAULT_OG,
    metaOgType: 'website',
    metaRobots: p.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    breadcrumbJsonLd: breadcrumbJsonLd(clean),
    structuredDataJsonLd: serviceJsonLd(clean),
  };
}

export function canonicalPath(path = '/') {
  return normPath(path);
}
