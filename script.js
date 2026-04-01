// ===================== NAVIGATION =====================
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item=>{
    if(item.getAttribute('onclick')&&item.getAttribute('onclick').includes("'"+id+"'"))
      item.classList.add('active');
  });
  if(window.innerWidth<=900) document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0,0);
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}

// ===================== CPU SCHEDULING =====================
let cpuProcesses=[], cpuCount=0;

function cpuAlgoChange(){
  const a=document.getElementById('cpu-algo').value;
  document.getElementById('quantum-group').style.display=a==='rr'?'flex':'none';
  const ph=document.getElementById('prio-col-head');
  if(ph) ph.style.display=a.includes('priority')?'block':'none';
  renderCPUProcesses();
}

function addCPUProcess(){
  cpuCount++;
  cpuProcesses.push({id:cpuCount,arrival:0,burst:1,priority:1});
  renderCPUProcesses();
}

function removeCPUProcess(id){
  cpuProcesses=cpuProcesses.filter(p=>p.id!==id);
  renderCPUProcesses();
}

function renderCPUProcesses(){
  const a=document.getElementById('cpu-algo').value;
  const showP=a.includes('priority');
  const ph=document.getElementById('prio-col-head');
  if(ph) ph.style.display=showP?'block':'none';
  const c=document.getElementById('cpu-processes');
  c.innerHTML='';
  cpuProcesses.forEach(p=>{
    const row=document.createElement('div');
    row.className='proc-input-row';
    row.innerHTML=`<div class="proc-label">P${p.id}</div>
      <input type="number" value="${p.arrival}" min="0" style="flex:1;min-width:50px;" oninput="updCPU(${p.id},'arrival',this.value)">
      <input type="number" value="${p.burst}" min="1" style="flex:1;min-width:50px;" oninput="updCPU(${p.id},'burst',this.value)">
      ${showP?`<input type="number" value="${p.priority}" min="1" style="flex:1;min-width:50px;" oninput="updCPU(${p.id},'priority',this.value)">`:'<div style="flex:1"></div>'}
      <button class="remove-btn" onclick="removeCPUProcess(${p.id})">✕</button>`;
    c.appendChild(row);
  });
}

function updCPU(id,f,v){const p=cpuProcesses.find(x=>x.id===id);if(p)p[f]=parseInt(v)||0;}

function resetCPU(){
  cpuProcesses=[];cpuCount=0;
  document.getElementById('cpu-results').style.display='none';
  const defs=[[0,5,3],[1,3,1],[2,8,4],[3,6,2],[4,2,5]];
  defs.forEach(d=>{cpuCount++;cpuProcesses.push({id:cpuCount,arrival:d[0],burst:d[1],priority:d[2]});});
  renderCPUProcesses();
}

function runCPU(){
  if(!cpuProcesses.length){alert('Add at least one process.');return;}
  const a=document.getElementById('cpu-algo').value;
  const q=parseInt(document.getElementById('cpu-quantum').value)||2;
  const ps=cpuProcesses.map(p=>({
    id:p.id,name:'P'+p.id,
    arrival:Math.max(0,parseInt(p.arrival)||0),
    burst:Math.max(1,parseInt(p.burst)||1),
    priority:parseInt(p.priority)||1,
    completion:0,response:-1
  }));
  let gantt=[];
  if(a==='fcfs') gantt=fcfs(ps);
  else if(a==='sjf') gantt=sjf(ps);
  else if(a==='srtf') gantt=srtf(ps);
  else if(a==='rr') gantt=rr(ps,q);
  else if(a==='priority_np') gantt=priNP(ps);
  else if(a==='priority_p') gantt=priP(ps);
  ps.forEach(p=>{p.turnaround=p.completion-p.arrival;p.waiting=p.turnaround-p.burst;});
  showCPU(ps,gantt);
}

function fcfs(ps){
  const sorted=[...ps].sort((a,b)=>a.arrival-b.arrival||a.id-b.id);
  let t=0;const g=[];
  sorted.forEach(p=>{
    if(t<p.arrival)t=p.arrival;
    if(p.response===-1)p.response=t-p.arrival;
    g.push({name:p.name,start:t,end:t+p.burst,ci:(p.id-1)%8});
    t+=p.burst;p.completion=t;
  });
  return mergeG(g);
}

function sjf(ps){
  const done=new Set();let t=0;const g=[];
  const n=ps.length;
  while(done.size<n){
    const av=ps.filter(p=>p.arrival<=t&&!done.has(p.id));
    if(!av.length){t++;continue;}
    const sel=av.reduce((a,b)=>a.burst<b.burst?a:a.burst===b.burst?(a.arrival<b.arrival?a:b):b);
    if(sel.response===-1)sel.response=t-sel.arrival;
    g.push({name:sel.name,start:t,end:t+sel.burst,ci:(sel.id-1)%8});
    t+=sel.burst;sel.completion=t;done.add(sel.id);
  }
  return mergeG(g);
}

