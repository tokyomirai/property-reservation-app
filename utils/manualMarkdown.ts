// マニュアル本文（Markdown）→ HTML への軽量レンダラ（依存ライブラリなし）。
// 対応記法: 見出し(## / ###)、順序付き/箇条書きリスト（ネスト可）、**太字**、
//           [リンク](url)、> 引用（注記ボックス）、空行区切りの段落。
// 入力テキストは必ずエスケープしてから変換するため、保存内容による HTML 混入はしない。

interface ListItem {
  indent: number;
  ordered: boolean;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s: string): string {
  let t = escapeHtml(s);
  // [text](url) → リンク（url はエスケープ済み）
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  // **bold**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t;
}

function renderList(block: ListItem[]): string {
  let i = 0;
  function build(level: number): string {
    const tag = block[i].ordered ? 'ol' : 'ul';
    const parts: string[] = [];
    while (i < block.length && block[i].indent >= level) {
      if (block[i].indent > level) break; // 想定外のインデントは無視
      let li = `<li>${inline(block[i].text)}`;
      const myIndent = block[i].indent;
      i++;
      if (i < block.length && block[i].indent > myIndent) {
        li += build(block[i].indent); // ネスト
      }
      li += '</li>';
      parts.push(li);
    }
    return `<${tag}>${parts.join('')}</${tag}>`;
  }
  return build(block[0].indent);
}

export function renderManualMarkdown(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  const listRe = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;
  const markerRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    // 見出し（### を ## より先に判定）
    if (/^###\s+/.test(line)) {
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) {
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
      i++;
      continue;
    }
    // 引用（注記ボックス）: 連続する > 行をまとめる
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<div class="manual-note">${buf.map(inline).join('<br/>')}</div>`);
      continue;
    }
    // リスト: 連続するリスト行をまとめて1ブロックとして描画
    if (listRe.test(line)) {
      const block: ListItem[] = [];
      while (i < lines.length) {
        const m = markerRe.exec(lines[i]);
        if (!m) break;
        block.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
        i++;
      }
      out.push(renderList(block));
      continue;
    }
    // 段落
    out.push(`<p>${inline(line.trim())}</p>`);
    i++;
  }
  return out.join('\n');
}
