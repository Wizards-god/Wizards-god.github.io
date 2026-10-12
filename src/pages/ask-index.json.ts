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
import { awardDate, dateRange } from '../lib/format';
import type { AskDoc, AskIndex } from '../lib/ask-search';

const strip = (s: string) =>
  s
    .replace(/^import .*$/gm, ' ')
    // Maths markup ($...$, $$...$$) would add words like "frac" and "sqrt".
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
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
  const reading = books.filter((book) => book.data.reading);

  const termNote = (courses: (typeof terms)[number]['courses']) => {
    const statuses = new Set(courses.map((course) => course.data.status));
    if (statuses.size !== 1) return '';
    return { completed: ' (done)', 'in progress': ' (taking now)', intended: ' (planned)' }[[...statuses][0]];
  };

  const courseAnswer = (course: (typeof terms)[number]['courses'][number]) => {
    const { code, title, term, status } = course.data;
    if (status === 'intended') return `${code}, ${title}, is one I'm planning to take in ${term}.`;
    if (status === 'in progress') return `I'm taking ${code}, ${title}, this semester (${term}).`;
    return `I took ${code}, ${title}, in ${term}.`;
  };

  const docs: AskDoc[] = [
    {
      id: 'study',
      title: 'Education',
      url: '/about',
      answer: `I'm doing a Bachelor of Science in Computer Science at the ${uiuc.title} (${year(uiuc.start)}–${year(uiuc.end)}), with an intended Maths minor.`,
      keywords: ['study', 'major', 'minor', 'degree', 'university', 'college', 'school', 'uiuc', 'illinois', 'urbana', 'champaign', 'education', 'year', 'graduate', 'graduation', 'student', 'freshman', 'computer science', 'math', 'maths', 'siebel'],
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
      answer: bio.long.slice(0, 2).join(' '),
      keywords: ['who', 'about', 'yourself', 'bio', 'goal', 'quant', 'quantitative', 'research', 'trading', 'career', 'plan', 'future', 'aim'],
      text: bio.long.join(' '),
    },
    {
      id: 'free-time',
      title: 'Outside class',
      url: '/',
      answer: "At the moment I'm obsessed with the card game Wizard. I also read a lot; the bookshelf has what I'm reading now.",
      keywords: ['wizard', 'card game', 'cards', 'game', 'games', 'play', 'obsessed', 'hobby', 'fun', 'free time', 'spare time', 'weekend'],
      text: 'wizard card game reading books',
    },
    {
      id: 'currently',
      title: 'Currently',
      url: '/about',
      answer: currently.items
        .filter((item) => show(item.placeholder))
        .map((item) => `${item.label[0].toUpperCase()}${item.label.slice(1)}: ${item.text}.`)
        .join(' '),
      keywords: ['currently', 'now', 'lately', 'these days', 'recently', 'working on', 'building', 'learning'],
      text: currently.items.map((item) => `${item.label} ${item.text}`).join(' '),
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
            answer: skills.groups.map((group) => `${group.label}: ${list(group.items)}.`).join(' '),
            keywords: ['skill', 'programming', 'programming language', 'tools', 'tech', 'technologies', 'proficient', 'experienced'],
            text: skills.groups.flatMap((group) => [group.label, ...group.items]).join(' '),
          },
        ]
      : []),
    {
      id: 'coursework',
      title: 'Coursework',
      url: '/coursework',
      // Current semester first, then planned ones, then finished ones.
      answer: [...terms]
        .sort((first, second) => STATUS_ORDER[first.courses[0].data.status] - STATUS_ORDER[second.courses[0].data.status])
        .map((semester) => `${semester.term}${termNote(semester.courses)}: ${list(semester.courses.map((course) => course.data.code))}.`)
        .join(' '),
      keywords: ['course', 'coursework', 'class', 'semester', 'taking', 'schedule', 'enrolled', 'gen ed', 'curriculum', 'intended', 'upcoming'],
      text: terms.flatMap((semester) => semester.courses.map((course) => `${course.data.code} ${course.data.title} ${semester.term}`)).join(' '),
    },
    ...terms.flatMap((semester) =>
      semester.courses.map((course) => ({
        id: `course-${course.id}`,
        title: `${course.data.code} · ${course.data.title}`,
        url: '/coursework',
        answer: courseAnswer(course),
        keywords: [course.data.code, course.data.code.replace(/\s+/g, ''), semester.term, course.data.status, ...(course.data.category === 'gen-ed' ? ['gen ed', 'gened'] : [])],
        text: `${course.data.code} ${course.data.title} ${semester.term}`,
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
      answer: `Projects on the site: ${list(projects.map((project) => project.data.title))}. Each one has a write-up.`,
      keywords: ['project', 'portfolio', 'built', 'made', 'build', 'side project', 'code'],
      text: projects.map((project) => `${project.data.title} ${project.data.summary}`).join(' '),
    },
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.data.title,
      url: projectUrl(project),
      answer: project.data.summary,
      keywords: [...project.data.tags, ...project.data.stack, project.data.summary],
      text: `${project.data.summary} ${strip(project.body ?? '')}`,
    })),
    {
      id: 'writing',
      title: 'Writing',
      url: '/writing',
      answer: posts.length ? `The latest post is "${posts[0].data.title}". Everything is on the writing page.` : 'No posts yet.',
      keywords: ['blog', 'post', 'writing', 'article', 'essay', 'rss', 'write'],
      text: posts.map((post) => post.data.title).join(' '),
    },
    ...posts.map((post) => ({
      id: `post-${post.id}`,
      title: post.data.title,
      url: postUrl(post),
      answer: post.data.summary,
      keywords: [...post.data.tags, post.data.summary],
      text: `${post.data.summary} ${strip(post.body ?? '')}`,
    })),
    {
      id: 'books',
      title: 'Bookshelf',
      url: '/bookshelf',
      answer: [
        reading.length ? `Right now I'm reading ${list(reading.map((book) => book.data.title))}.` : '',
        `There are ${books.length} books on my bookshelf.`,
      ]
        .filter(Boolean)
        .join(' '),
      keywords: ['book', 'bookshelf', 'read', 'reading', 'recommend', 'recommendation', 'favourite', 'library'],
      text: books.map((book) => `${book.data.title} ${book.data.author}`).join(' '),
    },
    ...books.map((book) => ({
      id: `book-${book.id}`,
      title: book.data.title,
      url: '/bookshelf',
      answer: `"${book.data.title}" by ${book.data.author} is on my bookshelf.`,
      keywords: [book.data.author, ...book.data.tags],
      text: `${book.data.title} ${book.data.author}`,
    })),
    {
      id: 'experience',
      title: 'Experience',
      url: '/#experience',
      answer: jobs.length ? `${list(jobs.map((job) => `${job.data.role} at ${job.data.company}`))}.` : 'Nothing listed yet.',
      keywords: ['experience', 'work', 'job', 'internship', 'research', 'position', 'role'],
      text: jobs.map((job) => `${job.data.role} ${job.data.company}`).join(' '),
    },
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${job.data.role} @ ${job.data.company}`,
      url: '/#experience',
      answer: `${job.data.role} at ${job.data.company}, ${dateRange(job.data.start, job.data.end)}.`,
      keywords: [job.data.company, job.data.role],
      text: job.data.bullets.join(' '),
    })),
    {
      id: 'awards',
      title: 'Awards',
      url: '/about',
      answer: awards.length ? `${awards.map((award) => award.data.title).join('; ')}.` : 'Nothing listed yet.',
      keywords: ['award', 'competition', 'contest', 'prize', 'olympiad', 'achievement', 'honor', 'honour'],
      text: awards.map((award) => `${award.data.title} ${award.data.issuer}`).join(' '),
    },
    ...awards.map((award) => ({
      id: `award-${award.id}`,
      title: award.data.title,
      url: '/about',
      answer: `${award.data.title} (${award.data.issuer}), ${awardDate(award.data.date, award.data.precision)}.${award.data.note ? ' ' + award.data.note : ''}`,
      keywords: [award.data.issuer],
      text: `${award.data.title} ${award.data.issuer} ${award.data.note ?? ''}`,
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
    docs: docs.map((doc) => (item.test(doc.id) ? doc : { ...doc, boost: 1.15 })),
    synonyms,
    aboutId: 'about',
    email: site.email,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