function srtf(ps){
  const work=ps.map(p=>({...p,rem:p.burst}));
  let t=0;const g=[];let done=0;
  const limit=ps.reduce((s,p)=>s+p.burst,0)+Math.max(...ps.map(p=>p.arrival))+5;
  while(done<ps.length&&t<=limit){
    const av=work.filter(p=>p.arrival<=t&&p.rem>0);
    if(!av.length){t++;continue;}
    const sel=av.reduce((a,b)=>a.rem<b.rem?a:a.rem===b.rem?(a.arrival<b.arrival?a:b):b);
    const orig=ps.find(p=>p.id===sel.id);
    if(sel.response===-1){sel.response=t-sel.arrival;orig.response=sel.response;}
    g.push({name:sel.name,start:t,end:t+1,ci:(sel.id-1)%8});
    sel.rem--;t++;
    if(sel.rem===0){orig.completion=t;done++;}
  }
  return mergeG(g);
}

function rr(ps,q){
  const work=ps.map(p=>({...p,rem:p.burst})).sort((a,b)=>a.arrival-b.arrival);
  const queue=[];const enq=new Set();
  let t=0;const g=[];let done=0;
  let ai=0;
  while(ai<work.length&&work[ai].arrival<=t){queue.push(work[ai]);enq.add(work[ai].id);ai++;}
  let safety=0;
  while(done<ps.length&&safety<100000){
    safety++;
    if(!queue.length){
      if(ai<work.length){t=work[ai].arrival;while(ai<work.length&&work[ai].arrival<=t){if(!enq.has(work[ai].id)){queue.push(work[ai]);enq.add(work[ai].id);}ai++;}}
      else break;
    }
    const cur=queue.shift();
    const orig=ps.find(p=>p.id===cur.id);
    if(cur.response===-1){cur.response=t-cur.arrival;orig.response=cur.response;}
    const exec=Math.min(cur.rem,q);
    g.push({name:cur.name,start:t,end:t+exec,ci:(cur.id-1)%8});
    t+=exec;cur.rem-=exec;
    while(ai<work.length&&work[ai].arrival<=t){if(!enq.has(work[ai].id)){queue.push(work[ai]);enq.add(work[ai].id);}ai++;}
    if(cur.rem>0)queue.push(cur);
    else{orig.completion=t;done++;}
  }
  return mergeG(g);
}

function priNP(ps){
  const done=new Set();let t=0;const g=[];
  while(done.size<ps.length){
    const av=ps.filter(p=>p.arrival<=t&&!done.has(p.id));
    if(!av.length){t++;continue;}
    const sel=av.reduce((a,b)=>a.priority<b.priority?a:a.priority===b.priority?(a.arrival<b.arrival?a:b):b);
    if(sel.response===-1)sel.response=t-sel.arrival;
    g.push({name:sel.name,start:t,end:t+sel.burst,ci:(sel.id-1)%8});
    t+=sel.burst;sel.completion=t;done.add(sel.id);
  }
  return mergeG(g);
}

function priP(ps){
  const work=ps.map(p=>({...p,rem:p.burst}));
  let t=0;const g=[];let done=0;
  const limit=ps.reduce((s,p)=>s+p.burst,0)+Math.max(...ps.map(p=>p.arrival))+5;
  while(done<ps.length&&t<=limit){
    const av=work.filter(p=>p.arrival<=t&&p.rem>0);
    if(!av.length){t++;continue;}
    const sel=av.reduce((a,b)=>a.priority<b.priority?a:a.priority===b.priority?(a.arrival<b.arrival?a:b):b);
    const orig=ps.find(p=>p.id===sel.id);
    if(sel.response===-1){sel.response=t-sel.arrival;orig.response=sel.response;}
    g.push({name:sel.name,start:t,end:t+1,ci:(sel.id-1)%8});
    sel.rem--;t++;
    if(sel.rem===0){orig.completion=t;done++;}
  }
  return mergeG(g);
}

function mergeG(g){
  if(!g.length)return[];
  const m=[{...g[0]}];
  for(let i=1;i<g.length;i++){
    const l=m[m.length-1];
    if(l.name===g[i].name&&l.end===g[i].start)l.end=g[i].end;
    else m.push({...g[i]});
  }
  return m;
}

const COLORS=['#e8a825','#f06060','#4ed88a','#6090ff','#3de8c8','#c97ff8','#fb923c','#f5c842'];
const DARK_TEXT=[0,2,4,7];

