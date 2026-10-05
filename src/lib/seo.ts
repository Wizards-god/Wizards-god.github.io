import { site } from '../data/site';

export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: site.name,
  url: site.domain,
  email: `mailto:${site.email}`,
  sameAs: [site.socials.linkedin.url, site.socials.github.url, site.socials.orcid.url],
  affiliation: {
    '@type': 'CollegeOrUniversity',
    name: 'University of Illinois Urbana-Champaign',
    url: 'https://illinois.edu',
  },
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
    url: new URL(post.url, site.domain).href,
    mainEntityOfPage: new URL(post.url, site.domain).href,
    image: new URL(post.image, site.domain).href,
    inLanguage: 'en-GB',
    author: { '@type': 'Person', name: site.name, url: site.domain },
  };
}

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  url: site.domain,
};
