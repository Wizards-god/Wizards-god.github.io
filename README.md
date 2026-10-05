# parjanya.me

The code behind my personal website, [parjanya.me](https://parjanya.me). I'm Parjanya, a Computer Science student at the University of Illinois Urbana-Champaign with an intended Maths minor, and the site is where I put my projects, coursework and writing.

## What's on it

- **Home**: who I am, what I'm open to right now, my experience, a few projects I'd point you to first, and how to reach me.
- **About**: the longer version. Education, what I'm working on and reading at the moment, and the languages I speak.
- **Projects**: things I've built, each with a write-up of how it went, what didn't work, and what I'd change next time.
- **Writing**: longer posts. The first one explains how the intro animation works.
- **Coursework**: my classes at UIUC, semester by semester, with my notes as PDFs where I have them. Gen eds are hidden behind a toggle.
- **Bookshelf**: books I've read or am reading, with a few thoughts on each.
- **Resume**: getting rebuilt at the moment. The PDF is still at [/resume.pdf](https://parjanya.me/resume.pdf).

## Things to try

- Open the site in a new tab. My name types itself out, and then you fly through the hole in the second "a".
- Hover over my name in the top left. It switches between Kannada, Telugu and Sanskrit.
- Switch between light and dark mode, and click around between pages.
- Watch the chart on the home page for a bit. It's a fair random walk seeded with the current time in India, and it moves every few seconds. The line underneath says how lopsided it's been and how often that happens by chance.
- Press "ask" in the bottom right corner and ask about my courses, projects or how to contact me. It isn't an AI. It searches the site itself, so nothing you type goes anywhere.

If your device is set to reduce motion, the animations tone down or switch off. The site also works with JavaScript turned off.

## Built with

[Astro](https://astro.build), TypeScript, Tailwind CSS and MDX. Maths is rendered with KaTeX, code highlighting uses Shiki, and it's hosted on Vercel.

To run it yourself (Node 22.12 or newer):

```bash
npm install
npm run dev
```

## Credits

- Some features are inspired by [Madhav Menon](https://github.com/MadhavMenon10)'s site, including the ask box, the name that changes script on hover, and the coursework page.
- Others are inspired by [Wanqi Zhu](https://wanqizhu.com)'s site, including the tabbed experience section, the featured projects, and the bookshelf.
- Fonts are [Geist and Geist Mono](https://vercel.com/font), plus small parts of Noto Sans Kannada, Telugu and Devanagari for my name in other scripts. All are under the SIL Open Font License.
- The animated construction emoji on the resume page is from [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/) (CC BY 4.0).
- Built with help from Claude Code.
