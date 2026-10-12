// A small rehype plugin: wraps every highlighted <pre> in a <figure> with a
// header bar holding the language name and a copy button. Doing it at build
// time means the bar is there from the first paint and nothing shifts.

const LANGUAGE_NAMES = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  rs: 'Rust',
  rust: 'Rust',
  sh: 'Shell',
  bash: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  astro: 'Astro',
  md: 'Markdown',
  mdx: 'MDX',
  yaml: 'YAML',
  yml: 'YAML',
  sql: 'SQL',
  plaintext: 'Text',
  text: 'Text',
  txt: 'Text',
  tex: 'TeX',
  latex: 'LaTeX',
};

/** @param {any} node */
function isHighlightedCode(node) {
  if (node?.type !== 'element' || node.tagName !== 'pre') return false;
  // Shiki's own tree has a plain `class` string; trees parsed by rehype use a `className` array.
  const classes = node.properties?.className ?? node.properties?.class;
  const classList = Array.isArray(classes) ? classes : typeof classes === 'string' ? classes.split(/\s+/) : [];
  return classList.includes('astro-code');
}

/**
 * Calls `visit` on every node, depth first. If `visit` returns true it has
 * replaced the node, so its children aren't visited.
 * @param {any} tree
 * @param {(node: any, index: number, parent: any) => boolean} visit
 */
function walkTree(tree, visit) {
  if (!tree || !Array.isArray(tree.children)) return;
  for (let index = 0; index < tree.children.length; index++) {
    const child = tree.children[index];
    const replaced = visit(child, index, tree);
    if (replaced) continue;
    walkTree(child, visit);
  }
}

export function rehypeCodeBlocks() {
  /** @param {any} tree */
  return (tree) => {
    walkTree(tree, (node, index, parent) => {
      if (!isHighlightedCode(node)) return false;
      const language = String(node.properties?.dataLanguage ?? node.properties?.['data-language'] ?? 'text');
      const languageName = LANGUAGE_NAMES[language.toLowerCase()] ?? language;
      node.properties.tabIndex = 0; // so keyboard users can scroll long lines

      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['code-block'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block__bar'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['code-block__lang'] },
                children: [{ type: 'text', value: languageName }],
              },
              {
                type: 'element',
                tagName: 'button',
                properties: { type: 'button', className: ['code-block__copy'], dataCopyCode: '' },
                children: [{ type: 'text', value: 'copy' }],
              },
            ],
          },
          node,
        ],
      };
      return true;
    });
  };
}
