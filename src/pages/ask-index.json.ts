// Search index for the "ask" box, generated at build time from site content.
import { site } from '../data/site';
import { bio, currently, education, interests, languages } from '../data/about';
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

interface Doc {
  id: string;
  title: string;
  url: string;
  answer: string;
  keywords: string[];
  text: string;
}

const strip = (s: string) =>
  s
    .replace(/^import .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>{}[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  const uiuc = education[0];

  const docs: Doc[] = [
    {
      id: 'study',
      title: 'Education',
      url: '/about',
      answer: `A Bachelor of Science in Computer Science at the ${uiuc.title} (${uiuc.start.slice(0, 4)}–${uiuc.end?.slice(0, 4)}), with an intended Math minor.`,
      keywords: ['study', 'studying', 'major', 'minor', 'degree', 'university', 'college', 'school', 'uiuc', 'illinois', 'education', 'class', 'year', 'graduate', 'student', 'rv', 'pu', 'jee'],
      text: `${bio.long.join(' ')} ${uiuc.note ?? ''}`,
    },
    {
      id: 'contact',
      title: 'Contact',
      url: '/#contact',
      answer: `Email ${site.email}. You can also find me on LinkedIn (${site.socials.linkedin.handle}) and GitHub (${site.socials.github.handle}).`,
      keywords: ['contact', 'email', 'mail', 'reach', 'message', 'hire', 'linkedin', 'github', 'social', 'talk'],
      text: `email ${site.email} linkedin github orcid`,
    },
    {
      id: 'resume',
      title: 'Resume',
      url: '/resume',
      answer: "The resume page is being rebuilt and will be back soon. Email is the best way to reach me in the meantime.",
      keywords: ['resume', 'cv', 'pdf', 'download', 'skills'],
      text: 'resume curriculum vitae pdf download education experience projects skills awards',
    },
    {
      id: 'status',
      title: 'Availability',
      url: '/',
      answer: `${site.status.text}.`,
      keywords: ['internship', 'intern', 'available', 'looking', 'open', 'job', 'summer', 'opportunity', 'hiring'],
      text: site.status.text,
    },
    {
      id: 'goal',
      title: 'About',
      url: '/about',
      answer: bio.short.join(' '),
      keywords: ['who', 'about', 'goal', 'quant', 'quantitative', 'research', 'trading', 'interest', 'career', 'plan'],
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
      keywords: ['currently', 'now', 'working', 'building', 'learning', 'reading', 'lately'],
      text: currently.items.map((c) => c.text).join(' '),
    },
    {
      id: 'site',
      title: 'This site',
      url: '/projects/parjanya-me',
      answer: 'This site is static (Astro and TypeScript) and hosted on GitHub Pages. This box is a keyword search over the site built at build time. It is not an AI.',
      keywords: ['site', 'website', 'built', 'stack', 'astro', 'ai', 'bot', 'chatbot', 'how', 'work', 'intro', 'animation'],
      text: 'astro typescript tailwind static site github pages intro shutter theme ask box keyword search',
    },
    {
      id: 'coursework',
      title: 'Coursework',
      url: '/coursework',
      answer: `Courses by semester are listed on the coursework page. ${terms
        .map((t) => `${t.term}: ${t.courses.map((c) => c.data.code).join(', ')}.`)
        .join(' ')}`,
      keywords: ['course', 'courses', 'class', 'classes', 'coursework', 'semester', 'taking', 'notes'],
      text: terms.flatMap((t) => t.courses.map((c) => `${c.data.code} ${c.data.title} ${t.term}`)).join(' '),
    },
    {
      id: 'writing',
      title: 'Writing',
      url: '/writing',
      answer: posts.length ? `Latest post: "${posts[0].data.title}". All posts are on the writing page.` : 'No posts yet.',
      keywords: ['blog', 'posts', 'writing', 'articles', 'read', 'rss'],
      text: posts.map((p) => p.data.title).join(' '),
    },
    {
      id: 'books',
      title: 'Bookshelf',
      url: '/bookshelf',
      answer: `There are ${books.length} books on the bookshelf, favourites first.`,
      keywords: ['books', 'book', 'reading', 'bookshelf', 'recommend', 'favorite', 'favourite'],
      text: books.map((b) => `${b.data.title} ${b.data.author}`).join(' '),
    },
    ...(show(interests.placeholder) || show(languages.placeholder)
      ? [
          {
            id: 'interests',
            title: 'Interests & languages',
            url: '/about',
            answer: `Interests: ${interests.items.join(', ')}. Languages: ${languages.items.join(', ')}.`,
            keywords: ['interests', 'hobbies', 'languages', 'speak', 'telugu', 'kannada', 'hindi', 'sanskrit'],
            text: [...interests.items, ...languages.items].join(' '),
          },
        ]
      : []),
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      title: p.data.title,
      url: projectUrl(p),
      answer: p.data.summary,
      keywords: ['project', 'projects', 'built', ...p.data.tags, ...p.data.stack],
      text: `${p.data.summary} ${strip(p.body ?? '')}`,
    })),
    ...posts.map((p) => ({
      id: `post-${p.id}`,
      title: p.data.title,
      url: postUrl(p),
      answer: p.data.summary,
      keywords: ['post', 'writing', ...p.data.tags],
      text: `${p.data.summary} ${strip(p.body ?? '')}`,
    })),
    ...jobs.map((j) => ({
      id: `job-${j.id}`,
      title: `${j.data.role} @ ${j.data.company}`,
      url: '/#experience',
      answer: `${j.data.role} at ${j.data.company}, ${dateRange(j.data.start, j.data.end)}.`,
      keywords: ['experience', 'work', 'job', 'intern', 'research', j.data.company],
      text: j.data.bullets.join(' '),
    })),
    ...awards.map((a) => ({
      id: `award-${a.id}`,
      title: a.data.title,
      url: '/about',
      answer: `${a.data.title} (${a.data.issuer}), ${monthYear(a.data.date)}.${a.data.note ? ' ' + a.data.note : ''}`,
      keywords: ['award', 'awards', 'competition', 'contest', 'prize', 'putnam', 'olympiad', 'icpc'],
      text: `${a.data.issuer} ${a.data.note ?? ''}`,
    })),
  ];

  const synonyms: Record<string, string[]> = {
    cv: ['resume'],
    mail: ['email'],
    reach: ['contact', 'email'],
    school: ['university', 'education'],
    college: ['university', 'education'],
    uni: ['university'],
    major: ['study', 'degree'],
    class: ['course'],
    blog: ['writing'],
    article: ['writing'],
    job: ['experience', 'internship'],
    work: ['experience', 'project'],
    internship: ['experience', 'available'],
    hire: ['available', 'contact'],
    code: ['project', 'github'],
    repo: ['github', 'project'],
    quant: ['quantitative', 'trading'],
    finance: ['quant', 'trading'],
    hobby: ['interest'],
    ai: ['site', 'ask'],
  };

  const body = {
    docs,
    synonyms,
    fallback: `I couldn't find that on this site. Try one of the suggestions, or email ${site.email}.`,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
