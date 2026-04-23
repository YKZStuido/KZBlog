// 亚の博客 — personal blog app
const { useState, useEffect, useMemo, useRef, Fragment } = React;

// ------- loader -------
async function loadText(path){
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  const t = await r.text();
  return t.replace(/\r\n/g, '\n');
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
};
function highlight(text, lang){
  const kw = _KW[lang] || '';
  const commentPat = (lang==='python'||lang==='shell'||lang==='bash')
    ? '#[^\\n]*' : '//[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const parts = [`(${commentPat})`,
    `("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)`];
  if (kw) parts.push(`\\b(${kw})\\b`);
  parts.push(`(\\b[A-Za-z_]\\w*(?=\\s*\\())`, `(\\b\\d+(?:\\.\\d+)?\\b)`);
  const re = new RegExp(parts.join('|'), 'g');
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
    if (line.startsWith('# ')){ i++; continue; } // title comes from frontmatter

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
function Inline({ text }){
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
}

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
    case 'code': {
      const lines = b.text.split('\n');
      return (
        <pre key={i} data-lang={b.lang || ''}>
          <code>
            {lines.map((ln,j)=>(
              <div key={j}>
                <span className="linum">{j+1}</span>
                {b.lang
                  ? <span dangerouslySetInnerHTML={{__html: highlight(ln,b.lang)||'\u00A0'}} />
                  : (ln || '\u00A0')}
              </div>
            ))}
          </code>
        </pre>
      );
    }
    default: return null;
  }
}

