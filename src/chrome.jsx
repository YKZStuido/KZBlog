// 亚の博客 — 顶栏、页脚、右下角 Tweak 面板

function ThemeToggle({theme, onToggle}){
  const isDark = theme === 'charcoal' || theme === 'terminal';
  const label = isDark ? '切换到白天模式' : '切换到夜间模式';
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label={label} title={label}>
      <span className="theme-icon-wrap">
        {/* 太阳：白天显示 */}
        <svg className="theme-icon sun" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
          <line x1="12" y1="2.5" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="21.5"/>
          <line x1="2.5" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="21.5" y2="12"/>
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/>
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
        </svg>
        {/* 月亮：夜间显示 */}
        <svg className="theme-icon moon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 14.5A9 9 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>
        </svg>
      </span>
    </button>
  );
}

function TopBar({route, setRoute, editMode, togglePanel, theme, toggleColorMode}){
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
        <ThemeToggle theme={theme} onToggle={toggleColorMode}/>
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

function PageFoot({site, setRoute}){
  return (
    <footer className="pagefoot">
      <div>{site.footer}</div>
      <div style={{display:'flex', gap: 18}}>
        <a onClick={()=>setRoute({name:'home'})}>home</a>
        <a onClick={()=>setRoute({name:'archive'})}>archive</a>
        <a onClick={()=>setRoute({name:'about'})}>about</a>
        <a serf="https://github.com/YKZStuido">github</a>
      </div>
    </footer>
  );
}

const TWEAK_THEMES = [
  { id:'paper',    label:'纸张', bg:'#FAFAF7', ink:'#111311', accent:'oklch(62% 0.18 245)' },
  { id:'charcoal', label:'深色', bg:'#111311', ink:'#EDEBE3', accent:'oklch(72% 0.20 145)' },
  { id:'terminal', label:'终端', bg:'#0C0F0C', ink:'#CFE8CF', accent:'oklch(82% 0.17 140)' },
  { id:'journal',  label:'期刊', bg:'#F4EEE0', ink:'#2A1F14', accent:'oklch(55% 0.15 25)' },
];

function TweakPanel({open, close, tweaks, update, fabClick}){
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
            {TWEAK_THEMES.map(t=>(
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
