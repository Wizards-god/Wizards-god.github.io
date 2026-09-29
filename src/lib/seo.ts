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

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  url: site.domain,
};