// ------- root -------
function App(){
  const [data, setData] = useState(null); // { site, home, archivePage, aboutPage, posts[], about: {body} }
  const [postCache, setPostCache] = useState({}); // id -> parsed post
  const [loadError, setLoadError] = useState(null);

  const [route, setRoute] = useState(() => {
    const h = location.hash.replace(/^#\/?/, '');
    if (h.startsWith('post/')) return { name:'post', id: h.slice(5) };
    if (h === 'archive') return { name:'archive'};
    if (h === 'about')   return { name:'about'};
    if (h === 'minesweeper') return { name:'minesweeper'};
    return { name: 'home' };
  });
  const [tweaks, setTweaks] = useState(window.__TWEAKS__);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // initial load: index + every post md + about
  useEffect(()=>{
    (async () => {
      try {
        const idx = await loadJson('./archive/index.json');
        const postTexts = await Promise.all(
          idx.posts.map(id => loadText(`./archive/posts/${id}.md`))
        );
        const posts = idx.posts.map((id, i) => ({ id, ...parsePost(postTexts[i]) }));
        const cache = {};
        posts.forEach(p => { cache[p.id] = p; });

        const aboutText = await loadText('./archive/pages/about.md');
        const aboutBody = parseBody(parseFrontmatter(aboutText).body);

        setPostCache(cache);
        setData({
          site: idx.site,
          home: idx.home,
          archivePage: idx.archivePage,
          aboutPage: { ...idx.aboutPage, body: aboutBody },
          collections: idx.collections || [],
          posts: posts.map(p => ({
            id: p.id, num: p.num, title: p.title, excerpt: p.excerpt,
            date: p.date, read: p.read, tags: p.tags,
            featured: !!p.featured, pinned: !!p.pinned,
            collection: p.collection || null,
            collection_n: p.collection_n || null,
          })),
        });
      } catch (e){
        setLoadError(e.message);
      }
    })();
  }, []);

  // url sync
  useEffect(()=>{
    const map = {
      home: '#/',
      archive: '#/archive',
      about: '#/about',
      minesweeper: '#/minesweeper',
      post: `#/post/${route.id}`,
    };
    history.replaceState(null,'',map[route.name] || '#/');
    window.scrollTo(0,0);
  }, [route]);

  // apply tweaks
  useEffect(()=>{
    document.body.dataset.theme = tweaks.theme;
    document.documentElement.style.setProperty('--colw', tweaks.columnWidth + 'px');
    const fonts = {
      serif: '"Source Serif 4","Noto Serif SC",Georgia,serif',
      sans:  '"Noto Sans SC",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif',
      mono:  '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace',
    };
    document.documentElement.style.setProperty('--body-font', fonts[tweaks.bodyFont] || fonts.serif);
    document.documentElement.style.setProperty('--title-font',
      tweaks.bodyFont === 'mono' ? fonts.mono : fonts.serif);
    const dens = tweaks.density === 'dense' ? 15 : tweaks.density === 'loose' ? 19 : 17;
    document.body.style.fontSize = dens + 'px';
  }, [tweaks]);

  // edit-mode contract
  useEffect(()=>{
    const h = (e)=>{
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({type:'__edit_mode_available'},'*');
    return ()=> window.removeEventListener('message', h);
  }, []);

  const updateTweak = (patch)=>{
    setTweaks(t => {
      const next = {...t, ...patch};
      window.parent.postMessage({type:'__edit_mode_set_keys', edits: patch}, '*');
      return next;
    });
  };

  if (loadError){
    return (
      <div style={{padding:40, fontFamily:'var(--mono)', color:'var(--ink-soft)', maxWidth:620}}>
        <div style={{marginBottom:8, color:'var(--ink)', fontSize:14}}>内容加载失败</div>
        <div style={{fontSize:13}}>{loadError}</div>
        <div style={{marginTop:14, fontSize:12, color:'var(--ink-faint)', lineHeight:1.7}}>
          这个站点通过 <code>fetch</code> 加载 <code>./archive/</code> 下的文件。请通过静态服务器打开，例如：
          <pre style={{marginTop:8, fontSize:12}}>python -m http.server 8000</pre>
        </div>
      </div>
    );
  }
  if (!data){
    return <div style={{padding:40, fontFamily:'var(--mono)', color:'var(--ink-faint)'}}>加载中…</div>;
  }

  const { site, home, archivePage, aboutPage, posts, collections } = data;

  return (
    <>
      <TopBar route={route} setRoute={setRoute} editMode={editMode} togglePanel={()=>setPanelOpen(o=>!o)} />
      {route.name === 'home'    && <Home posts={posts} site={site} content={home} setRoute={setRoute} collections={collections} />}
      {route.name === 'post'    && <Post posts={posts} site={site} post={postCache[route.id]} setRoute={setRoute} showToc={tweaks.showToc} collections={collections} />}
      {route.name === 'archive' && <Archive posts={posts} content={archivePage} setRoute={setRoute} collections={collections} />}
      {route.name === 'about'   && <About content={aboutPage} />}
      {route.name === 'minesweeper' && <Minesweeper setRoute={setRoute} />}
      <PageFoot site={site} setRoute={setRoute} />
      {editMode && (
        <TweakPanel open={panelOpen} close={()=>setPanelOpen(false)} tweaks={tweaks} update={updateTweak} fabClick={()=>setPanelOpen(o=>!o)} />
      )}
    </>
  );
}

// ------- top bar -------
function TopBar({route, setRoute, editMode, togglePanel}){
  const path = route.name === 'post' ? '/post/' + route.id
             : route.name === 'archive' ? '/archive'
             : route.name === 'about' ? '/about'
             : route.name === 'minesweeper' ? '/minesweeper'
             : '/';
  return (
    <div className="topbar">
      <div className="tb-dots"><i/><i/><i/></div>
      <span className="tb-path">~/blog<b>{path}</b></span>
      <div className="tb-right">
        <a className={route.name==='home'?'active':''} onClick={()=>setRoute({name:'home'})}>首页</a>
        <a className={route.name==='minesweeper'?'active':''} onClick={()=>setRoute({name:'minesweeper'})}>扫雷</a>
        <a className={route.name==='archive'?'active':''} onClick={()=>setRoute({name:'archive'})}>归档</a>
        <a className={route.name==='about'?'active':''} onClick={()=>setRoute({name:'about'})}>关于</a>
        <span className="tb-k">⌘K</span>
        {editMode && <a onClick={togglePanel} style={{color:'var(--accent)'}}>⚙ Tweaks</a>}
      </div>
    </div>
  );
}

// ------- home -------
function Home({posts, site, content, setRoute, collections}){
  const [active, setActive] = useState('全部');
  const [activeCollection, setActiveCollection] = useState(null);
  const [q, setQ] = useState('');

  const allTags = useMemo(()=> [...new Set(posts.flatMap(p => p.tags))], [posts]);
  const totalMinutes = useMemo(()=> posts.reduce((a,p)=>a+p.read,0), [posts]);

  const filtered = useMemo(()=>{
    return posts.filter(p=>{
      const tagOk = active === '全部' || p.tags.includes(active);
      const colOk = !activeCollection || p.collection === activeCollection;
      const qOk = !q || (p.title+p.excerpt+p.tags.join(' ')).toLowerCase().includes(q.toLowerCase());
      return tagOk && colOk && qOk;
    });
  }, [active, activeCollection, q, posts]);

  const featured = posts.find(p=>p.featured);
  const statValue = (s) => {
    if (s.value !== undefined) return s.value;
    if (s.kind === 'postCount')   return posts.length;
    if (s.kind === 'tagCount')    return allTags.length;
    if (s.kind === 'readMinutes') return totalMinutes + '′';
    return '';
  };

  return (
    <>
      <header className="mast">
        <div>
          <div className="sub">{site.brandLong}</div>
          <h1>
            {site.tagline.lead}<em>{site.tagline.emph}</em>{site.tagline.tail}<br/>
            {site.tagline.line2}
          </h1>
        </div>
        <div className="mast-right">
          <div><b>{site.author}</b> · {site.grade}</div>
          <div>{posts.length} 篇 · {totalMinutes} 分钟</div>
          <div>上次更新 · {site.lastUpdate}</div>
        </div>
      </header>

      <div className="statsbar">
        {site.stats.map((s,i)=>(
          <div key={i} className="stat">
            <div className="n">{statValue(s)}</div>
            <div className="l">{s.label}</div>
          </div>
        ))}
      </div>

      <main className="page">
        <section className="featured" style={{marginTop: 32}}>
          {featured && (
            <div className="cell">
              <div className="kicker"><i/>最新 · No.{featured.num}</div>
              <h2 onClick={()=>setRoute({name:'post', id: featured.id})}>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <div className="meta">{featured.date} · {featured.read} min read · {featured.tags.join(' · ')}</div>
            </div>
          )}
          <div className="cell">
            <div className="kicker">{content.upcoming.kicker}</div>
            <h2 style={{color:'var(--ink-soft)', cursor:'default'}}>{content.upcoming.title}</h2>
            <p>{content.upcoming.excerpt}</p>
            <div className="meta">{content.upcoming.meta}</div>
          </div>
        </section>

        <div className="index-grid">
          <aside className="side">
            <h4>Search</h4>
            <div className="search">
              <span style={{color:'var(--ink-faint)'}}>⌕</span>
              <input placeholder="在文章中搜索…" value={q} onChange={e=>setQ(e.target.value)} />
            </div>

            <h4>Topics</h4>
            <div className="tag-list">
              <button className={'tag'+(active==='全部'?' on':'')} onClick={()=>setActive('全部')}>全部 · {posts.length}</button>
              {allTags.map(t=>(
                <button key={t} className={'tag'+(active===t?' on':'')} onClick={()=>setActive(t)}>
                  {t} · {posts.filter(p=>p.tags.includes(t)).length}
                </button>
              ))}
            </div>

            {collections && collections.length > 0 && (
              <>
                <h4>Collections</h4>
                <div className="tag-list">
                  {collections.map(c => {
                    const count = posts.filter(p => p.collection === c.id).length;
                    return (
                      <button key={c.id}
                        className={'tag' + (activeCollection === c.id ? ' on' : '')}
                        onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}>
                        {c.title} · {count}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <h4>Sections</h4>
            <div style={{lineHeight:1.9}}>
              {content.sidebarSections.map(s=>(
                <div key={s.n}><span style={{color:'var(--ink-faint)'}}>{s.n} · </span>{s.t}</div>
              ))}
            </div>

            <h4 style={{marginTop: 24}}>Elsewhere</h4>
            <div style={{lineHeight:1.9}}>
              {content.elsewhere.map((e,i)=>(<div key={i}>{e}</div>))}
            </div>
          </aside>

          <section className="posts">
            <div style={{fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--ink-faint)', marginBottom: 8}}>
              № · 文章 ({filtered.length})
            </div>
            {filtered.map(p=>(
              <div key={p.id} className="post-row" onClick={()=>setRoute({name:'post', id: p.id})}>
                <div className="num">№ {p.num}</div>
                <div>
                  <h3>{p.title}</h3>
                  <div className="excerpt">{p.excerpt}</div>
                  <div className="tags-inline">
                    {p.tags.map(t=><span key={t} className="tag" onClick={(e)=>{e.stopPropagation(); setActive(t);}}>{t}</span>)}
                  </div>
                </div>
                <div className="meta">
                  <b>{p.date}</b><br/>
                  {p.read} min read
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{padding:'60px 0', textAlign:'center', color:'var(--ink-faint)', fontFamily:'var(--mono)', fontSize:13}}>
                没找到。试试换个关键词？
              </div>
            )}
          </section>
        </div>

      </main>
    </>
  );
}

// ------- post page -------
function Post({posts, site, post, setRoute, showToc, collections}){
  const [activeSec, setActiveSec] = useState(undefined);
  const [progress, setProgress] = useState(0);

  useEffect(()=>{
    setActiveSec(post?.sections?.[0]?.id);
  }, [post?.id]);

  useEffect(()=>{
    if (!post) return;
    const on = ()=>{
      const secs = (post.sections||[]).map(s=>document.getElementById(s.id)).filter(Boolean);
      const y = window.scrollY + 140;
      let cur = post.sections[0]?.id;
      for (const el of secs){ if (el.offsetTop <= y) cur = el.id; }
      setActiveSec(cur);
      const h = document.documentElement;
      setProgress(Math.round( (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100 ));
    };
    window.addEventListener('scroll', on, {passive:true});
    on();
    return ()=> window.removeEventListener('scroll', on);
  }, [post?.id]);

  const seriesInfo = useMemo(()=>{
    if (!post?.collection || !collections) return null;
    const col = collections.find(c => c.id === post.collection);
    if (!col) return null;
    const seriesPosts = posts
      .filter(p => p.collection === post.collection)
      .sort((a, b) => (a.collection_n || 0) - (b.collection_n || 0));
    return { ...col, posts: seriesPosts };
  }, [post?.id, post?.collection, collections, posts]);

  if (!post){
    return (
      <main className="page">
        <article className="article">
          <a className="backlink" onClick={()=>setRoute({name:'home'})}>← 回到首页</a>
          <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)'}}>未找到这篇文章。</div>
        </article>
      </main>
    );
  }

  const idx = posts.findIndex(p=>p.id===post.id);
  const prev = posts[idx+1];
  const next = posts[idx-1];
  const sections = post.sections || [];
  const body = post.body || [];
  const wordCount = body
    .filter(b => b.type === 'p' || b.type === 'blockquote' || b.type === 'callout')
    .reduce((a,b)=>a + (b.text?.length || 0), 0)
    + (post.lede?.length || 0);

  return (
    <main className="page">
      {showToc && sections.length > 1 && (
        <nav className="toc">
          <h5>目录 · {post.num}</h5>
          {sections.map(s=>(
            <a key={s.id} className={activeSec===s.id?'active':''}
               onClick={()=>{document.getElementById(s.id)?.scrollIntoView({behavior:'smooth', block:'start'});}}>
              {s.h}
            </a>
          ))}
          <div className="prog">阅读进度 · {progress}%</div>
        </nav>
      )}

      <article className="article">
        <a className="backlink" onClick={()=>setRoute({name:'home'})}>← 回到首页</a>

        <div style={{fontFamily:'var(--mono)', fontSize:11.5, color:'var(--ink-faint)', letterSpacing:'.15em', marginBottom: 14}}>
          № {post.num} · {post.tags.join(' · ').toUpperCase()}
        </div>

        <h1>{post.title}</h1>

        <div className="byline">
          <span>{site.author}</span>
          <span>{post.date}</span>
          <span>{post.read} min read</span>
          <span>{wordCount} 字</span>
        </div>

        {seriesInfo && (
          <div className="series-card">
            <div className="series-head">
              <span>系列合集</span>
              <b>{seriesInfo.title}</b>
              <span className="series-count">共 {seriesInfo.posts.length} 篇</span>
            </div>
            {seriesInfo.posts.map((p, i) => (
              <div key={p.id}
                className={'series-item' + (p.id === post.id ? ' current' : '')}
                onClick={p.id !== post.id ? () => setRoute({name:'post', id: p.id}) : undefined}
                style={{cursor: p.id !== post.id ? 'pointer' : 'default'}}>
                <span className="series-n">{p.collection_n || (i + 1)}</span>
                <span className="series-t">{p.title}</span>
                {p.id === post.id && <span className="series-cur">当前</span>}
              </div>
            ))}
          </div>
        )}

        {post.lede && <p className="lede"><Inline text={post.lede}/></p>}
        {body.map((b,i)=>renderBlock(b, i))}

        <div className="article-end">
          <div className="sign">{site.signature}</div>
        </div>

        <div className="next-prev">
          {prev ? (
            <div className="np" onClick={()=>setRoute({name:'post', id: prev.id})}>
              <div className="dir">← 上一篇</div>
              <div className="nt">{prev.title}</div>
            </div>
          ) : <div/>}
          {next ? (
            <div className="np right" onClick={()=>setRoute({name:'post', id: next.id})}>
              <div className="dir">下一篇 →</div>
              <div className="nt">{next.title}</div>
            </div>
          ) : <div/>}
        </div>
      </article>
    </main>
  );
}

// ------- archive -------
function Archive({posts, content, setRoute, collections}){
  const byYear = useMemo(()=>{
    const m = {};
    for (const p of posts){
      const y = p.date.slice(0,4);
      (m[y] = m[y] || []).push(p);
    }
    return m;
  }, [posts]);

  const subtitle = content.subtitle.replace('{count}', posts.length);

  return (
    <main className="page">
      <header style={{padding:'40px 0 24px', borderBottom:'1px solid var(--rule)'}}>
        <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10}}>{content.kicker}</div>
        <h1 style={{margin:0, fontFamily:'var(--title-font)', fontWeight:500, fontSize:48, letterSpacing:'-0.02em'}}>{content.title}</h1>
        <p style={{color:'var(--ink-soft)', marginTop:10, fontSize:16}}>{subtitle}</p>
      </header>

      {Object.keys(byYear).sort().reverse().map(y=>(
        <section key={y}>
          <div className="archive-year">
            <h2>{y}</h2>
            <span>{byYear[y].length} 篇</span>
          </div>
          {byYear[y].map(p=>{
            const col = p.collection ? (collections||[]).find(c=>c.id===p.collection) : null;
            return (
              <div key={p.id} className="archive-row" onClick={()=>setRoute({name:'post', id: p.id})}>
                <div className="ar-date">{p.date.slice(5)}</div>
                <div className="ar-title">{p.title}</div>
                <div className="ar-tags">
                  {col && <span className="ar-series">{col.title} · </span>}
                  {p.tags.join(' / ')}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}

// ------- about -------
function About({content}){
  return (
    <main className="page">
      <header style={{padding:'40px 0 24px', borderBottom:'1px solid var(--rule)'}}>
        <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10}}>{content.kicker}</div>
        <h1 style={{margin:0, fontFamily:'var(--title-font)', fontWeight:500, fontSize:48, letterSpacing:'-0.02em'}}>{content.title}</h1>
      </header>

      <div className="about">
        <div className="bio">
          {content.body.map((b,i)=>renderBlock(b, i))}
        </div>

        <aside className="about-card">
          <div className="avatar">
            {/\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(content.card.avatar)
              ? <img src={content.card.avatar} alt="avatar" />
              : content.card.avatar}
          </div>
          <dl>
            {content.card.rows.map(([dt, dd],i)=>(
              <Fragment key={i}>
                <dt>{dt}</dt><dd>{dd}</dd>
              </Fragment>
            ))}
          </dl>
        </aside>
      </div>
    </main>
  );
}

// ------- footer -------
function PageFoot({site, setRoute}){
  return (
    <footer className="pagefoot">
      <div>{site.footer}</div>
      <div style={{display:'flex', gap: 18}}>
        <a onClick={()=>setRoute({name:'home'})}>home</a>
        <a onClick={()=>setRoute({name:'archive'})}>archive</a>
        <a onClick={()=>setRoute({name:'about'})}>about</a>
        <a>github</a>
      </div>
    </footer>
  );
}

// ------- tweak panel -------
function TweakPanel({open, close, tweaks, update, fabClick}){
  const themes = [
    { id:'paper',    label:'纸张', bg:'#FAFAF7', ink:'#111311', accent:'oklch(62% 0.18 245)' },
    { id:'charcoal', label:'深色', bg:'#111311', ink:'#EDEBE3', accent:'oklch(75% 0.16 85)' },
    { id:'terminal', label:'终端', bg:'#0C0F0C', ink:'#CFE8CF', accent:'oklch(82% 0.17 140)' },
    { id:'journal',  label:'期刊', bg:'#F4EEE0', ink:'#2A1F14', accent:'oklch(55% 0.15 25)' },
  ];
  return (
    <>
      <button className="tweak-fab" style={{display:'flex'}} onClick={fabClick}>⚙</button>
      <div className={'tweak-panel' + (open?' on':'')}>
        <div className="tweak-head">
          <b>Tweaks</b>
          <button onClick={close}>✕</button>
        </div>
        <div className="tweak-body">
          <label>主题 / Theme</label>
          <div className="theme-swatch">
            {themes.map(t=>(
              <button key={t.id} className={tweaks.theme===t.id?'on':''} onClick={()=>update({theme:t.id})}>
                <span className="sw" style={{background:t.bg}}>
                  <span style={{position:'absolute', inset:4, background:t.ink, opacity:.15}}/>
                  <span style={{position:'absolute', right:4, bottom:4, width:10, height:10, borderRadius:'50%', background:t.accent}}/>
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <label>正文字体</label>
          <div className="tweak-opts">
            {[['serif','衬线'],['sans','黑体'],['mono','等宽']].map(([k,l])=>(
              <button key={k} className={tweaks.bodyFont===k?'on':''} onClick={()=>update({bodyFont:k})}>{l}</button>
            ))}
          </div>

          <label>行距密度</label>
          <div className="tweak-opts">
            {[['dense','紧凑'],['comfortable','舒适'],['loose','宽松']].map(([k,l])=>(
              <button key={k} className={tweaks.density===k?'on':''} onClick={()=>update({density:k})}>{l}</button>
            ))}
          </div>

          <label>正文宽度 · {tweaks.columnWidth}px</label>
          <input type="range" min="560" max="820" step="20" value={tweaks.columnWidth}
            onChange={e=>update({columnWidth: +e.target.value})}
            style={{width:'100%'}}/>

          <label>文章目录</label>
          <div className="tweak-opts">
            <button className={tweaks.showToc?'on':''} onClick={()=>update({showToc:true})}>显示</button>
            <button className={!tweaks.showToc?'on':''} onClick={()=>update({showToc:false})}>隐藏</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ------- minesweeper -------
const MS_LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: '简单' },
  medium: { rows: 16, cols: 16, mines: 40, label: '中等' },
  hard:   { rows: 16, cols: 30, mines: 99, label: '困难' },
};

function msMakeBoard(rows, cols){
  const b = [];
  for (let r = 0; r < rows; r++){
    const row = [];
    for (let c = 0; c < cols; c++){
      row.push({ mine:false, open:false, flag:false, n:0 });
    }
    b.push(row);
  }
  return b;
}

function msPlantMines(board, rows, cols, mines, safeR, safeC){
  const forbid = new Set();
  for (let dr = -1; dr <= 1; dr++){
    for (let dc = -1; dc <= 1; dc++){
      const nr = safeR+dr, nc = safeC+dc;
      if (nr>=0 && nr<rows && nc>=0 && nc<cols) forbid.add(nr*cols+nc);
    }
  }
  const cells = [];
  for (let i = 0; i < rows*cols; i++) if (!forbid.has(i)) cells.push(i);
  for (let i = cells.length-1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const placed = Math.min(mines, cells.length);
  for (let i = 0; i < placed; i++){
    const idx = cells[i];
    board[Math.floor(idx/cols)][idx%cols].mine = true;
  }
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      if (board[r][c].mine) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++){
        for (let dc = -1; dc <= 1; dc++){
          if (!dr && !dc) continue;
          const nr = r+dr, nc = c+dc;
          if (nr>=0 && nr<rows && nc>=0 && nc<cols && board[nr][nc].mine) n++;
        }
      }
      board[r][c].n = n;
    }
  }
}

const MS_STATS_KEY = 'blog.minesweeper.stats.v1';

function msEmptyStats(){
  const s = {};
  for (const k of Object.keys(MS_LEVELS)) s[k] = { plays:0, wins:0, bestTime:null, totalTime:0 };
  return s;
}

function msLoadStats(){
  try {
    const raw = localStorage.getItem(MS_STATS_KEY);
    if (!raw) return msEmptyStats();
    const parsed = JSON.parse(raw);
    const base = msEmptyStats();
    for (const k of Object.keys(base)){
      if (parsed[k]) base[k] = { ...base[k], ...parsed[k] };
    }
    return base;
  } catch { return msEmptyStats(); }
}

function msSaveStats(s){
  try { localStorage.setItem(MS_STATS_KEY, JSON.stringify(s)); } catch {}
}

function msFlood(board, rows, cols, r, c){
  const stack = [[r,c]];
  while (stack.length){
    const [cr, cc] = stack.pop();
    const cell = board[cr][cc];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true;
    if (cell.n === 0){
      for (let dr = -1; dr <= 1; dr++){
        for (let dc = -1; dc <= 1; dc++){
          if (!dr && !dc) continue;
          const nr = cr+dr, nc = cc+dc;
          if (nr>=0 && nr<rows && nc>=0 && nc<cols) stack.push([nr,nc]);
        }
      }
    }
  }
}

function Minesweeper({setRoute}){
  const [level, setLevel] = useState('easy');
  const cfg = MS_LEVELS[level];
  const [board, setBoard] = useState(() => msMakeBoard(cfg.rows, cfg.cols));
  const [seeded, setSeeded] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | playing | won | lost
  const [flags, setFlags] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState(() => msLoadStats());
  const [confirmReset, setConfirmReset] = useState(false);

  const recordGame = (lv, won, seconds) => {
    setStats(prev => {
      const next = { ...prev, [lv]: { ...prev[lv] } };
      next[lv].plays += 1;
      next[lv].totalTime += seconds;
      if (won){
        next[lv].wins += 1;
        if (next[lv].bestTime == null || seconds < next[lv].bestTime){
          next[lv].bestTime = seconds;
        }
      }
      msSaveStats(next);
      return next;
    });
  };

  const resetStats = () => {
    const empty = msEmptyStats();
    setStats(empty);
    msSaveStats(empty);
    setConfirmReset(false);
  };

  const reset = (lv = level) => {
    const c = MS_LEVELS[lv];
    setBoard(msMakeBoard(c.rows, c.cols));
    setSeeded(false);
    setStatus('idle');
    setFlags(0);
    setStartAt(0);
    setElapsed(0);
  };

  useEffect(()=>{
    if (status !== 'playing') return;
    const id = setInterval(()=> setElapsed(Math.floor((Date.now()-startAt)/1000)), 250);
    return ()=> clearInterval(id);
  }, [status, startAt]);

  const onOpen = (r, c) => {
    if (status === 'won' || status === 'lost') return;
    const b = board.map(row => row.map(cell => ({...cell})));
    if (!seeded){
      msPlantMines(b, cfg.rows, cfg.cols, cfg.mines, r, c);
      setSeeded(true);
      setStartAt(Date.now());
      setStatus('playing');
    }
    const cell = b[r][c];
    if (cell.flag || cell.open) return;
    if (cell.mine){
      for (let i = 0; i < cfg.rows; i++){
        for (let j = 0; j < cfg.cols; j++){
          if (b[i][j].mine) b[i][j].open = true;
        }
      }
      b[r][c].exploded = true;
      setBoard(b);
      setStatus('lost');
      recordGame(level, false, Math.floor((Date.now()-startAt)/1000));
      return;
    }
    msFlood(b, cfg.rows, cfg.cols, r, c);
    let opened = 0;
    for (let i = 0; i < cfg.rows; i++){
      for (let j = 0; j < cfg.cols; j++){
        if (b[i][j].open) opened++;
      }
    }
    setBoard(b);
    if (opened === cfg.rows*cfg.cols - cfg.mines){
      setStatus('won');
      recordGame(level, true, Math.floor((Date.now()-startAt)/1000));
    }
  };

  const onFlag = (e, r, c) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    const cell = board[r][c];
    if (cell.open) return;
    const b = board.map(row => row.map(cell => ({...cell})));
    b[r][c].flag = !b[r][c].flag;
    setBoard(b);
    setFlags(f => f + (b[r][c].flag ? 1 : -1));
  };

  const numColors = ['#2563eb','#16a34a','#dc2626','#7c3aed','#b45309','#0891b2','#111','#6b7280'];

  const cellSize = level === 'hard' ? 24 : 28;

  return (
    <main className="page">
      <article className="article" style={{maxWidth: 'none'}}>
        <a className="backlink" onClick={()=>setRoute({name:'home'})}>← 回到首页</a>
        <h1 style={{marginTop:8}}>扫雷</h1>
        <div className="lede">左键翻开，右键插旗。第一次点击必定安全。</div>

        <div style={{
          display:'flex', gap:12, alignItems:'center', flexWrap:'wrap',
          fontFamily:'var(--mono)', fontSize:13, color:'var(--ink-soft)',
          marginTop:18, marginBottom:14,
        }}>
          <div style={{display:'flex', gap:6}}>
            {Object.entries(MS_LEVELS).map(([k, v]) => (
              <button key={k}
                onClick={()=>{ setLevel(k); reset(k); }}
                style={{
                  fontFamily:'var(--mono)', fontSize:12, cursor:'pointer',
                  padding:'4px 10px', borderRadius:4,
                  border:'1px solid var(--rule-strong)',
                  background: level===k ? 'var(--ink)' : 'transparent',
                  color: level===k ? 'var(--bg)' : 'var(--ink-soft)',
                }}>
                {v.label}
              </button>
            ))}
          </div>
          <div style={{marginLeft:'auto', display:'flex', gap:16, alignItems:'center'}}>
            <span>💣 {cfg.mines - flags}</span>
            <button onClick={()=>reset()} style={{
              fontFamily:'var(--mono)', fontSize:12, cursor:'pointer',
              background:'transparent', color:'var(--ink)',
              border:'1px solid var(--rule-strong)', borderRadius:4, padding:'4px 12px',
            }}>↻ 重新开始</button>
            <span>⏱ {elapsed}s</span>
          </div>
        </div>

        <div style={{
          maxWidth:'100%', overflowX:'auto', WebkitOverflowScrolling:'touch',
        }}>
        <div style={{
          display:'inline-block', padding:8,
          border:'1px solid var(--rule-strong)', borderRadius:4,
          background:'var(--paper, #f5f2ec)',
        }}>
          {board.map((row, r) => (
            <div key={r} style={{display:'flex'}}>
              {row.map((cell, c) => {
                const open = cell.open;
                const bg = open
                  ? (cell.exploded ? '#fecaca' : 'var(--bg)')
                  : 'var(--rule)';
                let content = '';
                if (cell.open){
                  if (cell.mine) content = '💣';
                  else if (cell.n > 0) content = cell.n;
                } else if (cell.flag){
                  content = '🚩';
                }
                return (
                  <div key={c}
                    className={'ms-cell' + (cell.open ? ' open' : '')}
                    onClick={()=>onOpen(r,c)}
                    onContextMenu={(e)=>onFlag(e,r,c)}
                    style={{
                      width: cellSize, height: cellSize,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'var(--mono)', fontWeight:700,
                      fontSize: level==='hard' ? 13 : 14,
                      border:'1px solid var(--rule-strong)',
                      marginLeft: c===0 ? 0 : -1,
                      marginTop: r===0 ? 0 : -1,
                      background: bg,
                      color: (cell.open && cell.n>0) ? numColors[cell.n-1] : 'var(--ink)',
                      cursor: status==='won'||status==='lost' ? 'default' : 'pointer',
                      userSelect:'none',
                    }}>
                    {content}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>

        <div style={{
          marginTop:14, fontFamily:'var(--mono)', fontSize:12,
          color:'var(--ink-faint)', letterSpacing:'.05em',
        }}>
          {status === 'won'  && '✨ 胜利！所有非雷格都翻开了。'}
          {status === 'lost' && '💥 踩雷了。点「重新开始」再来一局。'}
          {status === 'idle' && '点一个格子开始游戏。'}
          {status === 'playing' && `${cfg.rows}×${cfg.cols} · ${cfg.mines} 雷`}
        </div>

        <section style={{marginTop:36}}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:12,
          }}>
            <h3 style={{margin:0, fontFamily:'var(--mono)', fontSize:13, letterSpacing:'.1em'}}>
              战绩 · STATS
            </h3>
            {confirmReset ? (
              <div style={{display:'flex', gap:6, fontFamily:'var(--mono)', fontSize:12}}>
                <span style={{color:'var(--ink-soft)', alignSelf:'center'}}>确认清除？</span>
                <button onClick={resetStats} style={{
                  fontFamily:'var(--mono)', fontSize:12, cursor:'pointer',
                  padding:'4px 10px', borderRadius:4,
                  border:'1px solid #dc2626', background:'#dc2626', color:'#fff',
                }}>清除</button>
                <button onClick={()=>setConfirmReset(false)} style={{
                  fontFamily:'var(--mono)', fontSize:12, cursor:'pointer',
                  padding:'4px 10px', borderRadius:4,
                  border:'1px solid var(--rule-strong)', background:'transparent', color:'var(--ink-soft)',
                }}>取消</button>
              </div>
            ) : (
              <button onClick={()=>setConfirmReset(true)} style={{
                fontFamily:'var(--mono)', fontSize:12, cursor:'pointer',
                padding:'4px 10px', borderRadius:4,
                border:'1px solid var(--rule-strong)', background:'transparent', color:'var(--ink-soft)',
              }}>重置数据</button>
            )}
          </div>

          <table style={{
            width:'100%', borderCollapse:'collapse',
            fontFamily:'var(--mono)', fontSize:12.5,
          }}>
            <thead>
              <tr style={{color:'var(--ink-faint)', letterSpacing:'.1em', textAlign:'left'}}>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500}}>难度</th>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500, textAlign:'right'}}>场次</th>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500, textAlign:'right'}}>胜场</th>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500, textAlign:'right'}}>胜率</th>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500, textAlign:'right'}}>最佳时间</th>
                <th style={{padding:'6px 8px', borderBottom:'1px solid var(--rule-strong)', fontWeight:500, textAlign:'right'}}>总用时</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MS_LEVELS).map(([k, v]) => {
                const s = stats[k];
                const rate = s.plays ? (s.wins/s.plays*100).toFixed(1)+'%' : '—';
                const best = s.bestTime==null ? '—' : s.bestTime+'s';
                const total = s.totalTime>=60
                  ? Math.floor(s.totalTime/60)+'m '+(s.totalTime%60)+'s'
                  : s.totalTime+'s';
                return (
                  <tr key={k} style={{color:'var(--ink-soft)'}}>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)'}}>{v.label}</td>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)', textAlign:'right'}}>{s.plays}</td>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)', textAlign:'right'}}>{s.wins}</td>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)', textAlign:'right'}}>{rate}</td>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)', textAlign:'right', color:s.bestTime!=null?'var(--ink)':'var(--ink-faint)'}}>{best}</td>
                    <td style={{padding:'8px', borderBottom:'1px solid var(--rule)', textAlign:'right'}}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{marginTop:10, fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-faint)'}}>
            提示：数据保存在浏览器本地 (localStorage) · 清除浏览器数据会一并清掉
          </div>
        </section>
      </article>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
