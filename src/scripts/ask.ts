// "Ask" box: answers questions about the site from a JSON index generated at
// build time (/ask-index.json). Keyword + synonym scoring; no AI, no server.

import { html, animate, dur, EASE, prefersReducedMotion } from './motion';

interface Doc {
  id: string;
  title: string;
  url: string;
  answer: string;
  keywords: string[];
  text: string;
}
interface Index {
  docs: Doc[];
  synonyms: Record<string, string[]>;
  fallback: string;
}

const STOP = new Set(
  'a an and are as at be by can did do does for from has have how i in is it its me my of on or so tell that the their there this to was what when where which who why will with you your yours about any'.split(
    ' ',
  ),
);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, ' ');

function stem(w: string) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const tokens = (s: string) =>
  norm(s)
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w && !STOP.has(w))
    .map(stem);

let index: Index | null = null;
let prepared: { doc: Doc; title: Set<string>; keys: Set<string>; body: Map<string, number> }[] = [];

async function load() {
  if (index) return index;
  const res = await fetch('/ask-index.json');
  index = (await res.json()) as Index;
  prepared = index.docs.map((doc) => {
    const body = new Map<string, number>();
    for (const t of tokens(doc.text)) body.set(t, (body.get(t) ?? 0) + 1);
    return { doc, title: new Set(tokens(doc.title)), keys: new Set(doc.keywords.flatMap(tokens)), body };
  });
  return index;
}

function expand(q: string[], synonyms: Record<string, string[]>) {
  const out = new Map<string, number>();
  for (const t of q) {
    out.set(t, Math.max(out.get(t) ?? 0, 1));
    for (const s of synonyms[t] ?? []) for (const st of tokens(s)) out.set(st, Math.max(out.get(st) ?? 0, 0.8));
  }
  return out;
}

function search(query: string) {
  if (!index) return [];
  const raw = tokens(query);
  const q = expand(raw, index.synonyms);
  if (!q.size) return [];
  const phrase = raw.join(' ');
  return prepared
    .map((p) => {
      let score = 0;
      // Exact multi-word matches ("order book") beat scattered single words.
      if (raw.length > 1 && tokens(p.doc.title).join(' ').includes(phrase)) score += 6;
      for (const [t, w] of q) {
        if (p.title.has(t)) score += 3 * w;
        if (p.keys.has(t)) score += 2.5 * w;
        const f = p.body.get(t);
        if (f) score += Math.min(1 + Math.log(f), 2) * w;
      }
      return { doc: p.doc, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export function initAsk() {
  const root = document.querySelector<HTMLElement>('[data-ask]');
  if (!root) return;
  const panel = root.querySelector<HTMLElement>('[data-ask-panel]')!;
  const openBtn = root.querySelector<HTMLButtonElement>('[data-ask-open]')!;
  const form = root.querySelector<HTMLFormElement>('[data-ask-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-ask-input]')!;
  const log = root.querySelector<HTMLElement>('[data-ask-log]')!;
  const backdrop = root.querySelector<HTMLElement>('[data-ask-backdrop]')!;
  let isOpen = false;

  const outside = () => [...document.querySelectorAll<HTMLElement>('main, .site-footer, [data-header], .rails, .skip-link')];

  const setOpen = async (next: boolean) => {
    if (next === isOpen) return;
    isOpen = next;
    openBtn.setAttribute('aria-expanded', String(next));
    outside().forEach((n) => (n.inert = next));
    html.classList.toggle('ask-open', next);
    if (next) {
      panel.hidden = false;
      backdrop.hidden = false;
      load().catch(() => {
        /* reported on first question */
      });
      if (!prefersReducedMotion()) {
        animate(panel, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], {
          duration: dur(250),
          easing: EASE.out,
        });
      }
      input.focus({ preventScroll: true });
    } else {
      if (!prefersReducedMotion()) {
        await animate(panel, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px)' }], {
          duration: dur(180),
          easing: EASE.ui,
        });
      }
      panel.hidden = true;
      backdrop.hidden = true;
      openBtn.focus({ preventScroll: true });
    }
  };

  const answer = async (q: string) => {
    const question = el('li', 'ask__q');
    question.append(el('span', 'ask__prompt', '>'), document.createTextNode(' ' + q));
    log.append(question);
    const reply = el('li', 'ask__a');
    log.append(reply);
    try {
      const idx = await load();
      const results = search(q);
      if (!results.length) {
        reply.textContent = idx.fallback;
      } else {
        const [top, ...rest] = results;
        reply.append(el('p', '', top.doc.answer));
        const link = el('a', 'ask__link link', `${top.doc.title} →`);
        link.setAttribute('href', top.doc.url);
        reply.append(link);
        const related = rest.filter((r) => r.score >= top.score * 0.45 && r.doc.url !== top.doc.url).slice(0, 2);
        if (related.length) {
          const see = el('p', 'ask__see', 'see also: ');
          related.forEach((r, i) => {
            const a = el('a', 'link link--quiet', r.doc.title);
            a.setAttribute('href', r.doc.url);
            see.append(a);
            if (i < related.length - 1) see.append(document.createTextNode(' · '));
          });
          reply.append(see);
        }
      }
    } catch {
      reply.textContent = 'Could not load the site index. Try again in a moment.';
    }
    log.scrollTop = log.scrollHeight;
  };

  openBtn.addEventListener('click', () => setOpen(!isOpen));
  root.querySelector('[data-ask-close]')?.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  root.querySelectorAll<HTMLButtonElement>('[data-ask-suggest]').forEach((b) =>
    b.addEventListener('click', () => answer(b.textContent ?? '')),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    answer(q);
  });
  panel.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a[href^="/"]')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setOpen(false);
    }
  });
  document.addEventListener('astro:before-preparation', () => {
    if (isOpen) {
      isOpen = false;
      outside().forEach((n) => (n.inert = false));
      panel.hidden = true;
      backdrop.hidden = true;
      html.classList.remove('ask-open');
      openBtn.setAttribute('aria-expanded', 'false');
    }
  });
}
