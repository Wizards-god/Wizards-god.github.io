// Search index for the "ask" box, generated at build time from site content.
// The matching itself lives in src/lib/ask-search.ts.
import { site } from '../data/site';
import { bio, currently, education, interests, languages, skills } from '../data/about';
import {
  getAwards,
  getBooks,
  getCoursesByTerm,
  getExperience,
  getPosts,
  getProjects,
  postUrl,
  projectUrl,
} from '../lib/content';
import { dateRange, monthYear } from '../lib/format';
import type { AskDoc, AskIndex } from '../lib/ask-search';

const strip = (s: string) =>
  s
    .replace(/^import .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>{}[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "a, b and c" */
const list = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const year = (d?: string | null) => d?.slice(0, 4) ?? '';

const STATUS_ORDER = { 'in progress': 0, intended: 1, completed: 2 } as const;

export async function GET() {
  const show = (p?: boolean) => site.showPlaceholders || !p;
  const [projects, posts, jobs, awards, books, terms] = await Promise.all([
    getProjects(),
    getPosts(),
    getExperience(),
    getAwards(),
    getBooks(),
    getCoursesByTerm(),
  ]);
  const [uiuc, school] = education;

  const termNote = (courses: (typeof terms)[number]['courses']) => {
    const statuses = new Set(courses.map((c) => c.data.status));
    if (statuses.size !== 1) return '';
    return { completed: ' (done)', 'in progress': ' (taking now)', intended: ' (planned)' }[[...statuses][0]];
  };

  const courseAnswer = (c: (typeof terms)[number]['courses'][number]) => {
    const { code, title, term, status } = c.data;
    if (status === 'intended') return `${code}, ${title}, is one I'm planning to take in ${term}.`;
    if (status === 'in progress') return `I'm taking ${code}, ${title}, this semester (${term}).`;
    return `I took ${code}, ${title}, in ${term}.`;
  };

  const docs: AskDoc[] = [
    {
      id: 'study',
      title: 'Education',
      url: '/about',
      answer: `I'm doing a Bachelor of Science in Computer Science at the ${uiuc.title} (${year(uiuc.start)}–${year(uiuc.end)}), with an intended Math minor.`,
      keywords: ['study', 'major', 'minor', 'degree', 'university', 'college', 'school', 'uiuc', 'illinois', 'urbana', 'champaign', 'education', 'year', 'graduate', 'graduation', 'student', 'freshman', 'computer science', 'math', 'siebel'],
      text: `${bio.long[0]} ${uiuc.subtitle} ${uiuc.note ?? ''}`,
    },
    {
      id: 'school',
      title: 'Before UIUC',
      url: '/about',
      answer: `Before UIUC I was at ${school.title} (${year(school.start)}–${year(school.end)}). ${school.note ?? ''}`,
      keywords: ['high school', 'school', 'pre-university', 'pu', 'puc', 'rv', 'jee', 'before', 'physics', 'chemistry', 'india', '12th'],
      text: `${school.title} ${school.subtitle} ${school.note ?? ''}`,
    },
    {
      id: 'contact',
      title: 'Contact',
      url: '/#contact',
      answer: `Email is best: ${site.email}. I'm also on LinkedIn (${site.socials.linkedin.handle}) and GitHub (${site.socials.github.handle}).`,
      keywords: ['contact', 'email', 'reach', 'message', 'hire', 'linkedin', 'github', 'orcid', 'social', 'talk', 'connect', 'phone', 'call', 'touch'],
      text: `email ${site.email} linkedin github orcid`,
    },
    {
      id: 'resume',
      title: 'Resume',
      url: '/resume',
      answer: 'The resume page is being rebuilt and will be back soon. Email is the best way to reach me in the meantime.',
      keywords: ['resume', 'cv', 'pdf', 'download'],
      text: 'resume curriculum vitae pdf download',
    },
    {
      id: 'status',
      title: 'Availability',
      url: '/',
      answer: `${site.status.text}.`,
      keywords: ['internship', 'intern', 'available', 'availability', 'looking', 'open', 'job', 'summer', 'opportunity', 'hiring', 'swe'],
      text: site.status.text,
    },
    {
      id: 'about',
      title: 'About',
      url: '/about',
      answer: bio.short.join(' '),
      keywords: ['who', 'about', 'yourself', 'bio', 'goal', 'quant', 'quantitative', 'research', 'trading', 'career', 'plan', 'future', 'aim'],
      text: bio.long.join(' '),
    },
    {
      id: 'currently',
      title: 'Currently',
      url: '/about',
      answer: currently.items
        .filter((c) => show(c.placeholder))
        .map((c) => `${c.label[0].toUpperCase()}${c.label.slice(1)}: ${c.text}.`)
        .join(' '),
      keywords: ['currently', 'now', 'lately', 'these days', 'recently', 'working on', 'building', 'learning'],
      text: currently.items.map((c) => `${c.label} ${c.text}`).join(' '),
    },
    {
      id: 'site',
      title: 'This site',
      url: '/projects/parjanya-me',
      answer: 'This site is static (Astro and TypeScript) and hosted on Vercel. This box is a simple search over the site, not an AI, and nothing you type leaves your browser.',
      keywords: ['site', 'website', 'built', 'stack', 'astro', 'ai', 'bot', 'chatbot', 'ask', 'vercel', 'hosted', 'offline'],
      text: 'astro typescript tailwind static site vercel intro shutter theme ask box search',
    },
    {
      id: 'languages',
      title: 'Languages',
      url: '/about',
      answer: `I speak ${list(languages.items)}.`,
      keywords: ['language', 'speak', 'spoken', 'fluent', 'mother tongue', ...languages.items],
      text: languages.items.join(' '),
    },
    ...(show(interests.placeholder)
      ? [
          {
            id: 'interests',
            title: 'Interests',
            url: '/about',
            answer: `Things I'm into: ${list(interests.items)}.`,
            keywords: ['interest', 'interested', 'hobby', 'fun', 'free time', 'enjoy', 'passion'],
            text: interests.items.join(' '),
          },
        ]
      : []),
    ...(show(skills.placeholder)
      ? [
          {
            id: 'skills',
            title: 'Skills',
            url: '/about',
            answer: skills.groups.map((g) => `${g.label}: ${list(g.items)}.`).join(' '),
            keywords: ['skill', 'programming', 'programming language', 'tools', 'tech', 'technologies', 'proficient', 'experienced'],
            text: skills.groups.flatMap((g) => [g.label, ...g.items]).join(' '),
          },
        ]
      : []),
    {
      id: 'coursework',
      title: 'Coursework',
      url: '/coursework',
      // Current semester first, then planned ones, then finished ones.
      answer: [...terms]
        .sort((a, b) => STATUS_ORDER[a.courses[0].data.status] - STATUS_ORDER[b.courses[0].data.status])
        .map((t) => `${t.term}${termNote(t.courses)}: ${list(t.courses.map((c) => c.data.code))}.`)
        .join(' '),
      keywords: ['course', 'coursework', 'class', 'semester', 'taking', 'schedule', 'enrolled', 'gen ed', 'curriculum', 'intended', 'upcoming'],
      text: terms.flatMap((t) => t.courses.map((c) => `${c.data.code} ${c.data.title} ${t.term}`)).join(' '),
    },
    ...terms.flatMap((t) =>
      t.courses.map((c) => ({
        id: `course-${c.id}`,
        title: `${c.data.code} · ${c.data.title}`,
        url: '/coursework',
        answer: courseAnswer(c),
        keywords: [c.data.code, c.data.code.replace(/\s+/g, ''), t.term, c.data.status, ...(c.data.category === 'gen-ed' ? ['gen ed', 'gened'] : [])],
        text: `${c.data.code} ${c.data.title} ${t.term}`,
      })),
    ),
    {
      id: 'notes',
      title: 'Course notes',
      url: '/coursework',
      answer: "Where I have notes for a course, they're on the coursework page as PDFs. Some I converted to LaTeX with the help of AI, and a few are still incomplete.",
      keywords: ['notes', 'lecture notes', 'pdf', 'latex', 'cheat sheet'],
      text: 'notes pdf latex coursework',
    },
    {
      id: 'projects',
      title: 'Projects',
      url: '/projects',
      answer: `Projects on the site: ${list(projects.map((p) => p.data.title))}. Each one has a write-up.`,
      keywords: ['project', 'portfolio', 'built', 'made', 'build', 'side project', 'code'],
      text: projects.map((p) => `${p.data.title} ${p.data.summary}`).join(' '),
    },
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      title: p.data.title,
      url: projectUrl(p),
      answer: p.data.summary,
      keywords: [...p.data.tags, ...p.data.stack, p.data.summary],
      text: `${p.data.summary} ${strip(p.body ?? '')}`,
    })),
    {
      id: 'writing',
      title: 'Writing',
      url: '/writing',
      answer: posts.length ? `The latest post is "${posts[0].data.title}". Everything is on the writing page.` : 'No posts yet.',
      keywords: ['blog', 'post', 'writing', 'article', 'essay', 'rss', 'write'],
      text: posts.map((p) => p.data.title).join(' '),
    },
    ...posts.map((p) => ({
      id: `post-${p.id}`,
      title: p.data.title,
      url: postUrl(p),
      answer: p.data.summary,
      keywords: [...p.data.tags, p.data.summary],
      text: `${p.data.summary} ${strip(p.body ?? '')}`,
    })),
    {
      id: 'books',
      title: 'Bookshelf',
      url: '/bookshelf',
      answer: `There are ${books.length} books on my bookshelf, favourites first.`,
      keywords: ['book', 'bookshelf', 'read', 'reading', 'recommend', 'recommendation', 'favourite', 'library'],
      text: books.map((b) => `${b.data.title} ${b.data.author}`).join(' '),
    },
    ...books.map((b) => ({
      id: `book-${b.id}`,
      title: b.data.title,
      url: '/bookshelf',
      answer: `"${b.data.title}" by ${b.data.author} is on my bookshelf.`,
      keywords: [b.data.author, ...b.data.tags],
      text: `${b.data.title} ${b.data.author}`,
    })),
    {
      id: 'experience',
      title: 'Experience',
      url: '/#experience',
      answer: jobs.length ? `${list(jobs.map((j) => `${j.data.role} at ${j.data.company}`))}.` : 'Nothing listed yet.',
      keywords: ['experience', 'work', 'job', 'internship', 'research', 'position', 'role'],
      text: jobs.map((j) => `${j.data.role} ${j.data.company}`).join(' '),
    },
    ...jobs.map((j) => ({
      id: `job-${j.id}`,
      title: `${j.data.role} @ ${j.data.company}`,
      url: '/#experience',
      answer: `${j.data.role} at ${j.data.company}, ${dateRange(j.data.start, j.data.end)}.`,
      keywords: [j.data.company, j.data.role],
      text: j.data.bullets.join(' '),
    })),
    {
      id: 'awards',
      title: 'Awards',
      url: '/about',
      answer: awards.length ? `${list(awards.map((a) => `${a.data.title} (${a.data.issuer})`))}.` : 'Nothing listed yet.',
      keywords: ['award', 'competition', 'contest', 'prize', 'olympiad', 'achievement', 'honor', 'honour'],
      text: awards.map((a) => `${a.data.title} ${a.data.issuer}`).join(' '),
    },
    ...awards.map((a) => ({
      id: `award-${a.id}`,
      title: a.data.title,
      url: '/about',
      answer: `${a.data.title} (${a.data.issuer}), ${monthYear(a.data.date)}.${a.data.note ? ' ' + a.data.note : ''}`,
      keywords: [a.data.issuer],
      text: `${a.data.title} ${a.data.issuer} ${a.data.note ?? ''}`,
    })),
  ];

  // Query word → index words it can also mean.
  const synonyms: Record<string, string[]> = {
    cv: ['resume'],
    mail: ['email'],
    gmail: ['email'],
    reach: ['contact'],
    uni: ['university'],
    varsity: ['university'],
    major: ['degree'],
    subject: ['course'],
    class: ['course'],
    lecture: ['course'],
    blog: ['writing'],
    article: ['writing'],
    job: ['experience', 'internship'],
    work: ['experience', 'project'],
    internship: ['experience', 'availability'],
    hire: ['availability', 'contact'],
    repo: ['github', 'project'],
    source: ['github', 'site'],
    quant: ['quantitative', 'trading'],
    finance: ['quant', 'trading', 'markets'],
    market: ['quant', 'trading'],
    hobby: ['interest'],
    passion: ['interest'],
    chatbot: ['ai'],
    gpt: ['ai'],
    llm: ['ai'],
    favorite: ['favourite'],
    fav: ['favourite'],
    cpp: ['c++'],
    js: ['typescript'],
    ts: ['typescript'],
    up: ['currently'],
    lately: ['currently'],
    speak: ['language'],
    dsa: ['algorithms', 'data structures'],
    stats: ['statistics'],
    prob: ['probability'],
    calc: ['calculus'],
    hs: ['high school'],
    '12th': ['high school'],
    upcoming: ['intended'],
    next: ['intended'],
    planned: ['intended'],
    plan: ['intended'],
  };

  // Section-level docs win ties against single courses, books or posts.
  const item = /^(course|project|post|book|job|award)-/;
  const body: AskIndex = {
    docs: docs.map((d) => (item.test(d.id) ? d : { ...d, boost: 1.15 })),
    synonyms,
    aboutId: 'about',
    email: site.email,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
