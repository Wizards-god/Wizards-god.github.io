import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../data/site';
import { getPosts, postUrl } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${site.name}: Writing`,
    description: 'Posts on building things, probability and quantitative problems.',
    site: context.site ?? site.domain,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.summary,
      pubDate: p.data.date,
      link: postUrl(p),
      categories: p.data.tags,
    })),
    customData: '<language>en-us</language>',
  });
}
