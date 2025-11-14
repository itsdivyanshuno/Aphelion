/* MindWatch — Modern Dashboard Pro (Option A)
   - Stores data in localStorage under 'mindwell_data_v1'
   - Adds streak counter, mood calendar, AI insights, CSV export, notifications
*/

const STORAGE_KEY = 'mindwell_data_v1';

// ---------- Utilities ----------
function readData(){ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
function writeData(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function fmtDate(iso){ const d = new Date(iso); return d.toLocaleDateString(); }
function daysBetween(a,b){ return Math.floor((b - a) / (1000*60*60*24)); }

// ---------- Score formula ----------
function computeScore(entry){
  const moodNorm = (entry.mood / 4) * 100;
  const stressInv = (100 - entry.stress);
  const s = clamp(entry.sleep, 0, 12);
  const ideal = 7.5; const diff = Math.abs(s - ideal);
  const sleepScore = clamp(Math.round((1 - diff / 7.5) * 100), 0, 100);
  const score = Math.round(moodNorm * 0.5 + stressInv * 0.35 + sleepScore * 0.15);
  return clamp(score,0,100);
}

// ---------- Toast ----------
function toast(msg, ms=2500){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block'; t.style.opacity = 1;
  setTimeout(()=>{ t.style.transition='opacity 300ms'; t.style.opacity=0; setTimeout(()=>t.style.display='none',320); }, ms);
}

// ---------- Elements ----------
const pages = document.querySelectorAll('.page');
const sideBtns = document.querySelectorAll('.side-btn');
const navBtns = document.querySelectorAll('.side-btn');
const themeToggle = document.getElementById('themeToggle');
const notifyBtn = document.getElementById('notifyBtn');

// Checkin UI
const moodButtons = document.querySelectorAll('.mood');
const stressInput = document.getElementById('stressInput');
const stressVal = document.getElementById('stressVal');
const sleepInput = document.getElementById('sleepInput');
const noteInput = document.getElementById('noteInput');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');

// Dashboard UI
const scoreNum = document.getElementById('scoreNum');
const scoreLabel = document.getElementById('scoreLabel');
const latestMood = document.getElementById('latestMood');
const latestStress = document.getElementById('latestStress');
const latestSleep = document.getElementById('latestSleep');
const aiInsight = document.getElementById('aiInsight');
const streakNum = document.getElementById('streakNum');
const streakBig = document.getElementById('streakBig');

// Charts
let scoreRing = null, trendChart = null, moodChart = null, stressChart = null;

// ---------- Navigation ----------
sideBtns.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    sideBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    navigateTo(btn.dataset.target);
  });
});

function navigateTo(id){
  pages.forEach(p=>p.classList.remove('active'));
  const page = document.getElementById(id);
  if(page) page.classList.add('active');
  // render page-specific
  if(id === 'dashboard') renderDashboard();
  if(id === 'insights') renderCharts();
  if(id === 'calendar') renderCalendar();
}

// ---------- Theme toggle ----------
themeToggle && themeToggle.addEventListener('change', (e)=>{
  document.documentElement.style.setProperty('--bg', e.target.checked ? '#0b1220' : '#f5f8fb');
  document.body.classList.toggle('dark', e.target.checked);
});

// ---------- Notification ----------
notifyBtn.addEventListener('click', async ()=>{
  if(!('Notification' in window)){
    toast('Notifications not supported in this browser');
    return;
  }
  try{
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){
      toast('Daily reminder enabled (demo)');
      // schedule a quick demo notification in 5 sec (for the demo)
      setTimeout(()=> new Notification('MindWatch reminder', {body:'Don\'t forget your daily check-in!'}), 5000);
    } else {
      toast('Notifications disabled');
    }
  }catch(e){
    toast('Notification error');
  }
});

// ---------- Check-in logic ----------
let selectedMood = null;
moodButtons.forEach(b=>{
  b.addEventListener('click', ()=>{
    moodButtons.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    selectedMood = Number(b.dataset.value);
  });
});
stressInput && stressInput.addEventListener('input', ()=> stressVal.textContent = stressInput.value);

