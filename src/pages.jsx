// 亚の博客 — 首页、文章页、归档、关于

function Home({posts, site, content, setRoute, collections}){
  const [active, setActive] = useState('全部');
  const [activeCollection, setActiveCollection] = useState(null);
  const [q, setQ] = useState('');

  // 一次遍历：总阅读时长 + 标签计数 + 合集计数 + 搜索用小写索引
  const { allTags, tagCount, collectionCount, totalMinutes, searchIndex } = useMemo(()=>{
    const tc = new Map();
    const cc = new Map();
    let total = 0;
    const si = posts.map(p => (p.title + p.excerpt + p.tags.join(' ')).toLowerCase());
    for (const p of posts){
      total += p.read || 0;
      for (const t of (p.tags || [])) tc.set(t, (tc.get(t) || 0) + 1);
      if (p.collection) cc.set(p.collection, (cc.get(p.collection) || 0) + 1);
    }
    return {
      allTags: [...tc.keys()],
      tagCount: tc,
      collectionCount: cc,
      totalMinutes: total,
      searchIndex: si,
    };
  }, [posts]);

  const filtered = useMemo(()=>{
    const qLower = q.trim().toLowerCase();
    const out = [];
    for (let i = 0; i < posts.length; i++){
      const p = posts[i];
      if (active !== '全部' && !p.tags.includes(active)) continue;
      if (activeCollection && p.collection !== activeCollection) continue;
      // 合集文章默认不进首页列表；显式 home_visible 或激活合集筛选时才露出
      if (!activeCollection && p.collection && !p.home_visible) continue;
      if (qLower && !searchIndex[i].includes(qLower)) continue;
      out.push(p);
    }
    return out;
  }, [active, activeCollection, q, posts, searchIndex]);

  const featured = useMemo(() => posts.find(p => p.featured), [posts]);
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

        {collections && collections.length > 0 && (
          <section className="collections-strip">
            {collections.map(c => (
              <div key={c.id} className="collection-card"
                   onClick={()=>setRoute({name:'collection', id: c.id})}>
                <div className="kicker">合集 · {collectionCount.get(c.id) || 0} 篇</div>
                <h3>{c.title}</h3>
                {c.desc && <p>{c.desc}</p>}
                <div className="go">查看合集 →</div>
              </div>
            ))}
          </section>
        )}

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
                  {t} · {tagCount.get(t) || 0}
                </button>
              ))}
            </div>

            {collections && collections.length > 0 && (
              <>
                <h4>Collections</h4>
                <div className="tag-list">
                  {collections.map(c => (
                    <button key={c.id}
                      className={'tag' + (activeCollection === c.id ? ' on' : '')}
                      onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}>
                      {c.title} · {collectionCount.get(c.id) || 0}
                    </button>
                  ))}
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

function Post({posts, site, post, setRoute, showToc, collections}){
  const [activeSec, setActiveSec] = useState(undefined);
  const [progress, setProgress] = useState(0);

  useEffect(()=>{
    setActiveSec(post?.sections?.[0]?.id);
  }, [post?.id]);

  // 滚动监听：rAF 节流 + 缓存 section DOM 引用
  useEffect(()=>{
    if (!post) return;
    const sections = post.sections || [];
    if (!sections.length){
      setProgress(0);
      return;
    }
    const secEls = sections.map(s => document.getElementById(s.id)).filter(Boolean);
    const defaultId = sections[0]?.id;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY + 140;
      let cur = defaultId;
      for (const el of secEls){ if (el.offsetTop <= y) cur = el.id; }
      setActiveSec(cur);
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - h.clientHeight);
      setProgress(Math.round(h.scrollTop / max * 100));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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

  const wordCount = useMemo(()=>{
    if (!post) return 0;
    let n = post.lede?.length || 0;
    for (const b of (post.body || [])){
      if (b.type === 'p' || b.type === 'blockquote' || b.type === 'callout'){
        n += b.text?.length || 0;
      }
    }
    return n;
  }, [post?.id]);

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

function Collection({posts, collections, collectionId, setRoute}){
  const collection = useMemo(
    () => (collections || []).find(c => c.id === collectionId),
    [collections, collectionId]
  );

  const items = useMemo(() => {
    const list = posts.filter(p => p.collection === collectionId);
    list.sort((a, b) => {
      const an = a.collection_n ?? Infinity;
      const bn = b.collection_n ?? Infinity;
      if (an !== bn) return an - bn;
      return a.date.localeCompare(b.date);
    });
    return list;
  }, [posts, collectionId]);

  if (!collection){
    return (
      <main className="page">
        <header style={{padding:'40px 0 24px'}}>
          <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10}}>/collection</div>
          <h1 style={{margin:0, fontFamily:'var(--title-font)', fontWeight:500, fontSize:40, letterSpacing:'-0.02em'}}>合集不存在</h1>
          <p style={{color:'var(--ink-soft)', marginTop:10, fontSize:15}}>
            找不到 ID 为 <code>{collectionId}</code> 的合集。
            <a style={{marginLeft:8, color:'var(--accent)', cursor:'pointer'}} onClick={()=>setRoute({name:'archive'})}>返回归档 →</a>
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="page">
      <header style={{padding:'40px 0 24px', borderBottom:'1px solid var(--rule)'}}>
        <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10}}>/collection · {collection.id}</div>
        <h1 style={{margin:0, fontFamily:'var(--title-font)', fontWeight:500, fontSize:48, letterSpacing:'-0.02em'}}>{collection.title}</h1>
        <p style={{color:'var(--ink-soft)', marginTop:10, fontSize:16}}>
          {collection.desc ? collection.desc + ' · ' : ''}共 {items.length} 篇
        </p>
      </header>

      <section>
        {items.map(p => (
          <div key={p.id} className="archive-row" onClick={()=>setRoute({name:'post', id: p.id})}>
            <div className="ar-date" style={{fontVariantNumeric:'tabular-nums'}}>№ {p.num}</div>
            <div className="ar-title">{p.title}</div>
            <div className="ar-tags">{(p.tags || []).join(' / ')}</div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{padding:'60px 0', textAlign:'center', color:'var(--ink-faint)', fontFamily:'var(--mono)', fontSize:13}}>
            这个合集还没有文章。
          </div>
        )}
      </section>
    </main>
  );
}

