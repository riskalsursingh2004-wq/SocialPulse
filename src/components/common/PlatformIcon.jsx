import { PLATFORM_META } from '../../utils/constants.js';

const SIZES = {
  sm: 'h-6 w-6 rounded-md text-[9px]',
  md: 'h-8 w-8 rounded-lg text-[11px]',
};

/**
 * Platform avatar: coloured initials (IG / FB / X / YT / LI).
 * lucide removed brand logos, so short codes keep the feed/table consistent.
 */
export default function PlatformIcon({ platform, size = 'md' }) {
  const meta = PLATFORM_META[platform] || { color: '#64748B', short: '?' };
  return (
    <span
      className={`inline-grid shrink-0 place-items-center border font-bold ${SIZES[size] || SIZES.md}`}
      style={{
        backgroundColor: `${meta.color}1f`,
        borderColor: `${meta.color}66`,
        color: meta.color,
      }}
      title={platform}
      aria-label={platform}
    >
      {meta.short}
    </span>
  );
}