saveBtn.addEventListener('click', ()=>{
  const mood = (selectedMood === null) ? 2 : selectedMood;
  const stress = Number(stressInput.value);
  const sleep = Number(sleepInput.value) || 0;
  const note = noteInput.value || '';
  const entry = { ts: new Date().toISOString(), mood, stress, sleep, note };
  const arr = readData(); arr.push(entry); writeData(arr);
  toast('Check-in saved');
  noteInput.value = '';
  renderAll();
  navigateTo('dashboard');
});

clearBtn.addEventListener('click', ()=>{
  if(confirm('Clear all local demo data?')){ localStorage.removeItem(STORAGE_KEY); toast('Data cleared'); renderAll(); }
});

// ---------- Charts init ----------
function initCharts(){
  // score ring
  const ctx = document.getElementById('scoreRing').getContext('2d');
  if(scoreRing) scoreRing.destroy();
  scoreRing = new Chart(ctx, {
    type:'doughnut',
    data:{datasets:[{data:[0,100],backgroundColor:['#2563eb','#eef4ff'],cutout:'75%'}]},
    options:{responsive:false,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}
  });

  // trend chart
  const tctx = document.getElementById('trendChart').getContext('2d');
  if(trendChart) trendChart.destroy();
  trendChart = new Chart(tctx, {
    type:'line',
    data:{labels:[],datasets:[
      {label:'Mood',data:[],borderColor:'#10b981',tension:0.3,fill:false},
      {label:'Stress',data:[],borderColor:'#ef4444',tension:0.3,fill:false,yAxisID:'y1'}
    ]},
    options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:4},y1:{position:'right',min:0,max:100}}}
  });

  // insights charts
  const mctx = document.getElementById('moodChart').getContext('2d');
  const sctx = document.getElementById('stressChart').getContext('2d');

  if(moodChart) moodChart.destroy();
  moodChart = new Chart(mctx, {type:'line',data:{labels:[],datasets:[{data:[],borderColor:'#2563eb',tension:0.35,fill:true,backgroundColor:'rgba(37,99,235,0.06)'}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:4}}}});

  if(stressChart) stressChart.destroy();
  stressChart = new Chart(sctx, {type:'line',data:{labels:[],datasets:[{data:[],borderColor:'#06b6d4',tension:0.35,fill:true,backgroundColor:'rgba(6,182,212,0.06)'}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:100}}}});
}

initCharts();

// ---------- Render functions ----------
function renderDashboard(){
  const data = readData();
  if(data.length === 0){
    scoreNum.textContent='—'; scoreLabel.textContent='No data';
    latestMood.textContent='—'; latestStress.textContent='—'; latestSleep.textContent='—';
    aiInsight.textContent='No data yet. Do a check-in to receive personalised insights.';
    streakNum.textContent='0'; streakBig.textContent='0 days';
    scoreRing.data.datasets[0].data = [0,100]; scoreRing.update();
    trendChart.data.labels = []; trendChart.data.datasets[0].data = []; trendChart.data.datasets[1].data = []; trendChart.update();
    return;
  }

  const latest = data[data.length-1];
  const score = computeScore(latest);
  scoreNum.textContent = score;
  scoreLabel.textContent = score >= 75 ? 'Good' : score >= 50 ? 'Moderate' : 'At-risk';
  latestMood.textContent = moodToText(latest.mood);
  latestStress.textContent = latest.stress;
  latestSleep.textContent = `${latest.sleep} hrs`;
  aiInsight.textContent = generateAIInsight(data);

  // update ring
  scoreRing.data.datasets[0].data = [score, 100-score]; scoreRing.update();

  // trend: build last 14 entries
  const last = data.slice(-14);
  trendChart.data.labels = last.map(e=> (new Date(e.ts)).toLocaleDateString());
  trendChart.data.datasets[0].data = last.map(e=> e.mood);
  trendChart.data.datasets[1].data = last.map(e=> e.stress);
  trendChart.update();

  // streak
  const s = calcStreak(data);
  streakNum.textContent = s;
  streakBig.textContent = `${s} day${s!==1?'s':''}`;
}

function renderCharts(){
  const data = readData();
  const labels = data.map(e => (new Date(e.ts)).toLocaleDateString());
  moodChart.data.labels = labels; moodChart.data.datasets[0].data = data.map(e=> e.mood); moodChart.update();
  stressChart.data.labels = labels; stressChart.data.datasets[0].data = data.map(e=> e.stress); stressChart.update();
}

