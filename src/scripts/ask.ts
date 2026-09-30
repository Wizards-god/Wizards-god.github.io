// "Ask" box: answers questions about the site from a JSON index generated at
// build time (/ask-index.json). The search is in src/lib/ask-search.ts; there
// is no AI and no server, and nothing typed here leaves the browser.

import { html, animate, dur, EASE, prefersReducedMotion } from './motion';
import { createSearcher, type AskHit, type AskIndex, type Searcher } from '../lib/ask-search';

let index: AskIndex | null = null;
let searcher: Searcher | null = null;

async function load() {
  if (index && searcher) return { index, searcher };
  const res = await fetch('/ask-index.json');
  if (!res.ok) throw new Error(String(res.status));
  index = (await res.json()) as AskIndex;
  searcher = createSearcher(index);
  return { index, searcher };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function links(hits: AskHit[], label: string) {
  const p = el('p', 'ask__see', label);
  hits.forEach((h, i) => {
    const a = el('a', 'link link--quiet', h.doc.title);
    a.setAttribute('href', h.doc.url);
    p.append(a);
    if (i < hits.length - 1) p.append(document.createTextNode(' · '));
  });
  return p;
}

function contactLine(email: string, lead: string) {
  const p = el('p', '', lead);
  const a = el('a', 'link link--underlined', email);
  a.setAttribute('href', `mailto:${email}`);
  p.append(a, document.createTextNode('.'));
  return p;
}

export function initAsk() {
  const root = document.querySelector<HTMLElement>('[data-ask]');
  if (!root) return;
  const panel = root.querySelector<HTMLElement>('[data-ask-panel]')!;
  const openBtn = root.querySelector<HTMLButtonElement>('[data-ask-open]')!;
  const form = root.querySelector<HTMLFormElement>('[data-ask-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-ask-input]')!;
  const log = root.querySelector<HTMLElement>('[data-ask-log]')!;
  const body = root.querySelector<HTMLElement>('.ask__body')!;
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
      const { index: idx, searcher: engine } = await load();
      const result = engine.search(q);
      if (result.kind === 'greeting') {
        reply.append(el('p', '', 'Hi! Ask me about my projects, courses, writing, or how to get in touch.'));
      } else if (result.kind === 'thanks') {
        reply.append(el('p', '', "You're welcome."));
      } else if (result.kind === 'answer') {
        const { top, related } = result;
        reply.append(el('p', '', top.doc.answer));
        const link = el('a', 'ask__link link', `${top.doc.title} →`);
        link.setAttribute('href', top.doc.url);
        reply.append(link);
        if (related.length) reply.append(links(related, 'see also: '));
      } else if (result.kind === 'unsure') {
        reply.append(el('p', '', "I couldn't find an exact answer to that on this site."));
        reply.append(links(result.related, 'closest matches: '));
        reply.append(contactLine(idx.email, 'For anything else, email me at '));
      } else {
        reply.append(el('p', '', "Sorry, I couldn't find anything about that on this site."));
        reply.append(contactLine(idx.email, 'For more info, email me at '));
      }
    } catch {
      reply.textContent = "Couldn't load the site index. Try again in a moment.";
    }
    // Keep the newest question and answer in view.
    body.scrollTop = body.scrollHeight;
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
