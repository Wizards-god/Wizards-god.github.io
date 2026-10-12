// Every page reads its content through these, so they're the one place that
// decides the order things appear in and whether placeholders are shown.

import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../data/site';

/** Placeholder entries only show while site.showPlaceholders is on. */
const visible = <T extends { data: { placeholder?: boolean } }>(entry: T) => site.showPlaceholders || !entry.data.placeholder;

/** By their `order` field, then newest first. */
export async function getProjects() {
  const all = await getCollection('projects', visible);
  return all.sort((a, b) => a.data.order - b.data.order || b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getFeaturedProjects(limit = 3) {
  return (await getProjects()).filter((project) => project.data.featured).slice(0, limit);
}

/** By their `order` field, then the most recent start date first. */
export async function getExperience() {
  const all = await getCollection('experience', visible);
  return all.sort((a, b) => a.data.order - b.data.order || b.data.start.valueOf() - a.data.start.valueOf());
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };

/** A number that sorts terms like "Fall 2026" in calendar order. */
const termSortKey = (term: string) => {
  const [season, year] = term.split(' ');
  return Number(year) * 10 + (SEASON_ORDER[season] ?? 0);
};

/** Courses grouped by term, newest term first. */
export async function getCoursesByTerm() {
  const all = await getCollection('courses', visible);
  const coursesByTerm = new Map<string, CollectionEntry<'courses'>[]>();
  for (const course of all) {
    const termCourses = coursesByTerm.get(course.data.term) ?? [];
    termCourses.push(course);
    coursesByTerm.set(course.data.term, termCourses);
  }
  return [...coursesByTerm.entries()]
    .sort(([a], [b]) => termSortKey(b) - termSortKey(a))
    .map(([term, courses]) => ({
      term,
      // STEM before gen eds, then by course code.
      courses: courses.sort(
        (a, b) => Number(a.data.category !== 'stem') - Number(b.data.category !== 'stem') || a.data.code.localeCompare(b.data.code),
      ),
    }));
}

/** Newest first; two from the same date go alphabetically. */
export async function getAwards() {
  const all = await getCollection('awards', visible);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.data.title.localeCompare(b.data.title));
}

/** What I'm reading now, then favourites, then by the year I read them, newest first. */
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

/** Newest first. Drafts only show up in the dev server. */
export async function getPosts() {
  const all = await getCollection('writing', (post) => import.meta.env.DEV || !post.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const projectUrl = (project: CollectionEntry<'projects'>) => `/projects/${project.id}`;
export const postUrl = (post: CollectionEntry<'writing'>) => `/writing/${post.id}`;
