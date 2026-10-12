// The "ask" box. It answers questions about the site from a small index made
// at build time (/ask-index.json), and the matching itself is in
// src/lib/ask-search.ts. There's no AI and no server involved: nothing typed
// here ever leaves the browser.

import { html, animate, dur, EASE, prefersReducedMotion } from './motion';
import { createSearcher, type AskHit, type AskIndex, type Searcher } from '../lib/ask-search';

// The index is only fetched the first time someone opens the box.
let index: AskIndex | null = null;
let searcher: Searcher | null = null;

async function loadIndex() {
  if (index && searcher) return { index, searcher };
  const response = await fetch('/ask-index.json');
  if (!response.ok) throw new Error(String(response.status));
  index = (await response.json()) as AskIndex;
  searcher = createSearcher(index);
  return { index, searcher };
}

/** document.createElement with an optional class and text. */
function createElement<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** A line of links to other pages, like "see also: Projects · Coursework". */
function linksLine(hits: AskHit[], lead: string) {
  const line = createElement('p', 'ask__see', lead);
  hits.forEach((hit, position) => {
    const link = createElement('a', 'link link--quiet', hit.doc.title);
    link.setAttribute('href', hit.doc.url);
    line.append(link);
    if (position < hits.length - 1) line.append(document.createTextNode(' · '));
  });
  return line;
}

/** "For more info, email me at …" with the address as a mailto link. */
function emailLine(email: string, lead: string) {
  const line = createElement('p', '', lead);
  const link = createElement('a', 'link link--underlined', email);
  link.setAttribute('href', `mailto:${email}`);
  line.append(link, document.createTextNode('.'));
  return line;
}

export function initAsk() {
  const askBox = document.querySelector<HTMLElement>('[data-ask]');
  if (!askBox) return;
  const panel = askBox.querySelector<HTMLElement>('[data-ask-panel]')!;
  const openButton = askBox.querySelector<HTMLButtonElement>('[data-ask-open]')!;
  const form = askBox.querySelector<HTMLFormElement>('[data-ask-form]')!;
  const input = askBox.querySelector<HTMLInputElement>('[data-ask-input]')!;
  const conversation = askBox.querySelector<HTMLElement>('[data-ask-log]')!;
  const scrollArea = askBox.querySelector<HTMLElement>('.ask__body')!;
  const backdrop = askBox.querySelector<HTMLElement>('[data-ask-backdrop]')!;
  let isOpen = false;

  // Everything behind the panel, made inert while it's open.
  const pageBehind = () =>
    [...document.querySelectorAll<HTMLElement>('main, .site-footer, [data-header], .rails, .skip-link')];

  const setOpen = async (open: boolean) => {
    if (open === isOpen) return;
    isOpen = open;
    openButton.setAttribute('aria-expanded', String(open));
    pageBehind().forEach((element) => (element.inert = open));
    html.classList.toggle('ask-open', open);

    if (open) {
      panel.hidden = false;
      backdrop.hidden = false;
      loadIndex().catch(() => {
        // Nothing to do yet; the first question reports the problem.
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
      openButton.focus({ preventScroll: true });
    }
  };

  const answer = async (question: string) => {
    const questionLine = createElement('li', 'ask__q');
    questionLine.append(createElement('span', 'ask__prompt', '>'), document.createTextNode(' ' + question));
    conversation.append(questionLine);
    const reply = createElement('li', 'ask__a');
    conversation.append(reply);

    try {
      const { index: loadedIndex, searcher: loadedSearcher } = await loadIndex();
      const result = loadedSearcher.search(question);

      if (result.kind === 'greeting') {
        reply.append(createElement('p', '', 'Hi! Ask me about my projects, courses, writing, or how to get in touch.'));
      } else if (result.kind === 'thanks') {
        reply.append(createElement('p', '', "You're welcome."));
      } else if (result.kind === 'answer') {
        const { top, related } = result;
        reply.append(createElement('p', '', top.doc.answer));
        const pageLink = createElement('a', 'ask__link link', `${top.doc.title} →`);
        pageLink.setAttribute('href', top.doc.url);
        reply.append(pageLink);
        if (related.length) reply.append(linksLine(related, 'see also: '));
      } else if (result.kind === 'unsure') {
        reply.append(createElement('p', '', "I couldn't find an exact answer to that on this site."));
        reply.append(linksLine(result.related, 'closest matches: '));
        reply.append(emailLine(loadedIndex.email, 'For anything else, email me at '));
      } else {
        reply.append(createElement('p', '', "Sorry, I couldn't find anything about that on this site."));
        reply.append(emailLine(loadedIndex.email, 'For more info, email me at '));
      }
    } catch {
      reply.textContent = "Couldn't load the site index. Try again in a moment.";
    }
    // Keep the newest question and answer in view.
    scrollArea.scrollTop = scrollArea.scrollHeight;
  };

  openButton.addEventListener('click', () => setOpen(!isOpen));
  askBox.querySelector('[data-ask-close]')?.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  askBox.querySelectorAll<HTMLButtonElement>('[data-ask-suggest]').forEach((suggestion) =>
    suggestion.addEventListener('click', () => answer(suggestion.textContent ?? '')),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    answer(question);
  });
  // Following a link to another page closes the box.
  panel.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a[href^="/"]')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setOpen(false);
    }
  });
  // On navigation, close it straight away, with no animation, before the page swaps.
  document.addEventListener('astro:before-preparation', () => {
    if (isOpen) {
      isOpen = false;
      pageBehind().forEach((element) => (element.inert = false));
      panel.hidden = true;
      backdrop.hidden = true;
      html.classList.remove('ask-open');
      openButton.setAttribute('aria-expanded', 'false');
    }
  });
}
