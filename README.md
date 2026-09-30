# parjanya.me

Personal site of Parjanya Shankar. Static Astro site, deployed to GitHub Pages at [parjanya.me](https://parjanya.me).

Stack: Astro 7, TypeScript, Tailwind CSS v4, MDX (KaTeX math, Shiki code blocks), small vanilla-TS modules for the interactions. No server, no database, no secrets.

## Run it

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output in dist/
npm run preview      # serve dist/
npm run ci           # type check + build + link check (what CI runs)
```

Node 22.12 or newer.

## Editing content

Everything you'd normally change lives in two places:

| What | Where |
|---|---|
| Name, tagline, status pill, email, socials, home section order, intro settings | `src/data/site.ts` |
| Bio, education timeline, "currently", interests, languages, skills | `src/data/about.ts` |
| Projects (case studies) | `src/content/projects/*.mdx` |
| Experience (home-page tabs, resume) | `src/content/experience/*.md` |
| Courses (`status`: completed, in progress or intended; `category`: stem, or gen-ed to sit behind the gen-ed toggle) | `src/content/courses/courses.yaml` |
| Awards | `src/content/awards/*.md` |
| Books | `src/content/books/*.md` |
| Posts | `src/content/writing/*.mdx` |
| Photo | `src/assets/portrait-placeholder.png` (then set `photoIsPlaceholder = false` in `src/components/home/HomeAbout.astro`) |

The frontmatter schemas are in `src/content.config.ts`. A featured project without a `cover` fails the build.

### Placeholders

Anything not yet verified is marked `placeholder: true` and shows a small dashed **placeholder** tag on the site (and in the resume PDF). Every build prints the full list. Replace or delete them before launch; setting `showPlaceholders: false` in `site.ts` hides all remaining ones at once.

### Dated content

`site.status.updated` and `currently.updated` are dates. The build warns when either is more than 90 days old, so the site doesn't quietly go stale.

### Resume

`/resume` is an "under construction" page for now. The full HTML resume, built from the same content, lives in `src/pages/resume-print/`. That route is only generated for printing, never for the public site. To regenerate `public/resume.pdf` from it:

```bash
npm run resume:pdf
```

This does its own temporary build and needs Chrome or Edge installed (set `CHROME_PATH` if it can't be found). You can also drop your own PDF at `public/resume.pdf`. The link checker fails the build if the file is missing. To bring the HTML resume back as the public page, move `src/pages/resume-print/[...slug].astro` back to `src/pages/resume.astro` and remove its `getStaticPaths`.

## Deploying

`.github/workflows/deploy.yml` type-checks, builds and link-checks every push and pull request. Pushes to `main` deploy to GitHub Pages. One-time setup:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Keep `public/CNAME` (`parjanya.me`), and tick **Enforce HTTPS** once the certificate is issued.

A Lighthouse CI job reports scores against `lighthouserc.json`. It's informational and never blocks a deploy.

## How the moving parts work

- **Intro** (`src/scripts/intro.ts`, `src/components/Intro.astro`): `scripts/generate-intro-glyphs.mjs` turns "parjanya." into SVG outlines with opentype.js at build time (`prebuild`), including the counter of the second "a". The intro types the name, then zooms through that counter by writing an SVG `transform` each frame, interpolating the scale in log space. It plays on the first page load of a browser session. Useful URL flags: `?intro=1` forces it, `?intro=0` skips it (use this for Lighthouse), and `?slow=4` slows every animation 4× (remembered for the session; `?slow=1` resets).
- **Page transitions** (`src/scripts/page.ts`, `shutter.ts`): Astro's `<ClientRouter />` plus a two-panel shutter that closes while the next page loads and opens once it has painted. Reduced motion gets a crossfade.
- **Theme** (`src/scripts/theme.ts`, inline script in `src/components/Head.astro`): no-flash theme from `localStorage` or the system preference, curtain wipe on toggle.
- **Ask box** (`src/scripts/ask.ts`, `src/pages/ask-index.json.ts`): keyword and synonym search over a JSON index built from the site's content. No AI, no server.
- **OG images** (`src/pages/og/[...slug].png.ts`): a 1200×630 card for every page, rendered at build time.

## Credits

- Fonts: [Geist and Geist Mono](https://vercel.com/font), plus small subsets of Noto Sans Kannada, Telugu and Devanagari for the name in other scripts (all SIL Open Font License; see `public/fonts/`).
- The animated construction emoji on `/resume` is from [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/) (CC BY 4.0), credited on the page.

## Other scripts

- `node scripts/generate-art.mjs` regenerates the placeholder artwork in `src/assets/`.
- `npm run check:links` checks every internal link, asset and `#fragment` in `dist/`.
