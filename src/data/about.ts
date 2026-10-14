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
  // Home page "About me". The major and the quant goal live on /about instead.
  short: [
    "There's a lot happening in tech right now, from AI and space to VR and clean energy, and more ideas around than anyone could build. The hard part is turning one into something real, and that's what I'm trying to get better at.",
    "I'm a student, so mostly I'm here to learn: about myself, about other people and about how the world works, and hopefully find ways to make it a bit better as I go.",
  ],
  long: [
    "I'm Parjanya. I'm studying for a Bachelor of Science in Computer Science in the Siebel School of Computing and Data Science at the University of Illinois Urbana-Champaign, with an intended Maths minor. I started in August 2026 and should graduate in May 2030.",
    "I want to end up in quantitative research. For now that means getting properly good at probability and statistics, algorithms and systems, and getting into the habit of double-checking my work. I build software to explore algorithms, simulation, probability and quantitative systems, and this site is where I put it: projects with write-ups of what worked and what didn't, notes from my courses, and the odd longer post.",
    "There's a lot happening in tech right now, from AI and space exploration to VR and clean energy, and far more ideas around than anyone could build. The hard part is turning one into something real. As a student, my main goal is to learn about myself, about other people and about how the world works, so that I can find ways to make it a bit better.",
    "I designed this site, which was a good excuse to learn how all the pieces fit together. If you're curious how the intro works, there's a short write-up about it.",
  ],
  // Phrases in the long bio that /about turns into links. The text has to match the paragraph exactly.
  longLinks: [{ text: 'short write-up', href: '/writing/zooming-through-a-letter' }],
};

export const education: TimelineItem[] = [
  {
    title: 'University of Illinois Urbana-Champaign',
    subtitle: 'Bachelor of Science in Computer Science · intended Maths minor',
    start: '2026-08',
    end: '2030-05',
    note: 'Siebel School of Computing and Data Science.',
  },
  {
    title: 'RV PU College',
    subtitle: 'Pre-university: Physics, Chemistry, Mathematics and Computer Science',
    start: '2024-06',
    end: '2026-03',
    note: 'Maths, physics and chemistry at JEE Advanced level, alongside computer science. In my Class 12 board exams I got 100/100 in maths and 98/100 in physics.',
  },
];

// Dated: the build warns when this is more than 90 days old.
export const currently = {
  updated: '2026-10-14',
  items: [
    { label: 'building', text: 'this site, parjanya.me', href: '/projects/parjanya-me' },
    { label: 'learning', text: 'preparing for the Putnam (Dec 2026)' },
    { label: 'reading', text: "The Three-Body Problem and Surely You're Joking, Mr. Feynman!", href: '/bookshelf' },
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
    { label: 'Maths', items: ['Probability', 'Linear algebra', 'Calculus'] },
  ],
  placeholder: true,
};