function renderCalendar(){
  const wrap = document.getElementById('moodCalendar');
  wrap.innerHTML = '';
  const data = readData();
  const days=30;
  const today = new Date(); today.setHours(0,0,0,0);
  for(let i=days-1;i>=0;i--){
    const d = new Date(today); d.setDate(today.getDate()-i);
    const iso = d.toISOString();
    const item = data.find(it => (new Date(it.ts)).toDateString() === d.toDateString());
    const div = document.createElement('div'); div.className='mood-day';
    if(!item){ div.classList.add('mood-none'); div.textContent = d.getDate(); }
    else {
      if(item.mood >= 3) div.classList.add('mood-good');
      else if(item.mood === 2) div.classList.add('mood-neutral');
      else div.classList.add('mood-low');
      div.textContent = item.mood >= 3 ? '😊' : item.mood ===2 ? '😐' : '☹️';
      div.title = `${d.toDateString()}\nMood: ${moodToText(item.mood)}\nStress: ${item.stress}\nSleep: ${item.sleep}h`;
    }
    wrap.appendChild(div);
  }
}

// ---------- Helpers ----------
function moodToText(v){ switch(v){ case 4: return 'Great'; case 3: return 'Good'; case 2: return 'Okay'; case 1: return 'Low'; default: return 'Very low'; } }

function calcStreak(data){
  if(!data.length) return 0;
  // group by day (unique days with at least one entry)
  const days = {};
  data.forEach(d => { const ds = new Date(d.ts); ds.setHours(0,0,0,0); days[ds.toDateString()] = true; });
  const dates = Object.keys(days).map(s => new Date(s)).sort((a,b)=>b-a); // descending
  let streak = 0;
  let cur = new Date(); cur.setHours(0,0,0,0);
  for(let i=0;i<dates.length;i++){
    const diff = daysBetween(dates[i], cur);
    if(diff === 0){ streak++; cur.setDate(cur.getDate()-1); }
    else if(diff > 0) break;
  }
  return streak;
}

// AI insight generator (rule-based summary)
function generateAIInsight(data){
  if(!data.length) return 'No data yet.';
  const last7 = data.slice(-7);
  const avgMood = (last7.reduce((s,e)=>s+e.mood,0)/last7.length).toFixed(2);
  const avgStress = (last7.reduce((s,e)=>s+e.stress,0)/last7.length).toFixed(0);
  const avgSleep = (last7.reduce((s,e)=>s+e.sleep,0)/last7.length).toFixed(1);
  let msg = `Last 7 days — mood avg ${avgMood}/4, stress avg ${avgStress}/100, sleep avg ${avgSleep}h. `;
  if(avgStress > 65) msg += 'Stress is high recently — try daily grounding exercises.';
  else if(avgMood < 2) msg += 'Mood is lower than normal — small enjoyable activities could help.';
  else msg += 'Overall stable — keep regular check-ins.';
  return msg;
}

// CSV export
document.getElementById('exportCsv').addEventListener('click', ()=>{
  const data = readData();
  if(!data.length){ toast('No data to export'); return; }
  const rows = [['timestamp','mood','stress','sleep','note']];
  data.forEach(d => rows.push([d.ts,d.mood,d.stress,d.sleep, `"${(d.note||'').replace(/"/g,'""')}"` ]));
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'mindwell_data.csv'; a.click(); URL.revokeObjectURL(url);
});

// clear all local data (button on insights panel)
document.getElementById('clearAll').addEventListener('click', ()=>{
  if(confirm('Clear all local demo data?')){ localStorage.removeItem(STORAGE_KEY); toast('Local data cleared'); renderAll(); }
});

// quick actions
document.getElementById('quickBreathe').addEventListener('click', ()=> toast('Breathing: inhale 4s — hold 4s — exhale 6s (repeat 5x)'));
document.getElementById('quickWalk').addEventListener('click', ()=> toast('Take a 5-minute walk — move a bit and hydrate'));

// ---------- Render all ----------
function renderAll(){
  initCharts();
  renderDashboard();
  renderCharts();
  renderCalendar();
  const s = calcStreak(readData());
  streakNum.textContent = s;
}

renderAll();

// ---------- small helpers ----------
function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
