// Wraps every highlighted <pre> in a figure with a header (language badge +
// copy button). Done at build time so the header never causes layout shift.

const LABELS = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  py: 'Python', python: 'Python', cpp: 'C++', 'c++': 'C++', c: 'C', rs: 'Rust', rust: 'Rust',
  sh: 'Shell', bash: 'Shell', shell: 'Shell', json: 'JSON', html: 'HTML', css: 'CSS',
  astro: 'Astro', md: 'Markdown', mdx: 'MDX', yaml: 'YAML', yml: 'YAML', sql: 'SQL',
  plaintext: 'Text', text: 'Text', txt: 'Text', tex: 'TeX', latex: 'LaTeX',
};

/** @param {any} node */
function isCodePre(node) {
  if (node?.type !== 'element' || node.tagName !== 'pre') return false;
  // Shiki's hast uses a raw `class` string; rehype-parsed trees use `className`.
  const cls = node.properties?.className ?? node.properties?.class;
  const list = Array.isArray(cls) ? cls : typeof cls === 'string' ? cls.split(/\s+/) : [];
  return list.includes('astro-code');
}

/** @param {any} tree */
function walk(tree, fn) {
  if (!tree || !Array.isArray(tree.children)) return;
  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i];
    const replaced = fn(child, i, tree);
    if (replaced) continue;
    walk(child, fn);
  }
}

export function rehypeCodeBlocks() {
  /** @param {any} tree */
  return (tree) => {
    walk(tree, (node, index, parent) => {
      if (!isCodePre(node)) return false;
      const lang = String(node.properties?.dataLanguage ?? node.properties?.['data-language'] ?? 'text');
      const label = LABELS[lang.toLowerCase()] ?? lang;
      node.properties.tabIndex = 0;
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
                children: [{ type: 'text', value: label }],
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
