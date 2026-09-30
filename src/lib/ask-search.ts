// Search behind the "ask" box. Plain functions over the JSON index from
// /ask-index.json, so the same code runs in the browser and in tests.
//
// Each query word is matched against the index exactly, by prefix ("calc" →
// calculus) or with a typo ("resme" → resume), plus a few synonyms. Rare words
// count for more than common ones (IDF). An answer is only given when it
// covers most of the question and matches a title or keyword; otherwise the
// box says it couldn't find one and points to email.

export interface AskDoc {
  id: string;
  title: string;
  url: string;
  answer: string;
  keywords: string[];
  text: string;
  /** Section-level docs get a small boost over single items that match equally well. */
  boost?: number;
}

export interface AskIndex {
  docs: AskDoc[];
  synonyms: Record<string, string[]>;
  /** Doc to answer "who are you?"-style questions with. */
  aboutId: string;
  email: string;
}

export interface AskHit {
  doc: AskDoc;
  score: number;
  /** Share of the question's words this doc matched (0–1). */
  coverage: number;
  /** Matched at least one word in the title or keywords, not just the body. */
  strong: boolean;
}

export type AskResult =
  | { kind: 'greeting' | 'thanks' | 'empty' }
  | { kind: 'answer'; top: AskHit; related: AskHit[] }
  | { kind: 'unsure'; related: AskHit[] }
  | { kind: 'none' };

const STOP = new Set(
  `a an and are as at be been but by can could did do does doing for from had has have how i id im in into is it its
  just me my of on or so tell that the their them these this those to was what whats when where wheres which who whos
  why will with would you your yours youre yourself u ur r about any anything some something much many more info
  information detail details know let please pls kindly show give send share see find get look want need like also all
  list out there here thing things stuff mean means meaning number parjanya parjanyas shankar he his ok okay`.split(/\s+/),
);

// Words that help when they match but shouldn't count against a doc when
// they don't: "how does the intro work", "what did you build".
const SOFT_WORDS = 'work use make made build built done go take think start new current get'.split(' ');

// Questions about the person rather than a topic ("who are you?").
const ABOUT = /\b(who|yourself|parjanya|introduce)\b/;

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4' };

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}+#\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

const VOWEL = /[aeiou]/;

