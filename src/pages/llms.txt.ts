// /llms.txt: a plain Markdown summary of who I am and where things are on the
// site, for AI assistants (see llmstxt.org). It's built from the same content
// as the pages, so it never drifts from them. Placeholder entries are left out,
// since they're unverified.

import { site } from '../data/site';
import { bio, education } from '../data/about';
import { getAwards, getCoursesByTerm, getPosts, getProjects, postUrl, projectUrl } from '../lib/content';
import { awardDate, yearRange } from '../lib/format';

/** A full URL on this site, from a path like /about. */
const fullUrl = (path: string) => new URL(path, site.domain).href;

/** One Markdown bullet with a link, like "- [About](https://…/about/): what's there". Page URLs end in a slash, like the canonical ones. */
const linkLine = (title: string, path: string, description: string) =>
  `- [${title}](${fullUrl(path.endsWith('/') ? path : `${path}/`)}): ${description}`;

/** "Fall 2026 (in progress): CS 124 …; MATH 241H …", or each course's own status if a term mixes them. */
function termLine(term: string, courses: { data: { code: string; title: string; status: string } }[]) {
  const statuses = new Set(courses.map((course) => course.data.status));
  if (statuses.size === 1) {
    return `- ${term} (${[...statuses][0]}): ${courses.map((course) => `${course.data.code} ${course.data.title}`).join('; ')}`;
  }
  return `- ${term}: ${courses.map((course) => `${course.data.code} ${course.data.title}, ${course.data.status}`).join('; ')}`;
}

export async function GET() {
  const awards = (await getAwards()).filter((award) => !award.data.placeholder);
  const projects = (await getProjects()).filter((project) => !project.data.placeholder);
  const posts = await getPosts();
  const terms = (await getCoursesByTerm())
    .map((term) => ({ ...term, courses: term.courses.filter((course) => !course.data.placeholder && course.data.category === 'stem') }))
    .filter((term) => term.courses.length > 0);

  const sections = [
    `# ${site.name}`,
    `> ${site.description}`,
    // The first two paragraphs of the bio on /about: who I am and what I'm working towards.
    bio.long.slice(0, 2).join('\n\n'),

    '## Education',
    education
      .filter((entry) => !entry.placeholder)
      .map((entry) => `- ${entry.title} (${yearRange(entry.start, entry.end)}): ${entry.subtitle}.${entry.note ? ` ${entry.note}` : ''}`)
      .join('\n'),

    '## Awards and competitions',
    awards
      .map((award) => `- ${award.data.title} (${awardDate(award.data.date, award.data.precision)}), ${award.data.issuer}.${award.data.note ? ` ${award.data.note}` : ''}`)
      .join('\n'),

    '## Pages',
    [
      linkLine('About', '/about/', 'my background, education, what I am working on now, and awards.'),
      linkLine('Projects', '/projects/', 'things I have built, each with a case study.'),
      linkLine('Writing', '/writing/', 'longer posts on things I have built and problems I have worked through.'),
      linkLine('Coursework', '/coursework/', 'my courses at the University of Illinois Urbana-Champaign.'),
      linkLine('Bookshelf', '/bookshelf/', 'what I am reading now and plan to read next.'),
    ].join('\n'),

    '## Projects',
    projects.map((project) => linkLine(project.data.title, projectUrl(project), project.data.summary)).join('\n'),

    '## Writing',
    posts.map((post) => linkLine(post.data.title, postUrl(post), post.data.summary)).join('\n'),

    '## Coursework (STEM)',
    terms.map((term) => termLine(term.term, term.courses)).join('\n'),

    '## Contact',
    [
      `- Email: ${site.email}`,
      `- GitHub: ${site.socials.github.url}`,
      `- LinkedIn: ${site.socials.linkedin.url}`,
      `- ORCID: ${site.socials.orcid.url}`,
    ].join('\n'),
  ];

  return new Response(`${sections.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
