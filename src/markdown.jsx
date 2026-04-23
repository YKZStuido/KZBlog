// 亚の博客 — markdown / 语法高亮 / 块渲染
// 这是第一个加载的脚本，在此处集中做 React hooks 的解构，后续文件复用同一个词法作用域。
const { useState, useEffect, useMemo, useRef, Fragment } = React;

// ------- loader -------
async function loadText(path){
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return (await r.text()).replace(/\r\n/g, '\n');
}
async function loadJson(path){
  return JSON.parse(await loadText(path));
}

// ------- syntax highlight -------
const _escHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const _KW = {
  js:     'const|let|var|function|return|if|else|for|while|class|import|export|default|new|this|typeof|true|false|null|undefined|async|await|try|catch|throw|switch|case|break|continue|of|in|from|extends',
  ts:     'const|let|var|function|return|if|else|for|while|class|import|export|default|new|this|typeof|true|false|null|undefined|async|await|try|catch|throw|switch|case|break|continue|of|in|from|extends|type|interface|enum|as|readonly|public|private|protected',
  python: 'def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|lambda|yield|True|False|None|and|or|not|in|is',
  go:     'func|package|import|return|if|else|for|range|switch|case|break|continue|var|const|type|struct|interface|map|chan|go|defer|select|true|false|nil',
  shell:  'if|then|else|fi|for|do|done|while|case|esac|function|return|export|echo|local',
  bash:   'if|then|else|fi|for|do|done|while|case|esac|function|return|export|echo|local',
  cpp:    'int|long|short|char|double|float|void|bool|signed|unsigned|auto|const|constexpr|static|extern|inline|return|if|else|for|while|do|switch|case|break|continue|default|goto|sizeof|typedef|struct|class|enum|union|public|private|protected|virtual|override|final|namespace|using|template|typename|new|delete|this|nullptr|true|false|operator|friend|mutable|try|catch|throw|explicit|decltype|noexcept|static_cast|dynamic_cast|reinterpret_cast|const_cast|include|define|pragma|ifdef|ifndef|endif|undef',
  c:      'int|long|short|char|double|float|void|const|static|extern|inline|return|if|else|for|while|do|switch|case|break|continue|default|goto|sizeof|typedef|struct|enum|union|signed|unsigned|volatile|register|include|define|pragma|ifdef|ifndef|endif',
};
// 预编译每种语言的正则，避免每次 highlight 调用都新建
const _RE = {};
function _reFor(lang){
  if (_RE[lang]) return _RE[lang];
  const kw = _KW[lang] || '';
  const commentPat = (lang==='python'||lang==='shell'||lang==='bash')
    ? '#[^\\n]*' : '//[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const parts = [
    `(${commentPat})`,
    `("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)`,
    kw ? `\\b(${kw})\\b` : '(\\b\\B)',
    `(\\b[A-Za-z_]\\w*(?=\\s*\\())`,
    `(\\b\\d+(?:\\.\\d+)?\\b)`,
  ];
  return (_RE[lang] = new RegExp(parts.join('|'), 'g'));
}
function highlight(text, lang){
  const re = _reFor(lang);
  re.lastIndex = 0;
  let last = 0, out = '';
  text.replace(re, (m, c, s, k, f, n, offset) => {
    out += _escHtml(text.slice(last, offset));
    last = offset + m.length;
    const cls = c?'tok-c': s?'tok-s': k?'tok-k': f?'tok-f': 'tok-n';
    out += `<span class="${cls}">${_escHtml(m)}</span>`;
  });
  return out + _escHtml(text.slice(last));
}

// ------- frontmatter (single-line YAML-ish) -------
function parseScalar(v){
  v = v.trim();
  if (v === '' || v === 'null') return null;
  if (v === 'true')  return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v))      return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')){
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(parseScalar);
  }
  return v;
}
function parseFrontmatter(text){
  if (!text.startsWith('---\n')) return { meta:{}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta:{}, body: text };
  const fm = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n+/, '');
  const meta = {};
  for (const line of fm.split('\n')){
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    meta[line.slice(0, ci).trim()] = parseScalar(line.slice(ci + 1));
  }
  return { meta, body };
}

