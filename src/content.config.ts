import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// Any entry can set `placeholder: true`. Placeholders render with a visible
// tag while `site.showPlaceholders` is true and the build lists them.
const placeholder = z.boolean().default(false);

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        summary: z.string(),
        date: z.coerce.date(),
        status: z.enum(['shipped', 'in-progress']),
        featured: z.boolean().default(false),
        order: z.number().default(100),
        tags: z.array(z.string()).default([]),
        stack: z.array(z.string()).default([]),
        links: z
          .object({
            github: z.url().optional(),
            live: z.url().optional(),
            paper: z.url().optional(),
          })
          .default({}),
        cover: image().optional(),
        coverAlt: z.string().default(''),
        thumb: image().optional(),
        metrics: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
        placeholder,
      })
      .refine((project) => !project.featured || project.cover !== undefined, {
        error: 'A featured project needs a `cover` image.',
        path: ['cover'],
      }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    company: z.string(),
    role: z.string(),
    url: z.url().optional(),
    location: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().nullable().default(null),
    bullets: z.array(z.string()).default([]),
    order: z.number().default(100),
    placeholder,
  }),
});

const courses = defineCollection({
  loader: file('src/content/courses/courses.yaml'),
  schema: z.object({
    code: z.string(),
    title: z.string(),
    // A semester, or "Advanced standing" for credit I came in with (see ADVANCED_STANDING in src/lib/content.ts).
    term: z.union([
      z.literal('Advanced standing'),
      z.string().regex(/^(Spring|Summer|Fall|Winter) \d{4}$/, 'term must look like "Fall 2026" or be "Advanced standing"'),
    ]),
    status: z.enum(['completed', 'in progress', 'intended']),
    // STEM courses show by default; gen eds sit behind a toggle on /coursework.
    category: z.enum(['stem', 'gen-ed']).default('stem'),
    notesPdf: z.string().optional(),
    placeholder,
  }),
});

const awards = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/awards' }),
  schema: z.object({
    title: z.string(),
    issuer: z.string(),
    date: z.coerce.date(),
    /** 'year' shows just the year, for results without a meaningful month. */
    precision: z.enum(['month', 'year']).default('month'),
    note: z.string().optional(),
    placeholder,
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z
    .object({
      title: z.string(),
      author: z.string(),
      /**
       * read: finished, with the year I read it.
       * reading: shown as "reading now" and listed first.
       * planned: on my list, shown last.
       */
      status: z.enum(['read', 'reading', 'planned']),
      /** The year I finished it. Only for books I've read. */
      year: z.number().int().optional(),
      tags: z.array(z.string()).default([]),
      reflection: z.string(),
      url: z.url().optional(),
      favorite: z.boolean().default(false),
      placeholder,
    })
    .refine((book) => book.status !== 'read' || book.year !== undefined, {
      error: 'A book I have read needs the `year` I read it.',
      path: ['year'],
    }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, experience, courses, awards, books, writing };
