// Content for /about, the home "about" teaser and the resume. Items marked
// `placeholder: true` are unverified stand-ins: replace them with real details.

export interface TimelineItem {
  title: string;
  subtitle: string;
  start: string;
  end: string | null;
  note?: string;
  placeholder?: boolean;
}

export interface CurrentlyItem {
  label: 'learning' | 'building' | 'reading';
  text: string;
  href?: string;
  placeholder?: boolean;
}

export const bio = {
  short: [
    "I'm a first-year Computer Science student at the University of Illinois Urbana-Champaign (Class of 2030), with an intended minor in Math.",
    "I'm working toward quantitative research and trading, so most of what I build and read sits where probability, algorithms and fast, careful code meet.",
  ],
  long: [
    "I'm Parjanya. I'm studying for a Bachelor of Science in Computer Science in the Siebel School of Computing and Data Science at the University of Illinois Urbana-Champaign, with an intended Math minor. I started in August 2026 and expect to graduate in May 2030.",
    "The goal is quantitative research. That means getting genuinely good at probability and statistics, at algorithms and systems, and at the unglamorous habit of checking my own work. This site is where I keep the evidence: projects with honest write-ups, notes from courses, and the occasional longer post.",
    "This site isn't built from a template, which made it a good excuse to learn how all the pieces fit together. If you're curious how the intro works, there's a short write-up about it.",
  ],
};

export const education: TimelineItem[] = [
  {
    title: 'University of Illinois Urbana-Champaign',
    subtitle: 'Bachelor of Science in Computer Science · intended Math minor',
    start: '2026-08',
    end: '2030-05',
    note: 'Siebel School of Computing and Data Science.',
  },
  {
    title: 'RV PU College',
    subtitle: 'Pre-university: Physics, Chemistry, Mathematics and Computer Science',
    start: '2024-06',
    end: '2026-05',
    note: 'Maths, physics and chemistry at JEE Advanced level, alongside computer science.',
  },
];

// Dated: the build warns when this is more than 90 days old.
export const currently = {
  updated: '2026-09-29',
  items: [
    { label: 'building', text: 'this site, parjanya.me', href: '/projects/parjanya-me' },
    { label: 'learning', text: 'something new; more on this soon', placeholder: true },
    { label: 'reading', text: "a book I'll add here soon", href: '/bookshelf', placeholder: true },
  ] as CurrentlyItem[],
};

export const interests = {
  items: ['Probability & statistics', 'Algorithms', 'Markets & market microstructure', 'Systems programming'],
  placeholder: true,
};

export const languages = {
  items: ['English', 'Telugu', 'Kannada', 'Hindi', 'Sanskrit'],
  placeholder: false,
};

export const skills = {
  groups: [
    { label: 'Languages', items: ['Python', 'C++', 'TypeScript', 'HTML/CSS'] },
    { label: 'Tools', items: ['Git', 'Linux', 'Astro'] },
    { label: 'Math', items: ['Probability', 'Linear algebra', 'Calculus'] },
  ],
  placeholder: true,
};
