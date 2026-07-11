function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      const nextHref = href.trim();
      const safeHref = /^(https?:|mailto:|\/|#)/i.test(nextHref) ? nextHref : '#';
      return `<a href="${escapeHtml(safeHref)}">${text}</a>`;
    });
}

function tableCells(line: string) {
  const cells: string[] = [];
  let value = '';
  let escaped = false;
  let source = line.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);

  for (const character of source) {
    if (escaped) {
      value += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '|') {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  if (escaped) value += '\\';
  cells.push(value.trim());
  return cells;
}

function tableAlignments(line: string) {
  const cells = tableCells(line);
  if (!cells.length || !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return undefined;
  return cells.map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

export function renderMarkdown(markdown = '') {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let inList = false;
  let table: { alignments: string[]; rows: string[][] } | undefined;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  const closeTable = () => {
    if (!table) return;
    const [header, ...body] = table.rows;
    const renderRow = (cells: string[], tag: 'th' | 'td') => cells
      .map((cell, index) => `<${tag} style="text-align:${table?.alignments[index] ?? 'left'}">${inlineMarkdown(cell)}</${tag}>`)
      .join('');
    html.push(`<div class="table-wrap"><table><thead><tr>${renderRow(header, 'th')}</tr></thead><tbody>${body.map((row) => `<tr>${renderRow(row, 'td')}</tr>`).join('')}</tbody></table></div>`);
    table = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        closeTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (table) {
      if (line.includes('|')) {
        table.rows.push(tableCells(line));
        continue;
      }
      closeTable();
    }

    const alignments = lines[index + 1] ? tableAlignments(lines[index + 1]) : undefined;
    if (line.includes('|') && alignments) {
      closeList();
      table = { alignments, rows: [tableCells(line)] };
      index += 1;
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      closeTable();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      closeTable();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      closeTable();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    closeTable();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  closeList();
  closeTable();
  return html.join('\n');
}
