// Open Graph images for every page, generated at build time.
import type { APIContext } from 'astro';
import { site } from '../../data/site';
import { getPosts, getProjects } from '../../lib/content';
import { renderOg, type OgCard } from '../../lib/og';

export async function getStaticPaths() {
  const pages: { slug: string; card: OgCard }[] = [
    { slug: 'home', card: { title: site.name, description: site.tagline, path: '/' } },
    { slug: 'about', card: { title: 'About', eyebrow: 'about', description: 'Computer Science at UIUC, Class of 2030, intended Math minor.', path: '/about' } },
    { slug: 'projects', card: { title: 'Projects', eyebrow: 'projects', description: 'Things I have built, each with an honest write-up.', path: '/projects' } },
    { slug: 'writing', card: { title: 'Writing', eyebrow: 'writing', description: 'Longer notes on things I have built and problems I have worked through.', path: '/writing' } },
    { slug: 'coursework', card: { title: 'Coursework', eyebrow: 'coursework', description: 'Courses at the University of Illinois Urbana-Champaign, by semester.', path: '/coursework' } },
    { slug: 'bookshelf', card: { title: 'Bookshelf', eyebrow: 'bookshelf', description: 'Books that stayed with me.', path: '/bookshelf' } },
    { slug: 'resume', card: { title: 'Resume', eyebrow: 'resume', description: 'Under construction. Back soon.', path: '/resume' } },
  ];

  for (const p of await getProjects()) {
    pages.push({
      slug: `projects/${p.id}`,
      card: { title: p.data.title, eyebrow: 'case study', description: p.data.summary, path: `/projects/${p.id}` },
    });
  }
  for (const p of await getPosts()) {
    pages.push({
      slug: `writing/${p.id}`,
      card: { title: p.data.title, eyebrow: 'writing', description: p.data.summary, path: `/writing/${p.id}` },
    });
  }

  return pages.map(({ slug, card }) => ({ params: { slug }, props: { card } }));
}

export async function GET({ props }: APIContext<{ card: OgCard }>) {
  const png = await renderOg(props.card);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
