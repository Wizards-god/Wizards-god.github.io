// The preview image for every page (what shows up when a link is shared),
// drawn at build time by lib/og.ts.
import type { APIContext } from 'astro';
import { site } from '../../data/site';
import { getPosts, getProjects } from '../../lib/content';
import { renderOg, type OgCard } from '../../lib/og';

export async function getStaticPaths() {
  const pages: { slug: string; card: OgCard }[] = [
    { slug: 'home', card: { title: site.name, description: site.tagline, path: '/' } },
    { slug: 'about', card: { title: 'About', eyebrow: 'about', description: 'Computer Science at UIUC, Class of 2030, intended Maths minor.', path: '/about' } },
    { slug: 'projects', card: { title: 'Projects', eyebrow: 'projects', description: "Things I've built, each with a write-up.", path: '/projects' } },
    { slug: 'writing', card: { title: 'Writing', eyebrow: 'writing', description: 'Longer notes on things I have built and problems I have worked through.', path: '/writing' } },
    { slug: 'coursework', card: { title: 'Coursework', eyebrow: 'coursework', description: 'Courses at the University of Illinois Urbana-Champaign, by semester.', path: '/coursework' } },
    { slug: 'bookshelf', card: { title: 'Bookshelf', eyebrow: 'bookshelf', description: "What I'm reading now and what's next.", path: '/bookshelf' } },
    { slug: 'resume', card: { title: 'Resume', eyebrow: 'resume', description: 'Under construction. Back soon.', path: '/resume' } },
  ];

  for (const project of await getProjects()) {
    pages.push({
      slug: `projects/${project.id}`,
      card: { title: project.data.title, eyebrow: 'case study', description: project.data.summary, path: `/projects/${project.id}` },
    });
  }
  for (const post of await getPosts()) {
    pages.push({
      slug: `writing/${post.id}`,
      card: { title: post.data.title, eyebrow: 'writing', description: post.data.summary, path: `/writing/${post.id}` },
    });
  }

  return pages.map(({ slug, card }) => ({ params: { slug }, props: { card } }));
}

export async function GET({ props }: APIContext<{ card: OgCard }>) {
  const png = await renderOg(props.card);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
