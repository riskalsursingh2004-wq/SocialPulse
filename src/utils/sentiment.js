/**
 * Deterministic, keyword-based sentiment classifier.
 *
 * How it works (this is intentionally simple — see the UI disclaimer):
 *  1. Normalise the text: lowercase, strip punctuation, collapse whitespace.
 *  2. Count how many configured positive terms and negative terms appear.
 *     Matching is token-based, so "best" does NOT match inside "bestowed".
 *  3. Positive if positiveCount > negativeCount, negative if the reverse,
 *     otherwise neutral. Ties are neutral.
 *
 * No external API, no AI model — fully offline and reproducible.
 */

export const POSITIVE_WORDS = [
  'love', 'loved', 'loving', 'great', 'amazing', 'excellent', 'happy', 'awesome',
  'good', 'best', 'fantastic', 'beautiful', 'helpful', 'success', 'successful',
  'wonderful', 'perfect', 'recommend', 'recommended', 'thrilled', 'impressed',
  'grateful', 'exciting', 'excited', 'reliable', 'progress', 'winning', 'winner',
  'outstanding', 'enjoyed', 'enjoy', 'thanks', 'appreciate', 'appreciated', 'brilliant',
];

export const NEGATIVE_WORDS = [
  'hate', 'hated', 'hating', 'bad', 'terrible', 'awful', 'disappointed', 'disappointing',
  'worst', 'angry', 'poor', 'boring', 'broken', 'problem', 'problems', 'failure',
  'failed', 'fail', 'useless', 'frustrating', 'frustrated', 'issue', 'issues',
  'crash', 'crashes', 'crashed', 'spam', 'scam', 'rude', 'delayed', 'delay',
  'cancelled', 'canceled', 'buggy', 'slow', 'unusable', 'regret',
];

/** Multi-word phrases give slightly better coverage than single words. */
export const POSITIVE_PHRASES = ['highly recommend', 'love it', 'great job', 'worth it', 'very helpful', 'great experience'];
export const NEGATIVE_PHRASES = ['waste of time', 'never again', 'not working', 'does not work', 'worst ever', 'so bad', 'keep crashing'];

/**
 * Lowercase, replace every non-alphanumeric character with a space,
 * then collapse whitespace. Punctuation therefore never blocks a match.
 */
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function countWord(tokens, word) {
  let count = 0;
  for (const token of tokens) if (token === word) count += 1;
  return count;
}

function countPhrase(padded, phrase) {
  // phrase is already normalised (single spaces, no punctuation)
  const needle = ` ${phrase} `;
  let count = 0;
  let index = padded.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = padded.indexOf(needle, index + needle.length);
  }
  return count;
}

/** Count occurrences of every term/phrase in a normalised text. */
function countTerms(normalized, words, phrases) {
  const tokens = normalized ? normalized.split(' ') : [];
  const padded = ` ${normalized} `;
  let total = 0;
  for (const w of words) total += countWord(tokens, w);
  for (const p of phrases) total += countPhrase(padded, p);
  return total;
}

/**
 * Classify a post's text.
 * @returns {{ label: 'Positive'|'Neutral'|'Negative', positive: number, negative: number, score: number }}
 */
export function classifySentiment(text) {
  const normalized = normalizeText(text);
  const positive = countTerms(normalized, POSITIVE_WORDS, POSITIVE_PHRASES);
  const negative = countTerms(normalized, NEGATIVE_WORDS, NEGATIVE_PHRASES);

  let label = 'Neutral';
  if (positive > negative) label = 'Positive';
  else if (negative > positive) label = 'Negative';

  return { label, positive, negative, score: positive - negative };
}