function showCPU(ps,gantt){
  document.getElementById('cpu-results').style.display='block';
  const n=ps.length;
  const avgWT=(ps.reduce((s,p)=>s+p.waiting,0)/n).toFixed(2);
  const avgTAT=(ps.reduce((s,p)=>s+p.turnaround,0)/n).toFixed(2);
  const avgRT=(ps.reduce((s,p)=>s+(p.response>=0?p.response:0),0)/n).toFixed(2);
  document.getElementById('cpu-avg-results').innerHTML=`
    <div class="result-card"><div class="val">${avgWT}</div><div class="lbl">Avg Wait</div></div>
    <div class="result-card"><div class="val">${avgTAT}</div><div class="lbl">Avg Turnaround</div></div>
    <div class="result-card"><div class="val">${avgRT}</div><div class="lbl">Avg Response</div></div>
    <div class="result-card"><div class="val">${n}</div><div class="lbl">Processes</div></div>`;

  const chart=document.getElementById('gantt-chart');
  chart.innerHTML='';
  gantt.forEach(b=>{
    const d=document.createElement('div');
    d.className='gantt-block';
    d.style.cssText=`background:${COLORS[b.ci]};flex:${b.end-b.start};min-width:${Math.max(40,(b.end-b.start)*8)}px`;
    const tc=DARK_TEXT.includes(b.ci)?'#0b0e1a':'#fff';
    d.innerHTML=`<span class="proc-name" style="color:${tc}">${b.name}</span><span class="proc-time" style="color:${tc}">${b.start}-${b.end}</span>`;
    chart.appendChild(d);
  });

  const tl=document.getElementById('gantt-timeline');
  tl.innerHTML='';
  const times=[...new Set([...gantt.map(b=>b.start),gantt.length?gantt[gantt.length-1].end:0])].sort((a,b)=>a-b);
  times.forEach(t=>{const s=document.createElement('span');s.className='gantt-tick';s.textContent=t;tl.appendChild(s);});

  const tbody=document.getElementById('cpu-result-body');
  tbody.innerHTML='';
  [...ps].sort((a,b)=>a.id-b.id).forEach((p,i)=>{
    const c=COLORS[(p.id-1)%8];
    tbody.innerHTML+=`<tr>
      <td><span class="badge" style="background:${c}18;color:${c};border:1px solid ${c}40">P${p.id}</span></td>
      <td>${p.arrival}</td><td>${p.burst}</td><td>${p.completion}</td>
      <td>${p.turnaround}</td><td>${p.waiting}</td><td>${p.response}</td></tr>`;
  });
}

