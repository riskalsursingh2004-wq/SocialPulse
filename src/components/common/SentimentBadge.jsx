import { SENTIMENT_META } from '../../utils/constants.js';

const SIZES = {
  sm: 'px-1.5 py-0.5 text-[9px]',
  md: 'px-2 py-0.5 text-[11px]',
};

/** Coloured sentiment pill (Positive / Neutral / Negative). */
export default function SentimentBadge({ sentiment = 'Neutral', size = 'md' }) {
  const meta = SENTIMENT_META[sentiment] || SENTIMENT_META.Neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold tracking-wide uppercase ${meta.bg} ${meta.text} ${meta.border} ${SIZES[size] || SIZES.md}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {sentiment}
    </span>
  );
}
