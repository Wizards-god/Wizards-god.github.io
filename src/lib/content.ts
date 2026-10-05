import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../data/site';

const visible = <T extends { data: { placeholder?: boolean } }>(e: T) => site.showPlaceholders || !e.data.placeholder;

export async function getProjects() {
  const all = await getCollection('projects', visible);
  return all.sort((a, b) => a.data.order - b.data.order || b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getFeaturedProjects(limit = 3) {
  return (await getProjects()).filter((p) => p.data.featured).slice(0, limit);
}

export async function getExperience() {
  const all = await getCollection('experience', visible);
  return all.sort((a, b) => a.data.order - b.data.order || b.data.start.valueOf() - a.data.start.valueOf());
}

const TERM_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
const termKey = (term: string) => {
  const [season, year] = term.split(' ');
  return Number(year) * 10 + (TERM_ORDER[season] ?? 0);
};

/** Courses grouped by term, newest term first. */
export async function getCoursesByTerm() {
  const all = await getCollection('courses', visible);
  const groups = new Map<string, CollectionEntry<'courses'>[]>();
  for (const c of all) {
    const list = groups.get(c.data.term) ?? [];
    list.push(c);
    groups.set(c.data.term, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => termKey(b) - termKey(a))
    .map(([term, courses]) => ({
      term,
      // STEM before gen eds, then by course code.
      courses: courses.sort(
        (a, b) => Number(a.data.category !== 'stem') - Number(b.data.category !== 'stem') || a.data.code.localeCompare(b.data.code),
      ),
    }));
}

export async function getAwards() {
  const all = await getCollection('awards', visible);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.data.title.localeCompare(b.data.title));
}

export async function getBooks() {
  const all = await getCollection('books', visible);
  return all.sort(
    (a, b) =>
      Number(b.data.reading) - Number(a.data.reading) ||
      Number(b.data.favorite) - Number(a.data.favorite) ||
      b.data.year - a.data.year ||
      a.data.title.localeCompare(b.data.title),
  );
}

export async function getPosts() {
  const all = await getCollection('writing', (p) => import.meta.env.DEV || !p.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const projectUrl = (p: CollectionEntry<'projects'>) => `/projects/${p.id}`;
export const postUrl = (p: CollectionEntry<'writing'>) => `/writing/${p.id}`;