// ===================== BANKER'S ALGORITHM =====================
function initBanker(){
  const n=parseInt(document.getElementById('banker-procs').value)||5;
  const r=parseInt(document.getElementById('banker-res').value)||3;
  if(n<1||n>10||r<1||r>6){alert('Invalid config.');return;}
  document.getElementById('banker-tables').style.display='block';
  document.getElementById('banker-result').style.display='none';
  const rl=Array.from({length:r},(_,i)=>String.fromCharCode(65+i));
  ['alloc-col-labels','max-col-labels'].forEach(id=>{
    document.getElementById(id).innerHTML=rl.map(l=>`<div class="col-label">${l}</div>`).join('');
  });
  ['alloc','max'].forEach(t=>{
    const el=document.getElementById(t+'-matrix');
    el.innerHTML='';
    for(let i=0;i<n;i++){
      const row=document.createElement('div');row.className='matrix-row';
      row.innerHTML=`<div class="matrix-label">P${i}</div>`+rl.map((_,j)=>`<input class="matrix-cell" id="${t}-${i}-${j}" type="number" value="0" min="0">`).join('');
      el.appendChild(row);
    }
  });
  const av=document.getElementById('available-inputs');
  av.innerHTML=rl.map((l,j)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div class="col-label">${l}</div><input class="matrix-cell" id="avail-${j}" type="number" value="0" min="0"></div>`).join('');
}

function loadBankerExample(){
  document.getElementById('banker-procs').value=5;
  document.getElementById('banker-res').value=3;
  initBanker();
  const al=[[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
  const mx=[[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
  const av=[3,3,2];
  al.forEach((row,i)=>row.forEach((v,j)=>document.getElementById(`alloc-${i}-${j}`).value=v));
  mx.forEach((row,i)=>row.forEach((v,j)=>document.getElementById(`max-${i}-${j}`).value=v));
  av.forEach((v,j)=>document.getElementById(`avail-${j}`).value=v);
}

function runBanker(){
  const n=parseInt(document.getElementById('banker-procs').value);
  const r=parseInt(document.getElementById('banker-res').value);
  const alloc=[],max=[],need=[];
  for(let i=0;i<n;i++){
    alloc.push(Array.from({length:r},(_,j)=>parseInt(document.getElementById(`alloc-${i}-${j}`).value)||0));
    max.push(Array.from({length:r},(_,j)=>parseInt(document.getElementById(`max-${i}-${j}`).value)||0));
    need.push(max[i].map((v,j)=>v-alloc[i][j]));
  }
  for(let i=0;i<n;i++)for(let j=0;j<r;j++)if(need[i][j]<0){
    document.getElementById('banker-result').style.display='block';
    document.getElementById('banker-result-content').innerHTML=`<div class="alert alert-error">Error: P${i} Allocation exceeds Maximum for resource ${String.fromCharCode(65+j)}.</div>`;
    document.getElementById('banker-detail-body').innerHTML='';return;
  }
  const avail=Array.from({length:r},(_,j)=>parseInt(document.getElementById(`avail-${j}`).value)||0);
  const work=[...avail],finish=Array(n).fill(false),seq=[],stepAv=[];
  let progress=true;
  while(progress){progress=false;
    for(let i=0;i<n;i++){
      if(!finish[i]&&need[i].every((v,j)=>v<=work[j])){
        for(let j=0;j<r;j++)work[j]+=alloc[i][j];
        finish[i]=true;seq.push(i);stepAv.push([...work]);progress=true;
      }
    }
  }
  const safe=finish.every(f=>f);
  document.getElementById('banker-result').style.display='block';
  let html=safe?`<div class="alert alert-success">System is in a SAFE STATE.</div><div class="safe-sequence">
    ${seq.map((p,i)=>`<div class="safe-seq-item">P${p}</div>${i<seq.length-1?'<div class="safe-arrow">→</div>':''}`).join('')}
  </div>`:`<div class="alert alert-error">UNSAFE STATE — Deadlock may occur. Unfinished: ${finish.map((f,i)=>f?null:'P'+i).filter(Boolean).join(', ')}</div>`;
  document.getElementById('banker-result-content').innerHTML=html;
  const tbody=document.getElementById('banker-detail-body');
  tbody.innerHTML='';
  (safe?seq:Array.from({length:n},(_,i)=>i)).forEach((pi,step)=>{
    tbody.innerHTML+=`<tr>
      <td><span class="badge" style="background:var(--plate);border:1px solid var(--wire);color:var(--amber3)">P${pi}</span></td>
      <td>${alloc[pi].join(' | ')}</td>
      <td>${max[pi].join(' | ')}</td>
      <td>${need[pi].join(' | ')}</td>
      <td>${safe?stepAv[step].join(' | '):'—'}</td></tr>`;
  });
}

// ===================== PAGE REPLACEMENT =====================
function runPageReplacement(){
  const ref=document.getElementById('pr-refstr').value.trim().split(/\s+/).map(Number).filter(n=>!isNaN(n)&&n>=0);
  const frames=parseInt(document.getElementById('pr-frames').value)||3;
  const algo=document.getElementById('pr-algo').value;
  if(!ref.length){alert('Enter a valid reference string.');return;}
  if(frames<1){alert('Frames must be >= 1');return;}
  let result;
  if(algo==='fifo') result=prFIFO(ref,frames);
  else if(algo==='lru') result=prLRU(ref,frames);
  else result=prOptimal(ref,frames);
  showPR(result,ref,frames);
}

function prFIFO(ref,nf){
  const frames=Array(nf).fill(-1);const q=[];let faults=0,hits=0;const steps=[];
  ref.forEach(page=>{
    const hit=frames.includes(page);
    let newlyLoaded=-1;
    if(!hit){
      faults++;
      if(frames.includes(-1)){const idx=frames.indexOf(-1);frames[idx]=page;newlyLoaded=idx;}
      else{const evict=frames.indexOf(q.shift());frames[evict]=page;newlyLoaded=evict;}
      q.push(page);
    }else hits++;
    steps.push({page,frames:[...frames],fault:!hit,newIdx:newlyLoaded});
  });
  return{steps,faults,hits};
}

function prLRU(ref,nf){
  const frames=Array(nf).fill(-1);let faults=0,hits=0;const steps=[];
  const recent=[];
  ref.forEach(page=>{
    const hit=frames.includes(page);
    let newlyLoaded=-1;
    if(!hit){
      faults++;
      if(frames.includes(-1)){const idx=frames.indexOf(-1);frames[idx]=page;newlyLoaded=idx;}
      else{
        let lruP=null,lruT=Infinity;
        frames.forEach(f=>{const t=recent.lastIndexOf(f);if(t<lruT){lruT=t;lruP=f;}});
        const idx=frames.indexOf(lruP);frames[idx]=page;newlyLoaded=idx;
      }
    }else hits++;
    const ri=recent.indexOf(page);if(ri!==-1)recent.splice(ri,1);
    recent.push(page);
    steps.push({page,frames:[...frames],fault:!hit,newIdx:newlyLoaded});
  });
  return{steps,faults,hits};
}

function prOptimal(ref,nf){
  const frames=Array(nf).fill(-1);let faults=0,hits=0;const steps=[];
  ref.forEach((page,idx)=>{
    const hit=frames.includes(page);
    let newlyLoaded=-1;
    if(!hit){
      faults++;
      if(frames.includes(-1)){const i=frames.indexOf(-1);frames[i]=page;newlyLoaded=i;}
      else{
        const future=frames.map(f=>{const nx=ref.indexOf(f,idx+1);return nx===-1?Infinity:nx;});
        const evict=future.indexOf(Math.max(...future));frames[evict]=page;newlyLoaded=evict;
      }
    }else hits++;
    steps.push({page,frames:[...frames],fault:!hit,newIdx:newlyLoaded});
  });
  return{steps,faults,hits};
}

function showPR(result,ref,nf){
  document.getElementById('pr-results').style.display='block';
  const ratio=((result.hits/ref.length)*100).toFixed(1);
  document.getElementById('pr-summary').innerHTML=`
    <div class="result-card"><div class="val">${result.faults}</div><div class="lbl">Page Faults</div></div>
    <div class="result-card"><div class="val">${result.hits}</div><div class="lbl">Page Hits</div></div>
    <div class="result-card"><div class="val">${ratio}%</div><div class="lbl">Hit Ratio</div></div>
    <div class="result-card"><div class="val">${ref.length}</div><div class="lbl">References</div></div>`;
  const hdr=document.getElementById('pr-header-frames');
  hdr.innerHTML='';
  for(let i=0;i<nf;i++){
    const d=document.createElement('div');
    d.style.cssText='width:34px;height:18px;display:flex;align-items:center;justify-content:center;font-family:"IBM Plex Mono",monospace;font-size:8px;color:var(--txt3);letter-spacing:1px;';
    d.textContent='F'+(i+1);hdr.appendChild(d);
  }
  const steps=document.getElementById('pr-steps');
  steps.innerHTML='';
  result.steps.forEach(step=>{
    const row=document.createElement('div');row.className='pr-step-row';
    let fh='';
    step.frames.forEach((f,fi)=>{
      const empty=f===-1;
      const isNew=step.fault&&fi===step.newIdx;
      fh+=`<div class="pr-frame-cell${empty?' empty':isNew?' new-fault':''}">${empty?'—':f}</div>`;
    });
    row.innerHTML=`<div class="ref">${step.page}</div><div class="pr-frames">${fh}</div><div class="pr-status ${step.fault?'fault':'hit'}">${step.fault?'FAULT':'HIT'}</div>`;
    steps.appendChild(row);
  });
}

// ===================== MEMORY ALLOCATION =====================
let memBlocks=[],memProcs=[],mbc=0,mpc=0;

function addMemBlock(){mbc++;memBlocks.push({id:mbc,size:100});renderMB();}
function removeMemBlock(id){memBlocks=memBlocks.filter(b=>b.id!==id);renderMB();}
function renderMB(){
  const el=document.getElementById('mem-block-rows');el.innerHTML='';
  memBlocks.forEach(b=>{
    const r=document.createElement('div');r.className='proc-input-row';
    r.innerHTML=`<div class="proc-label" style="color:var(--txt3);width:52px;">B${b.id}</div>
      <input type="number" value="${b.size}" min="1" style="flex:1;" oninput="updMB(${b.id},this.value)">
      <button class="remove-btn" onclick="removeMemBlock(${b.id})">✕</button>`;
    el.appendChild(r);
  });
}
function updMB(id,v){const b=memBlocks.find(x=>x.id===id);if(b)b.size=parseInt(v)||1;}

function addMemProc(){mpc++;memProcs.push({id:mpc,size:50});renderMP();}
function removeMemProc(id){memProcs=memProcs.filter(p=>p.id!==id);renderMP();}
function renderMP(){
  const el=document.getElementById('mem-proc-rows');el.innerHTML='';
  memProcs.forEach(p=>{
    const r=document.createElement('div');r.className='proc-input-row';
    r.innerHTML=`<div class="proc-label">P${p.id}</div>
      <input type="number" value="${p.size}" min="1" style="flex:1;" oninput="updMP(${p.id},this.value)">
      <button class="remove-btn" onclick="removeMemProc(${p.id})">✕</button>`;
    el.appendChild(r);
  });
}
function updMP(id,v){const p=memProcs.find(x=>x.id===id);if(p)p.size=parseInt(v)||1;}

function resetMemory(){
  memBlocks=[];memProcs=[];mbc=0;mpc=0;
  document.getElementById('mem-results').style.display='none';
  [200,400,100,300,600].forEach(s=>{mbc++;memBlocks.push({id:mbc,size:s});});
  [212,417,112,426].forEach(s=>{mpc++;memProcs.push({id:mpc,size:s});});
  renderMB();renderMP();
}

function runMemory(){
  if(!memBlocks.length||!memProcs.length){alert('Add blocks and processes.');return;}
  const algo=document.getElementById('mem-algo').value;
  const blocks=memBlocks.map(b=>({...b,free:b.size,assigned:null}));
  const results=[];let nfi=0;
  memProcs.forEach(proc=>{
    let ai=-1;
    if(algo==='first'){for(let i=0;i<blocks.length;i++){if(blocks[i].free>=proc.size){ai=i;break;}}}
    else if(algo==='best'){let b=Infinity;blocks.forEach((bl,i)=>{if(bl.free>=proc.size&&bl.free-proc.size<b){b=bl.free-proc.size;ai=i;}});}
    else if(algo==='worst'){let w=-1;blocks.forEach((bl,i)=>{if(bl.free>=proc.size&&bl.free>w){w=bl.free;ai=i;}});}
    else if(algo==='next'){for(let i=0;i<blocks.length;i++){const idx=(nfi+i)%blocks.length;if(blocks[idx].free>=proc.size){ai=idx;nfi=(idx+1)%blocks.length;break;}}}
    if(ai!==-1){const frag=blocks[ai].free-proc.size;results.push({proc,blockId:blocks[ai].id,blockSize:blocks[ai].size,frag,allocated:true});blocks[ai].free-=proc.size;blocks[ai].assigned=proc.id;}
    else results.push({proc,allocated:false});
  });
  showMem(results,blocks);
}

function showMem(results,blocks){
  document.getElementById('mem-results').style.display='block';
  const vis=document.getElementById('mem-visual');vis.innerHTML='';
  blocks.forEach(b=>{
    const d=document.createElement('div');d.className='mem-block';d.style.flex=b.size;
    const r=results.find(r=>r.allocated&&r.blockId===b.id);
    if(r){
      d.style.background=COLORS[(r.proc.id-1)%8];d.style.color='#0b0e1a';
      d.innerHTML=`<div style="font-size:10px;font-weight:700;">P${r.proc.id}</div><div style="font-size:8px;opacity:.8">${b.size}K</div>`;
    }else{d.className+=' mem-free';d.innerHTML=`<div>Free</div><div style="font-size:8px;">${b.free}K</div>`;}
    vis.appendChild(d);
  });
  const tbody=document.getElementById('mem-result-body');tbody.innerHTML='';
  let tf=0,al=0;
  results.forEach(r=>{
    const c=COLORS[(r.proc.id-1)%8];
    if(r.allocated){tf+=r.frag;al++;}
    tbody.innerHTML+=`<tr>
      <td><span class="badge" style="background:${r.allocated?c+'18':'rgba(240,96,96,0.08)'};color:${r.allocated?c:'#f06060'};border:1px solid ${r.allocated?c+'40':'rgba(240,96,96,0.25)'}">P${r.proc.id}</span></td>
      <td>${r.proc.size} KB</td><td>${r.allocated?'B'+r.blockId:'—'}</td>
      <td>${r.allocated?r.blockSize+' KB':'—'}</td><td>${r.allocated?r.frag+' KB':'—'}</td>
      <td>${r.allocated?`<span class="badge" style="background:rgba(78,216,138,0.08);color:#4ed88a;border:1px solid rgba(78,216,138,0.25)">Allocated</span>`:`<span class="badge" style="background:rgba(240,96,96,0.08);color:#f06060;border:1px solid rgba(240,96,96,0.25)">Not Allocated</span>`}</td></tr>`;
  });
  document.getElementById('mem-frag-summary').innerHTML=`<div class="results-grid">
    <div class="result-card"><div class="val">${al}</div><div class="lbl">Allocated</div></div>
    <div class="result-card"><div class="val">${results.length-al}</div><div class="lbl">Not Allocated</div></div>
    <div class="result-card"><div class="val">${tf} KB</div><div class="lbl">Internal Frag</div></div></div>`;
}

// ===================== DISK SCHEDULING =====================
function diskAlgoChange(){
  const a=document.getElementById('disk-algo').value;
  document.getElementById('disk-dir-group').style.display=['scan','cscan','look','clook'].includes(a)?'flex':'none';
}

function runDisk(){
  const qi=document.getElementById('disk-queue').value.trim().split(/\s+/).map(Number).filter(n=>!isNaN(n)&&n>=0);
  const head=parseInt(document.getElementById('disk-head').value)||0;
  const size=parseInt(document.getElementById('disk-size').value)||200;
  const algo=document.getElementById('disk-algo').value;
  const dir=document.getElementById('disk-dir').value;
  if(!qi.length){alert('Enter a valid disk queue.');return;}
  let seq=[];
  if(algo==='fcfs') seq=[...qi];
  else if(algo==='sstf') seq=dkSSTF(qi,head);
  else if(algo==='scan') seq=dkSCAN(qi,head,size,dir);
  else if(algo==='cscan') seq=dkCSCAN(qi,head,size,dir);
  else if(algo==='look') seq=dkLOOK(qi,head,dir);
  else if(algo==='clook') seq=dkCLOOK(qi,head,dir);
  const full=[head,...seq];
  const total=full.reduce((s,t,i)=>i===0?0:s+Math.abs(t-full[i-1]),0);
  showDisk(full,total,size);
}

function dkSSTF(q,h){
  const r=[...q];const s=[];let cur=h;
  while(r.length){
    let mi=Infinity,mx=-1;
    r.forEach((t,i)=>{const d=Math.abs(t-cur);if(d<mi){mi=d;mx=i;}});
    cur=r[mx];s.push(cur);r.splice(mx,1);
  }return s;
}
function dkSCAN(q,h,sz,dir){
  const s=q.slice().sort((a,b)=>a-b);const seq=[];
  if(dir==='up'){
    s.filter(t=>t>=h).forEach(t=>seq.push(t));seq.push(sz-1);
    s.filter(t=>t<h).reverse().forEach(t=>seq.push(t));
  }else{
    s.filter(t=>t<=h).reverse().forEach(t=>seq.push(t));seq.push(0);
    s.filter(t=>t>h).forEach(t=>seq.push(t));
  }return seq;
}
function dkCSCAN(q,h,sz,dir){
  const s=q.slice().sort((a,b)=>a-b);const seq=[];
  if(dir==='up'){
    s.filter(t=>t>=h).forEach(t=>seq.push(t));seq.push(sz-1);seq.push(0);
    s.filter(t=>t<h).forEach(t=>seq.push(t));
  }else{
    s.filter(t=>t<=h).reverse().forEach(t=>seq.push(t));seq.push(0);seq.push(sz-1);
    s.filter(t=>t>h).reverse().forEach(t=>seq.push(t));
  }return seq;
}
function dkLOOK(q,h,dir){
  const s=q.slice().sort((a,b)=>a-b);const seq=[];
  if(dir==='up'){s.filter(t=>t>=h).forEach(t=>seq.push(t));s.filter(t=>t<h).reverse().forEach(t=>seq.push(t));}
  else{s.filter(t=>t<=h).reverse().forEach(t=>seq.push(t));s.filter(t=>t>h).forEach(t=>seq.push(t));}
  return seq;
}
function dkCLOOK(q,h,dir){
  const s=q.slice().sort((a,b)=>a-b);const seq=[];
  if(dir==='up'){s.filter(t=>t>=h).forEach(t=>seq.push(t));s.filter(t=>t<h).forEach(t=>seq.push(t));}
  else{s.filter(t=>t<=h).reverse().forEach(t=>seq.push(t));s.filter(t=>t>h).reverse().forEach(t=>seq.push(t));}
  return seq;
}

function showDisk(seq,total,diskSize){
  document.getElementById('disk-results').style.display='block';
  const avg=(total/(seq.length-1)).toFixed(2);
  document.getElementById('disk-stats').innerHTML=`
    <div class="seek-stat"><div class="val">${total}</div><div class="lbl">Total Seek</div></div>
    <div class="seek-stat"><div class="val">${avg}</div><div class="lbl">Avg Seek</div></div>
    <div class="seek-stat"><div class="val">${seq.length-1}</div><div class="lbl">Requests</div></div>
    <div class="seek-stat"><div class="val">${seq[0]}</div><div class="lbl">Start Head</div></div>`;

  // Build seek sequence with distance annotations
  let seqHtml='';
  seq.forEach((t,i)=>{
    const dist=i>0?Math.abs(t-seq[i-1]):0;
    const isHead=i===0;
    seqHtml+=`<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;margin-right:2px;">`;
    seqHtml+=`<span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:${isHead?'#f06060':'#e8c060'};padding:4px 10px;border:1px solid ${isHead?'rgba(240,96,96,0.3)':'rgba(232,168,37,0.2)'};background:${isHead?'rgba(240,96,96,0.07)':'rgba(232,168,37,0.05)'};">${t}</span>`;
    if(i<seq.length-1) seqHtml+=`<span style="font-size:9px;color:#504e44;font-family:'IBM Plex Mono',monospace;">→${dist}</span>`;
    seqHtml+=`</span>`;
  });
  document.getElementById('disk-sequence').innerHTML=seqHtml;
  drawDisk(seq,diskSize);
}

