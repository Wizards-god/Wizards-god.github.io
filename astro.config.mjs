// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { transformerMetaHighlight, transformerNotationHighlight } from '@shikijs/transformers';
import { rehypeCodeBlocks } from './src/lib/rehype-code-blocks.mjs';
import { siteDark, siteLight } from './src/lib/shiki-themes.mjs';
import { siteChecks } from './src/integrations/site-checks.mjs';

export default defineConfig({
  site: 'https://parjanya.me',
  trailingSlash: 'ignore',
  // Keep HTML-aware whitespace (a single space between inline elements survives).
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !page.endsWith('/404/') && !page.endsWith('/404') }),
    siteChecks(),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeHeadingIds,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            // Skip the auto-generated "Footnotes" heading.
            test: (/** @type {import('hast').Element} */ node) =>
              ['h2', 'h3'].includes(node.tagName) && node.properties?.id !== 'footnote-label',
            properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
            content: { type: 'text', value: '#' },
          },
        ],
        [rehypeKatex, { strict: 'ignore' }],
        rehypeCodeBlocks,
      ],
    }),
    shikiConfig: {
      // Vitesse, adjusted to reach 4.5:1 contrast on the site's code backgrounds.
      themes: { light: siteLight, dark: siteDark },
      defaultColor: false,
      transformers: [transformerMetaHighlight(), transformerNotationHighlight()],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
