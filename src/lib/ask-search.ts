// The search behind the "ask" box. It's plain functions over the JSON index
// from /ask-index.json, so it runs the same in the browser and in a test.
//
// Each word of the question is matched against the index exactly, by prefix
// ("calc" finds calculus) or with a typo ("resme" finds resume), plus a few
// synonyms. Rare words count for more than common ones (IDF, the usual search
// trick). It only gives an answer when that page covers most of the question
// and matches a title or keyword. Otherwise it says it couldn't find one and
// points to my email.

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
  /** The doc that answers "who are you?"-style questions. */
  aboutId: string;
  email: string;
}

export interface AskHit {
  doc: AskDoc;
  score: number;
  /** How much of the question this doc matched, from 0 to 1. */
  coverage: number;
  /** Matched at least one word in the title or keywords, not just the body. */
  strong: boolean;
}

export type AskResult =
  | { kind: 'greeting' | 'thanks' | 'empty' }
  | { kind: 'answer'; top: AskHit; related: AskHit[] }
  | { kind: 'unsure'; related: AskHit[] }
  | { kind: 'none' };

// ---- Turning text into words ---------------------------------------------

// Filler that says nothing about what's being asked. My own name is in here
// too: "what is parjanya studying" is a question about studying.
const STOP_WORDS = new Set(
  `a an and are as at be been but by can could did do does doing for from had has have how i id im in into is it its
  just me my of on or so tell that the their them these this those to was what whats when where wheres which who whos
  why will with would you your yours youre yourself u ur r about any anything some something much many more info
  information detail details know let please pls kindly show give send share see find get look want need like also all
  list out there here thing things stuff mean means meaning number parjanya parjanyas shankar he his ok okay`.split(/\s+/),
);

// Words that help when they match, but shouldn't count against a page when
// they don't, as in "how does the intro work" or "what did you build".
const SOFT_WORDS = 'work use make made build built done go take think start new current get'.split(' ');

// Questions about me rather than a topic ("who are you?").
const ABOUT_ME = /\b(who|yourself|parjanya|introduce)\b/;

// So "Calculus III" and "calc 3" can meet.
const ROMAN_NUMERALS: Record<string, string> = { ii: '2', iii: '3', iv: '4' };

/** Lower case, accents and apostrophes gone, "cs124" split into "cs 124", punctuation turned into spaces. */
function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}+#\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

const VOWEL = /[aeiou]/;

/**
 * A light stemmer: it trims plurals, -ing, -ed and a final -y or -e. It
 * doesn't have to produce real words, only the same stem for the index and
 * the question, e.g. study, studies, studying → studi; course, courses →
 * cours; coding → code.
 */
function stem(word: string) {
  let result = word;
  if (/\d/.test(result)) return result;
  if (result.length < 4) return result.length === 3 && /[^su]s$/.test(result) ? result.slice(0, -1) : result;

  if (/ie[sd]$/.test(result) && result.length > 4) result = result.slice(0, -2);
  else if (/(ss|ch|sh|x|z)es$/.test(result)) result = result.slice(0, -2);
  else if (result.endsWith('s') && !/(ss|us|is)$/.test(result)) result = result.slice(0, -1);
  else if ((result.length > 5 && result.endsWith('ing')) || (result.length > 4 && result.endsWith('ed'))) {
    result = result.slice(0, result.endsWith('ing') ? -3 : -2);
    const length = result.length;
    // running → run, planned → plan
    if (/([^aeiouls])\1$/.test(result)) result = result.slice(0, -1);
    // coding → code, hiring → hire
    else if (
      length >= 3 &&
      length <= 4 &&
      !VOWEL.test(result[length - 3]) &&
      VOWEL.test(result[length - 2]) &&
      !/[aeiouwxy]/.test(result[length - 1])
    )
      result += 'e';
  }

  if (result.length > 3 && /[^aeiou]y$/.test(result)) result = result.slice(0, -1) + 'i';
  if (result.length > 4 && result.endsWith('e')) result = result.slice(0, -1);
  return result;
}

interface Word {
  stem: string;
  /** Length of the word before stemming; typos are only forgiven in longer words. */
  length: number;
}

/** The meaningful words in `text`, stemmed. */
function wordsIn(text: string): Word[] {
  return normalise(text)
    .split(' ')
    .map((word) => ROMAN_NUMERALS[word] ?? word)
    .filter((word) => word && (word.length > 1 || /\d/.test(word)) && !STOP_WORDS.has(word))
    .map((word) => ({ stem: stem(word), length: word.length }));
}

const stemsIn = (text: string) => wordsIn(text).map((word) => word.stem);

const SOFT_STEMS = new Set(SOFT_WORDS.map(stem));

