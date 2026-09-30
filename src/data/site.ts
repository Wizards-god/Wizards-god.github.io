// Site-wide configuration. Content that changes often (status, "currently")
// is dated; the build warns when it is more than 90 days old.

export type HomeSection = 'hero' | 'about' | 'experience' | 'featured' | 'contact';

export const site = {
  name: 'Parjanya Shankar',
  wordmark: 'parjanya.',
  domain: 'https://parjanya.me',
  tagline: 'CS @ UIUC · building toward quant research',
  description:
    'Parjanya Shankar: Computer Science student at the University of Illinois Urbana-Champaign (Class of 2030, intended Math minor), working toward quantitative research.',

  status: {
    text: 'Open to research & SWE internships · Summer 2027',
    updated: '2026-09-29',
  },

  // Public contact address. Never add a phone number or home address.
  email: 'ps137@illinois.edu',

  socials: {
    github: { label: 'GitHub', handle: 'Wizards-god', url: 'https://github.com/Wizards-god' },
    linkedin: { label: 'LinkedIn', handle: 'in/parjanya-s', url: 'https://www.linkedin.com/in/parjanya-s/' },
    orcid: { label: 'ORCID', handle: '0009-0004-8664-5164', url: 'https://orcid.org/0009-0004-8664-5164' },
  },

  resume: '/resume.pdf',
  source: 'https://github.com/Wizards-god/Wizards-god.github.io',

  nav: [
    { label: 'About', href: '/about', key: 'about' },
    { label: 'Projects', href: '/projects', key: 'projects' },
    { label: 'Writing', href: '/writing', key: 'writing' },
    { label: 'Coursework', href: '/coursework', key: 'coursework' },
  ],

  homeSections: ['hero', 'about', 'experience', 'featured', 'contact'] as HomeSection[],

  intro: { enabled: true, minMs: 700, maxWaitMs: 3500, oncePerSession: true },

  // Cursor glow under prefers-reduced-motion: 'static' snaps to the pointer, 'off' hides it.
  glow: { reducedMotion: 'static' as 'static' | 'off' },

  // Entries marked `placeholder: true` in src/content are shown with a small
  // "placeholder" tag while this is true, and hidden entirely when false.
  // The build lists every remaining placeholder.
  showPlaceholders: true,

  // Privacy-friendly analytics. Set to your GoatCounter code (the "xyz" in
  // xyz.goatcounter.com) to enable; empty means no analytics script at all.
  analytics: { goatcounter: '' },

  ask: { enabled: true },
} as const;

export type Site = typeof site;
