type SvgIconProps = {
  name: string;
  className?: string;
  size?: number;
  title?: string;
};

const paths: Record<string, JSX.Element> = {
  alert: <><path d="M12 8v5" /><path d="M12 17h.01" /><path d="M10.3 4.6h3.4l7.1 12.3a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3Z" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  bank: <><path d="M3 10h18L12 4Z" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8" /><path d="M3 18h18" /></>,
  brain: <><path d="M9 4.5A3.5 3.5 0 0 0 5.8 10 3.8 3.8 0 0 0 7 17.5" /><path d="M15 4.5A3.5 3.5 0 0 1 18.2 10 3.8 3.8 0 0 1 17 17.5" /><path d="M9 4.5v15M15 4.5v15" /></>,
  briefcase: <><path d="M9 7V5h6v2" /><path d="M4 8h16v11H4Z" /><path d="M4 12h16" /></>,
  bug: <><path d="M8 8a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0Z" /><path d="M3 13h5M16 13h5M4 19l4-3M20 19l-4-3M4 7l4 3M20 7l-4 3" /></>,
  calendar: <><path d="M7 3v4M17 3v4" /><path d="M4 6h16v14H4Z" /><path d="M4 10h16" /></>,
  card: <><path d="M3 6h18v12H3Z" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
  cart: <><path d="M4 5h2l2 10h9l3-7H7" /><circle cx="10" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15v-4M12 15V8M16 15v-7" /></>,
  check: <path d="M5 12.5 10 17l9-10" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  club: <><path d="M12 4a4 4 0 0 0-2.3 7.3A4 4 0 1 0 12 15a4 4 0 1 0 2.3-3.7A4 4 0 0 0 12 4Z" /><path d="M12 15v5" /><path d="M9 20h6" /></>,
  copy: <><path d="M8 8h11v11H8Z" /><path d="M5 16H4V4h12v1" /></>,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" /><circle cx="15" cy="9" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16Z" /><path d="m13 7 4 4" /></>,
  error: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  eye: <><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.7A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a18 18 0 0 1-2.3 3.2M6.7 6.9C4 8.7 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.8 0 3.4-.6 4.7-1.4" /></>,
  externalLink: <><path d="M14 5h5v5" /><path d="m10 14 9-9" /><path d="M19 14v5H5V5h5" /></>,
  file: <><path d="M7 3h7l4 4v14H7Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>,
  fire: <><path d="M12 21c4 0 7-2.7 7-6.4 0-3.1-2.1-5.1-4.4-7.6-.5 2-1.7 3.1-3.2 4.1.3-2.4-.6-5-2.8-7.1C8.2 7.6 5 10.2 5 14.6 5 18.3 8 21 12 21Z" /></>,
  folder: <><path d="M3 6h7l2 2h9v10H3Z" /></>,
  gamepad: <><path d="M7 10h10a4 4 0 0 1 3.7 5.5l-.5 1.2a2 2 0 0 1-3.1.8L15 16H9l-2.1 1.5a2 2 0 0 1-3.1-.8l-.5-1.2A4 4 0 0 1 7 10Z" /><path d="M8 13v3M6.5 14.5h3" /><path d="M16.5 14h.01M18.5 15.5h.01" /></>,
  gem: <><path d="M6 4h12l3 5-9 11L3 9Z" /><path d="M3 9h18M8 4l4 16 4-16" /></>,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  hourglass: <><path d="M6 3h12" /><path d="M6 21h12" /><path d="M8 3v5a4 4 0 0 0 2 3.5L12 13l2-1.5A4 4 0 0 0 16 8V3" /><path d="M8 21v-5a4 4 0 0 1 2-3.5L12 11l2 1.5A4 4 0 0 1 16 16v5" /></>,
  id: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M7 16a4 4 0 0 1 4 0" /><path d="M14 10h3M14 14h4" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m6 17 4-4 3 3 2-2 3 3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  key: <><circle cx="7.5" cy="12" r="3.5" /><path d="M11 12h10" /><path d="M17 12v3M14 12v2" /></>,
  laptop: <><path d="M5 5h14v10H5Z" /><path d="M3 19h18" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  mail: <><path d="M4 6h16v12H4Z" /><path d="m4 7 8 6 8-6" /></>,
  message: <><path d="M4 5h16v11H8l-4 4Z" /></>,
  money: <><path d="M3 7h18v10H3Z" /><circle cx="12" cy="12" r="3" /><path d="M6 10v4M18 10v4" /></>,
  newspaper: <><path d="M4 5h14a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2Z" /><path d="M8 9h6M8 13h8M8 17h5" /></>,
  package: <><path d="M12 3 4 7l8 4 8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>,
  paperPlane: <><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4Z" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  puzzle: <><path d="M8 4h4a2 2 0 0 1 4 0v2h2a2 2 0 0 1 2 2v4h-2a2 2 0 1 0 0 4h2v4h-6v-2a2 2 0 1 0-4 0v2H4v-6h2a2 2 0 1 0 0-4H4V4h4Z" /></>,
  rocket: <><path d="M5 19c3-1 5-3 6-6 3-1 6-4 8-9-5 2-8 5-9 8-3 1-5 3-6 6Z" /><path d="M14 6l4 4" /><path d="M5 19l-2 2" /></>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v6h-6" /></>,
  scale: <><path d="M12 3v18" /><path d="M5 6h14" /><path d="M6 6 3 13h6Z" /><path d="m18 6-3 7h6Z" /></>,
  scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="M8.5 8.5 20 20M8.5 15.5 20 4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  settings: <><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" /></>,
  shield: <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z" />,
  spark: <path d="M12 3l2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2Z" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12h.01" /></>,
  ticket: <><path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4Z" /><path d="M9 4v12" /></>,
  trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0Z" /><path d="M8 6H4a4 4 0 0 0 4 4M16 6h4a4 4 0 0 1-4 4" /><path d="M12 12v5M9 21h6M8 17h8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 7" /><path d="M18 14a6 6 0 0 1 4 7" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3Z" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 10-13h-7Z" />,
};

export default function SvgIcon({ name, className = '', size = 18, title }: SvgIconProps) {
  const body = paths[name] || paths.info;
  return (
    <svg
      className={`svg-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
