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
    "I'm a first-year Computer Science student at the University of Illinois Urbana-Champaign, minoring in Mathematics (Class of 2030).",
    "I'm working toward quantitative research and trading, so most of what I build and read sits where probability, algorithms and fast, careful code meet.",
  ],
  long: [
    "I'm Parjanya, a Computer Science student in the Siebel School of Computing and Data Science at the University of Illinois Urbana-Champaign, with a minor in Mathematics. I started in August 2026 and expect to graduate in May 2030.",
    "The goal is quantitative research. That means getting genuinely good at probability and statistics, at algorithms and systems, and at the unglamorous habit of checking my own work. This site is where I keep the evidence: projects with honest write-ups, notes from courses, and the occasional longer post.",
    "The site itself is custom rather than a template: the intro, the page transitions and the theme switch are all bespoke, and there is a write-up of how the intro works if you are curious.",
  ],
};

export const education: TimelineItem[] = [
  {
    title: 'University of Illinois Urbana-Champaign',
    subtitle: 'B.S. Computer Science · Minor in Mathematics',
    start: '2026-08',
    end: '2030-05',
    note: 'Siebel School of Computing and Data Science.',
  },
  {
    title: 'High school',
    subtitle: 'Add your school, board and graduation year',
    start: '2022-06',
    end: '2026-05',
    note: 'Placeholder entry: replace with your school.',
    placeholder: true,
  },
];

// Dated: the build warns when this is more than 90 days old.
export const currently = {
  updated: '2026-09-29',
  items: [
    { label: 'building', text: 'this site, parjanya.me', href: '/projects/parjanya-me' },
    { label: 'learning', text: 'Add what you are studying right now', placeholder: true },
    { label: 'reading', text: 'Add the book on your desk', href: '/bookshelf', placeholder: true },
  ] as CurrentlyItem[],
};

export const interests = {
  items: ['Probability & statistics', 'Algorithms', 'Markets & market microstructure', 'Systems programming'],
  placeholder: true,
};

export const languages = {
  items: ['English', 'Telugu', 'Kannada', 'Hindi'],
  placeholder: true,
};

export const skills = {
  groups: [
    { label: 'Languages', items: ['Python', 'C++', 'TypeScript', 'HTML/CSS'] },
    { label: 'Tools', items: ['Git', 'Linux', 'Astro'] },
    { label: 'Math', items: ['Probability', 'Linear algebra', 'Calculus'] },
  ],
  placeholder: true,
};
