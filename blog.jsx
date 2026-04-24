// 亚の博客 — 入口：路由、数据加载、编辑模式桥接
// 其它模块（按 index.html 中的 <script> 顺序加载）：
//   src/markdown.jsx   — 解析/渲染原语，React hooks 解构在这里
//   src/chrome.jsx     — 顶栏、页脚、Tweak 面板
//   src/pages.jsx      — Home / Post / Archive / About
//   src/minesweeper.jsx — 扫雷

function parseHashRoute(){
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('post/'))       return { name:'post', id: h.slice(5) };
  if (h.startsWith('collection/')) return { name:'collection', id: h.slice(11) };
  if (h === 'archive')     return { name:'archive' };
  if (h === 'about')       return { name:'about' };
  if (h === 'minesweeper') return { name:'minesweeper' };
  return { name: 'home' };
}

const FONTS = {
  serif: '"Source Serif 4","Noto Serif SC",Georgia,serif',
  sans:  '"Noto Sans SC",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif',
  mono:  '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace',
};
const DENSITY_PX = { dense: 15, comfortable: 17, loose: 19 };

function App(){
  const [data, setData] = useState(null);
  const [postCache, setPostCache] = useState({});
  const [loadError, setLoadError] = useState(null);

  const [route, setRoute] = useState(parseHashRoute);
  const [tweaks, setTweaks] = useState(window.__TWEAKS__);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // 初次加载：index + 所有文章 + about
  useEffect(()=>{
    (async () => {
      try {
        const idx = await loadJson('./archive/index.json');
        const [postTexts, aboutText] = await Promise.all([
          Promise.all(idx.posts.map(id => loadText(`./archive/posts/${id}.md`))),
          loadText('./archive/pages/about.md'),
        ]);
        const posts = idx.posts.map((id, i) => ({ id, ...parsePost(postTexts[i]) }));
        const cache = {};
        for (const p of posts) cache[p.id] = p;

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
            home_visible: !!p.home_visible,
          })),
        });
      } catch (e){
        setLoadError(e.message);
      }
    })();
  }, []);

  // URL 同步 + 回到页首
  useEffect(()=>{
    const hash = route.name === 'post' ? `#/post/${route.id}`
               : route.name === 'collection' ? `#/collection/${route.id}`
               : route.name === 'home' ? '#/'
               : `#/${route.name}`;
    history.replaceState(null, '', hash);
    window.scrollTo(0, 0);
  }, [route]);

  // 浏览器前进/后退
  useEffect(()=>{
    const onPop = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
  }, []);

  // 应用主题/字体/密度/栏宽
  useEffect(()=>{
    document.body.dataset.theme = tweaks.theme;
    const root = document.documentElement.style;
    root.setProperty('--colw', tweaks.columnWidth + 'px');
    root.setProperty('--body-font', FONTS[tweaks.bodyFont] || FONTS.serif);
    root.setProperty('--title-font', tweaks.bodyFont === 'mono' ? FONTS.mono : FONTS.serif);
    document.body.style.fontSize = (DENSITY_PX[tweaks.density] || 17) + 'px';
  }, [tweaks]);

  // 编辑模式握手
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
      window.parent.postMessage({type:'__edit_mode_set_keys', edits: patch}, '*');
      return {...t, ...patch};
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
      {route.name === 'home'        && <Home posts={posts} site={site} content={home} setRoute={setRoute} collections={collections} />}
      {route.name === 'post'        && <Post posts={posts} site={site} post={postCache[route.id]} setRoute={setRoute} showToc={tweaks.showToc} collections={collections} />}
      {route.name === 'archive'     && <Archive posts={posts} content={archivePage} setRoute={setRoute} collections={collections} />}
      {route.name === 'collection'  && <Collection posts={posts} collections={collections} collectionId={route.id} setRoute={setRoute} />}
      {route.name === 'about'       && <About content={aboutPage} />}
      {route.name === 'minesweeper' && <Minesweeper setRoute={setRoute} />}
      <PageFoot site={site} setRoute={setRoute} />
      {editMode && (
        <TweakPanel open={panelOpen} close={()=>setPanelOpen(false)} tweaks={tweaks} update={updateTweak} fabClick={()=>setPanelOpen(o=>!o)} />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