function drawDisk(seq,diskSize){
  // ── College-style disk scheduling graph ──
  // X-axis = cylinder/track number (0 to diskSize)
  // Y-axis = time steps (0 at top, increases downward)
  // The zigzag path shows disk arm movement as taught in textbooks
  const canvas=document.getElementById('disk-canvas');
  const wrap=canvas.parentElement;
  const n=seq.length;

  // Dynamic height: each step needs ~48px of vertical space, minimum 380
  const rowH=52;
  const PT=36,PB=52,PL=72,PR=28;
  const H=Math.max(380, PT+PB+(n-1)*rowH);
  const W=Math.max(500,wrap.clientWidth-40);
  canvas.width=W;canvas.height=H;

  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  // Background
  const bgGrad=ctx.createLinearGradient(0,0,0,H);
  bgGrad.addColorStop(0,'#12152a');bgGrad.addColorStop(1,'#0d1020');
  ctx.fillStyle=bgGrad;ctx.fillRect(0,0,W,H);

  const cw=W-PL-PR;
  const ch=H-PT-PB;

  // Helper: convert track number → canvas X
  const tx=t=>PL+(t/diskSize)*cw;
  // Helper: convert step index → canvas Y
  const sy=i=>PT+i*rowH;

  // ── Draw X-axis track tick marks ──
  const numTicks=10;
  for(let i=0;i<=numTicks;i++){
    const trackVal=Math.round((diskSize/numTicks)*i);
    const x=tx(trackVal);
    // Vertical grid line (full height)
    ctx.strokeStyle='rgba(45,51,82,0.55)';ctx.lineWidth=1;
    ctx.setLineDash([3,5]);
    ctx.beginPath();ctx.moveTo(x,PT);ctx.lineTo(x,PT+ch);ctx.stroke();
    ctx.setLineDash([]);
    // Tick on X axis (top)
    ctx.strokeStyle='rgba(80,78,68,0.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,PT-6);ctx.lineTo(x,PT);ctx.stroke();
    // Label on top
    ctx.fillStyle='#706e60';ctx.font='10px IBM Plex Mono, monospace';ctx.textAlign='center';
    ctx.fillText(trackVal,x,PT-12);
  }

  // ── Draw horizontal step lines (Y-axis rows) ──
  for(let i=0;i<n;i++){
    const y=sy(i);
    ctx.strokeStyle='rgba(45,51,82,0.3)';ctx.lineWidth=1;
    ctx.setLineDash([2,6]);
    ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(PL+cw,y);ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Y-axis step labels (left side) ──
  ctx.save();ctx.translate(16,PT+ch/2);ctx.rotate(-Math.PI/2);
  ctx.fillStyle='#504e44';ctx.font='bold 9px IBM Plex Mono, monospace';ctx.textAlign='center';
  ctx.letterSpacing='3px';ctx.fillText('TIME  →',0,0);ctx.restore();

  for(let i=0;i<n;i++){
    const y=sy(i);
    ctx.fillStyle=i===0?'#f06060':'#504e44';
    ctx.font=i===0?'bold 10px IBM Plex Mono, monospace':'9px IBM Plex Mono, monospace';
    ctx.textAlign='right';
    ctx.fillText(i===0?'Start':('t'+i),PL-10,y+4);
    // small tick
    ctx.strokeStyle='rgba(80,78,68,0.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(PL-4,y);ctx.lineTo(PL,y);ctx.stroke();
  }

  // ── X-axis label ──
  ctx.fillStyle='#504e44';ctx.font='bold 9px IBM Plex Mono, monospace';ctx.textAlign='center';
  ctx.fillText('CYLINDER  NUMBER  →',PL+cw/2,H-10);

  // ── Draw top axis bar ──
  ctx.strokeStyle='rgba(80,78,68,0.6)';ctx.lineWidth=1.5;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL+cw,PT);ctx.stroke();
  // ── Draw left axis bar ──
  ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,PT+ch);ctx.stroke();

  // ── Draw seek arrows between steps ──
  for(let i=0;i<n-1;i++){
    const x1=tx(seq[i]),y1=sy(i);
    const x2=tx(seq[i+1]),y2=sy(i+1);
    const isHead=(i===0);
    // Glow behind line
    ctx.save();
    ctx.shadowColor=isHead?'rgba(240,96,96,0.4)':'rgba(232,168,37,0.35)';
    ctx.shadowBlur=8;
    ctx.strokeStyle=isHead?'rgba(240,96,96,0.7)':'rgba(232,168,37,0.9)';
    ctx.lineWidth=isHead?2.5:2;
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.restore();

    // Arrowhead
    const angle=Math.atan2(y2-y1,x2-x1);
    const aLen=8;
    ctx.fillStyle=isHead?'#f06060':'#e8a825';
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-aLen*Math.cos(angle-0.4),y2-aLen*Math.sin(angle-0.4));
    ctx.lineTo(x2-aLen*Math.cos(angle+0.4),y2-aLen*Math.sin(angle+0.4));
    ctx.closePath();ctx.fill();

    // Seek distance label on the line midpoint
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    const dist=Math.abs(seq[i+1]-seq[i]);
    ctx.save();
    ctx.translate(mx,my);
    const labelAngle=Math.atan2(y2-y1,x2-x1);
    ctx.rotate(labelAngle);
    ctx.fillStyle='rgba(13,16,32,0.85)';
    const tw=ctx.measureText('+'+dist).width+8;
    ctx.fillRect(-tw/2,-10,tw,14);
    ctx.fillStyle=isHead?'#f08080':'#c8a040';
    ctx.font='bold 9px IBM Plex Mono, monospace';
    ctx.textAlign='center';ctx.fillText('+'+dist,0,2);
    ctx.restore();
  }

  // ── Draw points at each step ──
  seq.forEach((t,i)=>{
    const x=tx(t),y=sy(i);
    const isHead=(i===0);
    const color=isHead?'#f06060':'#e8a825';
    const r=isHead?7:5;

    // Outer glow ring
    ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);
    ctx.fillStyle=isHead?'rgba(240,96,96,0.12)':'rgba(232,168,37,0.1)';ctx.fill();

    // Circle
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
    ctx.strokeStyle='#0d1020';ctx.lineWidth=2;ctx.stroke();

    // Track value label above the dot
    const labelY=y-r-7;
    ctx.fillStyle='rgba(13,16,32,0.9)';
    const lw=ctx.measureText(t).width+10;
    ctx.fillRect(x-lw/2,labelY-12,lw,14);
    ctx.fillStyle=isHead?'#ff8888':i===seq.length-1?'#80d8c0':'#e8c060';
    ctx.font=`bold ${isHead?12:10}px IBM Plex Mono, monospace`;
    ctx.textAlign='center';
    ctx.fillText(t,x,labelY);

    // Step label inside dot
    if(i>0){
      ctx.fillStyle='#0d1020';
      ctx.font='bold 8px IBM Plex Mono, monospace';
      ctx.textAlign='center';
      ctx.fillText(i,x,y+3);
    }else{
      ctx.fillStyle='#0d1020';
      ctx.font='bold 7px IBM Plex Mono, monospace';
      ctx.textAlign='center';
      ctx.fillText('H',x,y+3);
    }
  });

  // ── Legend ──
  const lx=PL+cw-160,ly=PT+ch+28;
  ctx.fillStyle='#f06060';ctx.beginPath();ctx.arc(lx,ly,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#706e60';ctx.font='9px IBM Plex Mono, monospace';ctx.textAlign='left';
  ctx.fillText('Head (start)',lx+10,ly+3);
  ctx.fillStyle='#e8a825';ctx.beginPath();ctx.arc(lx+100,ly,5,0,Math.PI*2);ctx.fill();
  ctx.fillText('Request',lx+110,ly+3);
}

// ===================== INIT =====================
function init(){
  resetCPU();
  initBanker();loadBankerExample();
  resetMemory();
  const ph=document.getElementById('prio-col-head');
  if(ph)ph.style.display='none';
}
init();