// A light stemmer (plurals, -ing, -ed, final -y and -e). It only has to be
// consistent, since the index and the question go through the same function:
// study, studies, studying → studi; course, courses → cours; coding → code.
export function stem(word: string) {
  let w = word;
  if (/\d/.test(w)) return w;
  if (w.length < 4) return w.length === 3 && /[^su]s$/.test(w) ? w.slice(0, -1) : w;
  if (/ie[sd]$/.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (/(ss|ch|sh|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  else if ((w.length > 5 && w.endsWith('ing')) || (w.length > 4 && w.endsWith('ed'))) {
    w = w.slice(0, w.endsWith('ing') ? -3 : -2);
    const n = w.length;
    // running → run, planned → plan
    if (/([^aeiouls])\1$/.test(w)) w = w.slice(0, -1);
    // coding → code, hiring → hire
    else if (n >= 3 && n <= 4 && !VOWEL.test(w[n - 3]) && VOWEL.test(w[n - 2]) && !/[aeiouwxy]/.test(w[n - 1])) w += 'e';
  }
  if (w.length > 3 && /[^aeiou]y$/.test(w)) w = w.slice(0, -1) + 'i';
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** Words of `s` without stop words, as [stem, original length] pairs. */
function words(s: string): [string, number][] {
  return norm(s)
    .split(' ')
    .map((w) => ROMAN[w] ?? w)
    .filter((w) => w && (w.length > 1 || /\d/.test(w)) && !STOP.has(w))
    .map((w) => [stem(w), w.length]);
}

export const tokens = (s: string) => words(s).map(([t]) => t);

const SOFT = new Set(SOFT_WORDS.map(stem));

// Damerau-Levenshtein distance, stopping early once it passes `max`.
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

interface Prepared {
  doc: AskDoc;
  title: Set<string>;
  titlePhrase: string;
  keys: Set<string>;
  body: Map<string, number>;
}

export interface Searcher {
  search(query: string): AskResult;
}

export function createSearcher(index: AskIndex): Searcher {
  const docs: Prepared[] = index.docs.map((doc) => {
    const body = new Map<string, number>();
    for (const t of tokens(doc.text)) body.set(t, (body.get(t) ?? 0) + 1);
    const title = tokens(doc.title);
    return { doc, title: new Set(title), titlePhrase: title.join(' '), keys: new Set(doc.keywords.flatMap(tokens)), body };
  });
  const about = docs.find((p) => p.doc.id === index.aboutId);

  const synonyms = new Map<string, string[]>();
  for (const [k, v] of Object.entries(index.synonyms)) {
    const key = tokens(k).join(' ');
    if (key) synonyms.set(key, [...(synonyms.get(key) ?? []), ...v.flatMap(tokens)]);
  }

  // Vocabulary with document frequencies.
  const df = new Map<string, number>();
  for (const p of docs) for (const t of new Set([...p.title, ...p.keys, ...p.body.keys()])) df.set(t, (df.get(t) ?? 0) + 1);
  const vocab = [...df.keys()];
  const N = docs.length;
  const idf = (n: number) => Math.log(1 + (N - n + 0.5) / (n + 0.5));

  // Index words a query word could mean, with how sure we are. Typos are only
  // allowed for longer words, and never in the first letter.
  const cache = new Map<string, Map<string, number>>();
  function candidates(q: string, len: number) {
    const key = `${q}|${len}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const out = new Map<string, number>();
    const put = (t: string, w: number) => out.set(t, Math.max(out.get(t) ?? 0, w));
    if (df.has(q)) put(q, 1);
    const digits = /^\d+$/.test(q);
    for (const t of vocab) {
      if (t === q) continue;
      if ((q.length >= 4 || (digits && q.length >= 3)) && t.startsWith(q)) put(t, 0.75);
      else if (t.length >= 4 && !/\d/.test(t) && q.startsWith(t)) put(t, 0.7);
      else if (!digits && len >= 5 && t[0] === q[0]) {
        const max = len >= 8 ? 2 : 1;
        const d = distance(q, t, max);
        if (d <= max) put(t, d === 1 ? 0.7 : 0.55);
      }
    }
    cache.set(key, out);
    return out;
  }

  // [score, strong]: strong means the word is in the title or keywords, or
  // comes up more than once in the body.
  function fieldScore(p: Prepared, t: string): [number, boolean] {
    let s = 0;
    if (p.title.has(t)) s += 3;
    if (p.keys.has(t)) s += 3;
    const f = p.body.get(t) ?? 0;
    const strong = s > 0 || f > 1;
    if (f) s += Math.min(1 + Math.log(f), 2);
    return [s, strong];
  }

  function rank(query: string): AskHit[] {
    const seen = new Set<string>();
    const raw = words(query).filter(([t]) => !seen.has(t) && seen.add(t));
    if (!raw.length) return [];

    // Each query word expands to the index words it could mean (itself,
    // prefixes, near-misses and synonyms), each with a confidence.
    const terms = raw.map(([q, len]) => {
      const expanded = new Map(candidates(q, len));
      for (const s of synonyms.get(q) ?? [])
        for (const [t, w] of candidates(s, s.length)) expanded.set(t, Math.max(expanded.get(t) ?? 0, w * 0.8));
      const matching = docs.filter((p) => [...expanded.keys()].some((t) => fieldScore(p, t)[0] > 0)).length;
      return { expanded, weight: idf(matching), soft: SOFT.has(q) };
    });
    const phrase = raw.map(([t]) => t).join(' ');

    return docs
      .map((p) => {
        let score = 0;
        let covered = 0;
        let coveredWeight = 0;
        let asked = 0;
        let askedWeight = 0;
        let strong = false;
        for (const term of terms) {
          let best = 0;
          let bestStrong = false;
          for (const [t, w] of term.expanded) {
            const [s, isStrong] = fieldScore(p, t);
            if (s * w > best) (best = s * w), (bestStrong = isStrong);
          }
          if (best > 0) {
            score += term.weight * best;
            covered++;
            coveredWeight += term.weight;
            strong ||= bestStrong;
          }
          if (best > 0 || !term.soft) {
            asked++;
            askedWeight += term.weight;
          }
        }
        // Exact multi-word matches ("discrete structures", "cs 124") beat scattered words.
        if (raw.length > 1 && p.titlePhrase.includes(phrase)) score += 8;
        score *= p.doc.boost ?? 1;
        const coverage = asked ? Math.min(covered / asked, coveredWeight / askedWeight) : 0;
        return { doc: p.doc, score, coverage, strong };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score * (0.25 + 0.75 * b.coverage) - a.score * (0.25 + 0.75 * a.coverage));
  }

  const distinct = (hits: AskHit[], skip?: string) => {
    const seen = new Set(skip ? [skip] : []);
    return hits.filter((h) => !seen.has(h.doc.url) && seen.add(h.doc.url));
  };

  return {
    search(query) {
      const q = norm(query).trim();
      if (!q) return { kind: 'empty' };
      if (/^(hi+|hello|hey+|hiya|yo|howdy|namaste|namaskara|good (morning|afternoon|evening))( there)?$/.test(q))
        return { kind: 'greeting' };
      if (/^(thanks?( you)?|thank u|thx|ty|cheers|great|cool|nice)( so much)?$/.test(q)) return { kind: 'thanks' };

      const hits = rank(query);
      if (!hits.length && about && ABOUT.test(q))
        return { kind: 'answer', top: { doc: about.doc, score: 1, coverage: 1, strong: true }, related: [] };

      const top = hits.find((h) => h.strong && h.coverage >= 0.6);
      if (top) {
        const related = distinct(
          hits.filter((h) => h !== top && h.strong && h.coverage >= 0.5 && h.score >= top.score * 0.6),
          top.doc.url,
        ).slice(0, 2);
        return { kind: 'answer', top, related };
      }
      const maybe = distinct(hits.filter((h) => h.coverage >= 0.34 && (h.strong || h.coverage === 1))).slice(0, 2);
      return maybe.length ? { kind: 'unsure', related: maybe } : { kind: 'none' };
    },
  };
}
