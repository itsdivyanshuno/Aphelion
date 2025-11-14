// MindWatch — basic frontend demo
// Data model stored in localStorage under key "mindwell_data"
// Each entry: {ts: <ISO>, mood: 0-4, stress: 0-100, sleep: hours, note: string}

const storageKey = 'mindwell_data_v1';

// ---------- Utilities ----------
function readData() {
  const raw = localStorage.getItem(storageKey);
  return raw ? JSON.parse(raw) : [];
}
function writeData(arr) {
  localStorage.setItem(storageKey, JSON.stringify(arr));
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

// ---------- Compute wellbeing score ----------
// Simple weighted formula (for demo):
// - mood: 0..4 -> normalized 0..100 (weight 0.5)
// - stress: 0..100 inverted -> (100 - stress) normalized (weight 0.3)
// - sleep: 0..12 hrs mapped to 0..100 (ideal 7-8) (weight 0.2)
//
// score = round( moodNorm*0.5 + stressInv*0.3 + sleepScore*0.2 )
function computeScore(entry) {
  const moodNorm = (entry.mood / 4) * 100; // 0..100
  const stressInv = (100 - entry.stress); // 0..100
  // sleep: ideal 7.5 => map 0..12 to 0..100 but peak at 7.5
  const s = clamp(entry.sleep, 0, 12);
  // apply gaussian-ish mapping: closeness to 7.5 yields higher
  const ideal = 7.5;
  const diff = Math.abs(s - ideal);
  const sleepScore = clamp(Math.round((1 - diff / 7.5) * 100), 0, 100);

  const score = Math.round(moodNorm * 0.5 + stressInv * 0.3 + sleepScore * 0.2);
  return clamp(score, 0, 100);
}

// ---------- UI Elements ----------
const pages = document.querySelectorAll('.page');
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> navigateTo(btn.dataset.target));
});
document.getElementById('startMonitoring').addEventListener('click', ()=> navigateTo('dashboard'));

// Check-in controls
const moodButtons = document.querySelectorAll('.mood');
const stressInput = document.getElementById('stressInput');
const stressVal = document.getElementById('stressVal');
const sleepInput = document.getElementById('sleepInput');
const noteInput = document.getElementById('noteInput');
const saveCheckinBtn = document.getElementById('saveCheckin');
const clearDataBtn = document.getElementById('clearData');

let selectedMood = null;

moodButtons.forEach(b=>{
  b.addEventListener('click', ()=> {
    moodButtons.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    selectedMood = Number(b.dataset.value);
  });
});
stressInput.addEventListener('input', ()=> stressVal.textContent = stressInput.value);

// actions
saveCheckinBtn.addEventListener('click', ()=>{
  const mood = (selectedMood === null) ? 2 : selectedMood; // default neutral
  const stress = Number(stressInput.value);
  const sleep = Number(sleepInput.value) || 0;
  const note = noteInput.value || '';
  const entry = { ts: new Date().toISOString(), mood, stress, sleep, note };
  const arr = readData();
  arr.push(entry);
  writeData(arr);
  // feedback + clear
  noteInput.value = '';
  alert('Check-in saved ✅');
  // update UI
  renderAll();
  navigateTo('dashboard');
});
clearDataBtn.addEventListener('click', ()=>{
  if(confirm('Clear all stored demo data? This cannot be undone.')) {
    localStorage.removeItem(storageKey);
    renderAll();
  }
});

// quick actions
document.getElementById('quickBreathe').addEventListener('click', ()=> alert('Take 10 slow breaths: inhale 4s — hold 4s — exhale 6s. Repeat 8 times.'));
document.getElementById('quickBreak').addEventListener('click', ()=> alert('Schedule a short break: stand, walk for 5 minutes, hydrate.'));

// ---------- Navigation ----------
function navigateTo(id) {
  pages.forEach(p=>p.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  // if dashboard or insights -> render charts
  if (id === 'dashboard') renderDashboard();
  if (id === 'insights') renderCharts();
}

// ---------- Charts ----------
let scoreCircle = null;
let moodChart = null, stressChart = null, sleepChart = null;

function initCharts() {
  // Score circle (simple donut)
  const ctx = document.getElementById('scoreCircle').getContext('2d');
  if (scoreCircle) scoreCircle.destroy();
  scoreCircle = new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: [0,100], backgroundColor: ['#0b66ff', '#eef4ff'], cutout: '80%' }] },
    options: { responsive: false, maintainAspectRatio: false, plugins: { legend:{display:false}, tooltip:{enabled:false} } }
  });

  // trend charts
  const mctx = document.getElementById('moodChart').getContext('2d');
  const sctx = document.getElementById('stressChart').getContext('2d');
  const sleepctx = document.getElementById('sleepChart').getContext('2d');

  if (moodChart) moodChart.destroy();
  if (stressChart) stressChart.destroy();
  if (sleepChart) sleepChart.destroy();

  moodChart = new Chart(mctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Mood (0-4)', data: [], tension:0.3, fill:true }] },
    options: { plugins:{legend:{display:false}}, scales:{y:{min:0,max:4}} }
  });

  stressChart = new Chart(sctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Stress (0-100)', data: [], tension:0.3, fill:true }] },
    options: { plugins:{legend:{display:false}}, scales:{y:{min:0,max:100}} }
  });

  sleepChart = new Chart(sleepctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Sleep hours', data: [], barPercentage:0.6 }] },
    options: { plugins:{legend:{display:false}}, scales:{y:{min:0,max:12}} }
  });
}
initCharts();

