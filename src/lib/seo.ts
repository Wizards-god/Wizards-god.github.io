// Structured data (JSON-LD) for search engines and AI assistants: who I am,
// what the site is, and the details of each post and project. None of it is
// visible on the page.
//
// I'm described in full once, with a fixed @id. Everything else (the site,
// posts, projects) points back to that id as the author, so they all agree
// on who wrote them.
//
// Only verified details go in here. Anything still missing is a TODO comment,
// never placeholder text in the output, so nothing can quote a TODO as fact.

import type { CollectionEntry } from 'astro:content';
import { site } from '../data/site';
import { education } from '../data/about';

const PERSON_ID = `${site.domain}/#person`;
const WEBSITE_ID = `${site.domain}/#website`;

/** A short pointer to me, for the author of the site, a post or a project. */
const me = { '@type': 'Person', '@id': PERSON_ID, name: site.name, url: site.domain };

/** A full URL on this site, from a path like /writing/fair-coin. */
const fullUrl = (path: string) => new URL(path, site.domain).href;

/** Me in full, without @context, so it can sit on its own or inside a ProfilePage. */
function person(awards: CollectionEntry<'awards'>[]) {
  const [university, school] = education;
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.name,
    url: site.domain,
    email: `mailto:${site.email}`,
    // How the home page describes me.
    jobTitle: 'Computer Science student',
    description: site.description,
    // TODO: add `image` (the URL of a real photo) once the placeholder portrait is replaced.
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Urbana-Champaign',
      addressRegion: 'Illinois',
      addressCountry: 'US',
    },
    // The topics the bio on /about says I'm working on.
    knowsAbout: ['Probability', 'Statistics', 'Algorithms', 'Systems', 'Quantitative research'],
    affiliation: {
      '@type': 'CollegeOrUniversity',
      name: university.title,
      url: 'https://illinois.edu',
    },
    alumniOf: { '@type': 'EducationalOrganization', name: school.title },
    // Placeholder awards are unverified, so they're left out even while the site shows them.
    award: awards.filter((award) => !award.data.placeholder).map((award) => award.data.title),
    sameAs: [site.socials.linkedin.url, site.socials.github.url, site.socials.orcid.url],
  };
}

/** Me, for the home page. Pass in the awards collection (getAwards()), so this matches /about. */
export function personJsonLd(awards: CollectionEntry<'awards'>[]) {
  return { '@context': 'https://schema.org', ...person(awards) };
}

/** /about is a profile page about me: the type Google and AI assistants look for on "about" pages. */
export function profilePageJsonLd(awards: CollectionEntry<'awards'>[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: fullUrl('/about/'),
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: person(awards),
  };
}

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: site.name,
  url: site.domain,
  description: site.description,
  inLanguage: 'en-GB',
  author: me,
};

/** Structured data for a blog post, so search engines know its title, dates and author. */
export function articleJsonLd(post: { title: string; summary: string; date: Date; updated?: Date; url: string; image: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary,
    datePublished: post.date.toISOString(),
    dateModified: (post.updated ?? post.date).toISOString(),
    url: fullUrl(post.url),
    mainEntityOfPage: fullUrl(post.url),
    image: fullUrl(post.image),
    inLanguage: 'en-GB',
    author: me,
    isPartOf: { '@id': WEBSITE_ID },
  };
}

/**
 * Structured data for a project's case study. A project with its code on
 * GitHub is SoftwareSourceCode; one without is a plain CreativeWork.
 * Placeholder projects get none, since they haven't been built yet.
 */
export function projectJsonLd(project: CollectionEntry<'projects'>, url: string, image: string) {
  const details = project.data;
  if (details.placeholder) return [];
  return [
    {
      '@context': 'https://schema.org',
      '@type': details.links.github ? 'SoftwareSourceCode' : 'CreativeWork',
      name: details.title,
      description: details.summary,
      url: fullUrl(url),
      image: fullUrl(image),
      dateCreated: details.date.toISOString(),
      ...(details.links.github && { codeRepository: details.links.github }),
      keywords: [...details.stack, ...details.tags],
      inLanguage: 'en-GB',
      author: me,
      isPartOf: { '@id': WEBSITE_ID },
    },
  ];
}