/**
 * How many edits (insert, delete, swap two letters, change one) turn `a` into
 * `b` (Damerau-Levenshtein). It gives up early and returns `max + 1` once
 * the answer is bound to be bigger than `max`.
 */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const table: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) table[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMinimum = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + substitutionCost);
      const swapped = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (swapped) table[i][j] = Math.min(table[i][j], table[i - 2][j - 2] + 1);
      rowMinimum = Math.min(rowMinimum, table[i][j]);
    }
    if (rowMinimum > max) return max + 1;
  }
  return table[a.length][b.length];
}

// ---- Searching -----------------------------------------------------------

/** A doc from the index, with its words counted up ahead of time. */
interface IndexedDoc {
  doc: AskDoc;
  titleStems: Set<string>;
  titlePhrase: string;
  keywordStems: Set<string>;
  /** How many times each stem appears in the body text. */
  bodyCounts: Map<string, number>;
}

/** One word of the question, with every index word it might mean. */
interface QuestionTerm {
  /** Index word → how sure we are it's what was meant (1 = exact match). */
  meanings: Map<string, number>;
  /** IDF: rarer words count for more. */
  weight: number;
  soft: boolean;
}

export interface Searcher {
  search(question: string): AskResult;
}

export function createSearcher(index: AskIndex): Searcher {
  const docs: IndexedDoc[] = index.docs.map((doc) => {
    const bodyCounts = new Map<string, number>();
    for (const word of stemsIn(doc.text)) bodyCounts.set(word, (bodyCounts.get(word) ?? 0) + 1);
    const titleStems = stemsIn(doc.title);
    return {
      doc,
      titleStems: new Set(titleStems),
      titlePhrase: titleStems.join(' '),
      keywordStems: new Set(doc.keywords.flatMap(stemsIn)),
      bodyCounts,
    };
  });
  const aboutDoc = docs.find((indexed) => indexed.doc.id === index.aboutId);

  const synonyms = new Map<string, string[]>();
  for (const [word, alternatives] of Object.entries(index.synonyms)) {
    const key = stemsIn(word).join(' ');
    if (key) synonyms.set(key, [...(synonyms.get(key) ?? []), ...alternatives.flatMap(stemsIn)]);
  }

  // Every word in the index, and how many docs it appears in.
  const docsContaining = new Map<string, number>();
  for (const indexed of docs) {
    for (const word of new Set([...indexed.titleStems, ...indexed.keywordStems, ...indexed.bodyCounts.keys()])) {
      docsContaining.set(word, (docsContaining.get(word) ?? 0) + 1);
    }
  }
  const vocabulary = [...docsContaining.keys()];
  const totalDocs = docs.length;
  // The BM25 flavour of IDF: close to zero for words in every doc, large for rare ones.
  const inverseDocFrequency = (matchingDocs: number) => Math.log(1 + (totalDocs - matchingDocs + 0.5) / (matchingDocs + 0.5));

  // The index words a question word could mean, and how sure we are about
  // each. Typos are only allowed in longer words, and never in the first letter.
  const meaningsCache = new Map<string, Map<string, number>>();
  function possibleMeanings(wordStem: string, wordLength: number) {
    const cacheKey = `${wordStem}|${wordLength}`;
    const cached = meaningsCache.get(cacheKey);
    if (cached) return cached;

    const meanings = new Map<string, number>();
    const consider = (indexWord: string, confidence: number) =>
      meanings.set(indexWord, Math.max(meanings.get(indexWord) ?? 0, confidence));

    if (docsContaining.has(wordStem)) consider(wordStem, 1);
    const isNumber = /^\d+$/.test(wordStem);
    for (const indexWord of vocabulary) {
      if (indexWord === wordStem) continue;
      // "calc" → calculus, "241" → 241h
      if ((wordStem.length >= 4 || (isNumber && wordStem.length >= 3)) && indexWord.startsWith(wordStem)) consider(indexWord, 0.75);
      // the other way round: "writing" (stem "write") → writ
      else if (indexWord.length >= 4 && !/\d/.test(indexWord) && wordStem.startsWith(indexWord)) consider(indexWord, 0.7);
      // typos: one in a word of 5+ letters, two in 8+
      else if (!isNumber && wordLength >= 5 && indexWord[0] === wordStem[0]) {
        const allowedEdits = wordLength >= 8 ? 2 : 1;
        const edits = editDistance(wordStem, indexWord, allowedEdits);
        if (edits <= allowedEdits) consider(indexWord, edits === 1 ? 0.7 : 0.55);
      }
    }
    meaningsCache.set(cacheKey, meanings);
    return meanings;
  }

  /**
   * How well one index word matches a doc: titles and keywords count most,
   * then how often it shows up in the body. "Strong" means it's in the title
   * or keywords, or comes up more than once in the body.
   */
  function matchStrength(indexed: IndexedDoc, indexWord: string): [score: number, strong: boolean] {
    let score = 0;
    if (indexed.titleStems.has(indexWord)) score += 3;
    if (indexed.keywordStems.has(indexWord)) score += 3;
    const timesInBody = indexed.bodyCounts.get(indexWord) ?? 0;
    const strong = score > 0 || timesInBody > 1;
    if (timesInBody) score += Math.min(1 + Math.log(timesInBody), 2);
    return [score, strong];
  }

  function rankDocs(question: string): AskHit[] {
    const seenStems = new Set<string>();
    const questionWords = wordsIn(question).filter((word) => !seenStems.has(word.stem) && seenStems.add(word.stem));
    if (!questionWords.length) return [];

    // Each question word expands into every index word it might mean: itself,
    // prefixes, near misses and synonyms (synonyms count a bit less).
    const terms: QuestionTerm[] = questionWords.map((word) => {
      const meanings = new Map(possibleMeanings(word.stem, word.length));
      for (const synonym of synonyms.get(word.stem) ?? []) {
        for (const [indexWord, confidence] of possibleMeanings(synonym, synonym.length)) {
          meanings.set(indexWord, Math.max(meanings.get(indexWord) ?? 0, confidence * 0.8));
        }
      }
      const matchingDocs = docs.filter((indexed) =>
        [...meanings.keys()].some((indexWord) => matchStrength(indexed, indexWord)[0] > 0),
      ).length;
      return { meanings, weight: inverseDocFrequency(matchingDocs), soft: SOFT_STEMS.has(word.stem) };
    });
    const questionPhrase = questionWords.map((word) => word.stem).join(' ');

    return docs
      .map((indexed) => {
        let score = 0;
        let matchedTerms = 0;
        let matchedWeight = 0;
        let countedTerms = 0;
        let countedWeight = 0;
        let strong = false;

        for (const term of terms) {
          // The best way this question word matches this doc.
          let bestScore = 0;
          let bestIsStrong = false;
          for (const [indexWord, confidence] of term.meanings) {
            const [wordScore, wordIsStrong] = matchStrength(indexed, indexWord);
            if (wordScore * confidence > bestScore) {
              bestScore = wordScore * confidence;
              bestIsStrong = wordIsStrong;
            }
          }
          if (bestScore > 0) {
            score += term.weight * bestScore;
            matchedTerms++;
            matchedWeight += term.weight;
            strong ||= bestIsStrong;
          }
          // Soft words only count towards coverage when they match.
          if (bestScore > 0 || !term.soft) {
            countedTerms++;
            countedWeight += term.weight;
          }
        }

        // The exact phrase in a title ("discrete structures", "cs 124") beats the same words scattered about.
        if (questionWords.length > 1 && indexed.titlePhrase.includes(questionPhrase)) score += 8;
        score *= indexed.doc.boost ?? 1;
        // Coverage has to be good both by count and by weight, so one rare word can't carry a long question.
        const coverage = countedTerms ? Math.min(matchedTerms / countedTerms, matchedWeight / countedWeight) : 0;
        return { doc: indexed.doc, score, coverage, strong };
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score * (0.25 + 0.75 * b.coverage) - a.score * (0.25 + 0.75 * a.coverage));
  }

  /** Drops hits that point at the same page as an earlier one (or as `skipUrl`). */
  const onePerPage = (hits: AskHit[], skipUrl?: string) => {
    const seenUrls = new Set(skipUrl ? [skipUrl] : []);
    return hits.filter((hit) => !seenUrls.has(hit.doc.url) && seenUrls.add(hit.doc.url));
  };

  return {
    search(question) {
      const normalised = normalise(question).trim();
      if (!normalised) return { kind: 'empty' };
      if (/^(hi+|hello|hey+|hiya|yo|howdy|namaste|namaskara|good (morning|afternoon|evening))( there)?$/.test(normalised)) {
        return { kind: 'greeting' };
      }
      if (/^(thanks?( you)?|thank u|thx|ty|cheers|great|cool|nice)( so much)?$/.test(normalised)) return { kind: 'thanks' };

      const hits = rankDocs(question);
      // "Who are you?" is all stop words, so nothing matches; answer it with the about doc.
      if (!hits.length && aboutDoc && ABOUT_ME.test(normalised)) {
        return { kind: 'answer', top: { doc: aboutDoc.doc, score: 1, coverage: 1, strong: true }, related: [] };
      }

      const top = hits.find((hit) => hit.strong && hit.coverage >= 0.6);
      if (top) {
        const related = onePerPage(
          hits.filter((hit) => hit !== top && hit.strong && hit.coverage >= 0.5 && hit.score >= top.score * 0.6),
          top.doc.url,
        ).slice(0, 2);
        return { kind: 'answer', top, related };
      }

      // Nothing good enough to call an answer: offer the closest pages, if any are close at all.
      const closest = onePerPage(hits.filter((hit) => hit.coverage >= 0.34 && (hit.strong || hit.coverage === 1))).slice(0, 2);
      return closest.length ? { kind: 'unsure', related: closest } : { kind: 'none' };
    },
  };
}