function Archive({posts, content, setRoute, collections}){
  const byYear = useMemo(()=>{
    const m = new Map();
    for (const p of posts){
      const y = p.date.slice(0,4);
      const arr = m.get(y) || [];
      arr.push(p);
      m.set(y, arr);
    }
    return [...m.entries()].sort((a,b)=> b[0].localeCompare(a[0]));
  }, [posts]);

  const colById = useMemo(()=>{
    const m = new Map();
    for (const c of (collections || [])) m.set(c.id, c);
    return m;
  }, [collections]);

  const subtitle = content.subtitle.replace('{count}', posts.length);

  return (
    <main className="page">
      <header style={{padding:'40px 0 24px', borderBottom:'1px solid var(--rule)'}}>
        <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10}}>{content.kicker}</div>
        <h1 style={{margin:0, fontFamily:'var(--title-font)', fontWeight:500, fontSize:48, letterSpacing:'-0.02em'}}>{content.title}</h1>
        <p style={{color:'var(--ink-soft)', marginTop:10, fontSize:16}}>{subtitle}</p>
      </header>

      {byYear.map(([y, items])=>(
        <section key={y}>
          <div className="archive-year">
            <h2>{y}</h2>
            <span>{items.length} 篇</span>
          </div>
          {items.map(p=>{
            const col = p.collection ? colById.get(p.collection) : null;
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

function About({content}){
  const avatarIsImage = /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(content.card.avatar);
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
            {avatarIsImage
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