// ---------- Render functions ----------
function renderDashboard() {
  const data = readData();
  if (data.length === 0) {
    document.getElementById('scoreNumber').textContent = '—';
    document.getElementById('scoreLabel').textContent = 'No data yet';
    document.getElementById('recommendation').textContent = 'Do a check-in to see personalised tips.';
    document.getElementById('stressBadge').textContent = '—';
    document.getElementById('moodBadge').textContent = '—';
    document.getElementById('sleepBadge').textContent = '—';
    document.getElementById('deviationText').textContent = 'No behaviour data yet.';
    scoreCircle.data.datasets[0].data = [0,100];
    scoreCircle.update();
    return;
  }

  // latest entry
  const latest = data[data.length - 1];
  const score = computeScore(latest);
  const label = score >= 75 ? 'Good' : score >= 50 ? 'Moderate' : 'At-risk';

  document.getElementById('scoreNumber').textContent = score;
  document.getElementById('scoreLabel').textContent = label;
  document.getElementById('recommendation').textContent = generateRecommendation(latest, score);
  document.getElementById('stressBadge').textContent = `${latest.stress}`;
  document.getElementById('moodBadge').textContent = moodToText(latest.mood);
  document.getElementById('sleepBadge').textContent = `${latest.sleep} hrs`;

  scoreCircle.data.datasets[0].data = [score, 100 - score];
  scoreCircle.update();

  // deviation: compare last 7 entries average vs previous 7 entries average
  const last7 = data.slice(-7);
  const prev7 = data.slice(-14, -7);
  if (prev7.length === 0) {
    document.getElementById('deviationText').textContent = 'Not enough history to calculate deviation.';
  } else {
    const avgLast = avg(last7.map(e => e.mood));
    const avgPrev = avg(prev7.map(e => e.mood));
    const pct = ((avgLast - avgPrev) / (avgPrev || 1)) * 100;
    const sign = pct >= 0 ? '+' : '';
    document.getElementById('deviationText').textContent = `${sign}${pct.toFixed(0)}% mood change vs previous period.`;
  }
}

function renderCharts() {
  const data = readData();
  const labels = data.map(d => formatDateShort(d.ts));
  const moodVals = data.map(d => d.mood);
  const stressVals = data.map(d => d.stress);
  const sleepVals = data.map(d => d.sleep);

  moodChart.data.labels = labels;
  moodChart.data.datasets[0].data = moodVals;
  moodChart.update();

  stressChart.data.labels = labels;
  stressChart.data.datasets[0].data = stressVals;
  stressChart.update();

  sleepChart.data.labels = labels;
  sleepChart.data.datasets[0].data = sleepVals;
  sleepChart.update();
}

function renderAll(){
  initCharts();
  // if on dashboard or insights refresh
  const active = document.querySelector('.page.active')?.id;
  if (active === 'dashboard') renderDashboard();
  if (active === 'insights') renderCharts();
  // update checkin preview values
  const arr = readData();
  const latest = arr[arr.length - 1];
  if (latest) {
    selectedMood = latest.mood;
    // highlight summary but keep check-in controls untouched
  } else {
    selectedMood = null;
  }
}

// ---------- Helpers ----------
function moodToText(v){
  switch(v){
    case 4: return 'Great';
    case 3: return 'Good';
    case 2: return 'Okay';
    case 1: return 'Low';
    default: return 'Very low';
  }
}
function avg(arr){ if(!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }

function generateRecommendation(entry, score) {
  // Simple rules for demo
  if (!entry) return 'No data yet.';
  const tips = [];
  if (entry.stress >= 80) tips.push('High stress detected — try a grounding exercise and reach out to a friend.');
  if (entry.sleep < 6) tips.push('Short sleep recently — consider improving sleep hygiene tonight.');
  if (entry.mood <= 1) tips.push('Mood has been low — consider small activities you usually enjoy.');
  if (score < 50 && entry.stress < 80 && entry.sleep >= 6) tips.push('Score is low: try a short walk and breathing exercise.');
  if (tips.length === 0) tips.push('Keep up the good routine — maintain sleep and regular check-ins.');
  return tips[0];
}

// ---------- Initial render ----------
renderAll();
navigateTo('home');
