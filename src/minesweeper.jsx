// 亚の博客 — 扫雷小游戏

const MS_LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: '简单' },
  medium: { rows: 16, cols: 16, mines: 40, label: '中等' },
  hard:   { rows: 16, cols: 30, mines: 99, label: '困难' },
};
const MS_STATS_KEY = 'blog.minesweeper.stats.v1';
const MS_NUM_COLORS = ['#2563eb','#16a34a','#dc2626','#7c3aed','#b45309','#0891b2',null,'#6b7280'];

function msMakeBoard(rows, cols){
  const b = new Array(rows);
  for (let r = 0; r < rows; r++){
    const row = new Array(cols);
    for (let c = 0; c < cols; c++){
      row[c] = { mine:false, open:false, flag:false, n:0 };
    }
    b[r] = row;
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

// 返回这次打开的新格子数，由调用方累计
function msFlood(board, rows, cols, r, c){
  const stack = [[r,c]];
  let opened = 0;
  while (stack.length){
    const [cr, cc] = stack.pop();
    const cell = board[cr][cc];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true;
    opened++;
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
  return opened;
}

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

function Minesweeper({setRoute}){
  const [level, setLevel] = useState('easy');
  const cfg = MS_LEVELS[level];
  const [board, setBoard] = useState(() => msMakeBoard(cfg.rows, cfg.cols));
  const [seeded, setSeeded] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | playing | won | lost
  const [flags, setFlags] = useState(0);
  const [opened, setOpened] = useState(0);
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
    setOpened(0);
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
    let startedAt = startAt;
    if (!seeded){
      msPlantMines(b, cfg.rows, cfg.cols, cfg.mines, r, c);
      startedAt = Date.now();
      setSeeded(true);
      setStartAt(startedAt);
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
      recordGame(level, false, Math.floor((Date.now()-startedAt)/1000));
      return;
    }
    const added = msFlood(b, cfg.rows, cfg.cols, r, c);
    const newOpened = opened + added;
    setBoard(b);
    setOpened(newOpened);
    if (newOpened === cfg.rows*cfg.cols - cfg.mines){
      setStatus('won');
      recordGame(level, true, Math.floor((Date.now()-startedAt)/1000));
    }
  };

  const onFlag = (e, r, c) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    const cell = board[r][c];
    if (cell.open) return;
    // 只克隆被点的那一行，其他行共享引用
    const newRow = board[r].map((cc, j) => j===c ? {...cc, flag: !cc.flag} : cc);
    const newBoard = board.map((row, i) => i===r ? newRow : row);
    setBoard(newBoard);
    setFlags(f => f + (newRow[c].flag ? 1 : -1));
  };

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

        <div style={{maxWidth:'100%', overflowX:'auto', WebkitOverflowScrolling:'touch'}}>
          <div style={{
            display:'inline-block', padding:8,
            border:'1px solid var(--rule-strong)', borderRadius:4,
            background:'var(--ms-board)',
          }}>
            {board.map((row, r) => (
              <div key={r} style={{display:'flex'}}>
                {row.map((cell, c) => {
                  const open = cell.open;
                  const bg = open
                    ? (cell.exploded ? '#fecaca' : 'var(--ms-cell-open)')
                    : 'var(--ms-cell-up)';
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
                        color: (cell.open && cell.n>0) ? (MS_NUM_COLORS[cell.n-1] ?? 'var(--ink)') : 'var(--ink)',
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
