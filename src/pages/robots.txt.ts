// robots.txt: every crawler may read the whole site. The AI crawlers also get
// a group of their own, so it's explicit that they're welcome. A crawler
// follows the most specific group that names it, and each one allows everything.
import type { APIContext } from 'astro';

const AI_CRAWLERS = [
  'GPTBot', // OpenAI: training
  'OAI-SearchBot', // OpenAI: ChatGPT search
  'ChatGPT-User', // OpenAI: pages ChatGPT opens for a user
  'ClaudeBot', // Anthropic: training
  'Claude-SearchBot', // Anthropic: Claude search
  'PerplexityBot', // Perplexity: search
  'Google-Extended', // Google: Gemini (AI Overviews use the ordinary Googlebot, already allowed by *)
  'Applebot-Extended', // Apple: training Apple's AI models
];

export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site);
  const groups = ['*', ...AI_CRAWLERS].map((crawler) => `User-agent: ${crawler}\nAllow: /`);
  return new Response(`${groups.join('\n\n')}\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