// ------- markdown body → blocks -------
function parseBody(text){
  const lines = text.split('\n');
  const blocks = [];
  let secN = 0;
  let i = 0;
  const isBlockStart = (l) =>
    l.startsWith('```') || l.startsWith(':::') || l.startsWith('#') ||
    l.startsWith('- ')  || l.startsWith('* ')  || l.startsWith('> ') ||
    l === '>' || /^\d+\.\s/.test(l);

  while (i < lines.length){
    const line = lines[i];
    if (!line.trim()){ i++; continue; }

    // fenced code ```
    if (line.startsWith('```')){
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')){ buf.push(lines[i]); i++; }
      i++;
      blocks.push({ type:'code', lang, text: buf.join('\n') });
      continue;
    }

    // container ::: kind [title]
    if (line.startsWith(':::')){
      const header = line.slice(3).trim();
      const sp = header.indexOf(' ');
      const kind  = sp === -1 ? header : header.slice(0, sp);
      const title = sp === -1 ? ''     : header.slice(sp + 1).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(':::')){ buf.push(lines[i]); i++; }
      i++;
      if (kind === 'callout'){
        blocks.push({ type:'callout', title, text: buf.join('\n').trim() });
      }
      continue;
    }

    // headings
    if (line.startsWith('### ')){ blocks.push({ type:'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('## ')){
      secN++;
      blocks.push({ type:'h2', id:'s'+secN, text: line.slice(3).trim() });
      i++; continue;
    }
    if (line.startsWith('# ')){ i++; continue; } // title 从 frontmatter 取

    // unordered list
    if (line.startsWith('- ') || line.startsWith('* ')){
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))){
        items.push(lines[i].slice(2).trim()); i++;
      }
      blocks.push({ type:'ul', items });
      continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(line)){
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])){
        items.push(lines[i].replace(/^\d+\.\s+/, '').trim()); i++;
      }
      blocks.push({ type:'ol', items });
      continue;
    }

    // blockquote
    if (line.startsWith('> ') || line === '>'){
      const buf = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')){
        buf.push(lines[i].replace(/^>\s?/, '')); i++;
      }
      blocks.push({ type:'blockquote', text: buf.join(' ') });
      continue;
    }

    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])){
      buf.push(lines[i]); i++;
    }
    blocks.push({ type:'p', text: buf.join(' ') });
  }
  return blocks;
}

function parsePost(text){
  const { meta, body } = parseFrontmatter(text);
  const blocks = parseBody(body);
  const sections = blocks
    .filter(b => b.type === 'h2')
    .map(b => ({ id: b.id, h: b.text }));
  return { ...meta, sections, body: blocks };
}

// ------- inline: **bold**, *italic*, `code`, [text](url) -------
// 用 React.memo：Post 页滚动会频繁触发父组件重渲染，而 block 的 text 引用稳定，
// memo 能跳过重复的 inline 解析。
const Inline = React.memo(function Inline({ text }){
  const out = [];
  let i = 0, buf = '', k = 0;
  const push = () => { if (buf){ out.push(buf); buf = ''; } };
  while (i < text.length){
    const c = text[i];
    if (c === '*' && text[i+1] === '*'){
      const end = text.indexOf('**', i + 2);
      if (end > i + 2){ push(); out.push(<strong key={k++}>{text.slice(i+2, end)}</strong>); i = end + 2; continue; }
    }
    if (c === '*'){
      const end = text.indexOf('*', i + 1);
      if (end > i + 1){ push(); out.push(<em key={k++}>{text.slice(i+1, end)}</em>); i = end + 1; continue; }
    }
    if (c === '`'){
      const end = text.indexOf('`', i + 1);
      if (end > i + 1){ push(); out.push(<code key={k++}>{text.slice(i+1, end)}</code>); i = end + 1; continue; }
    }
    if (c === '['){
      const close = text.indexOf(']', i + 1);
      if (close > i && text[close+1] === '('){
        const uend = text.indexOf(')', close + 2);
        if (uend > close + 1){
          push();
          out.push(<a key={k++} href={text.slice(close+2, uend)}>{text.slice(i+1, close)}</a>);
          i = uend + 1; continue;
        }
      }
    }
    buf += c; i++;
  }
  push();
  return <>{out}</>;
});

// 代码块单独成组件 + memo：同一篇文章的代码块引用稳定，避免滚动重渲染时反复高亮。
const CodeBlock = React.memo(function CodeBlock({ text, lang }){
  const lines = useMemo(() => text.split('\n'), [text]);
  return (
    <div className="code-block" data-lang={lang || ''}>
      <pre>
        <code>
        {lines.map((ln, j) => (
          <div key={j}>
            <span className="linum">{j+1}</span>
            {lang
              ? <span dangerouslySetInnerHTML={{__html: highlight(ln, lang) || ' '}} />
              : (ln || ' ')}
          </div>
        ))}
        </code>
      </pre>
    </div>
  );
});

// ------- block renderer -------
function renderBlock(b, i){
  switch (b.type){
    case 'h2':       return <h2 key={i} id={b.id}>{b.text}</h2>;
    case 'h3':       return <h3 key={i}>{b.text}</h3>;
    case 'p':        return <p  key={i}><Inline text={b.text}/></p>;
    case 'ul':       return <ul key={i}>{b.items.map((x,j)=><li key={j}><Inline text={x}/></li>)}</ul>;
    case 'ol':       return <ol key={i}>{b.items.map((x,j)=><li key={j}><Inline text={x}/></li>)}</ol>;
    case 'blockquote': return <blockquote key={i}><Inline text={b.text}/></blockquote>;
    case 'callout':  return <div key={i} className="callout">{b.title && <b>{b.title}</b>}<Inline text={b.text}/></div>;
    case 'code':     return <CodeBlock key={i} text={b.text} lang={b.lang}/>;
    default:         return null;
  }
}
