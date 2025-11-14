/* ============================================================
   MindWatch — App Logic (Clean Rebuild)
============================================================ */

/* ==========================
   GLOBAL ELEMENTS
========================== */
const pages = document.querySelectorAll(".page");
const navBtns = document.querySelectorAll(".side-btn");
const toast = document.getElementById("toast");

/* Check-in inputs */
let selectedMood = null;
const stressInput = document.getElementById("stressInput");
const stressVal = document.getElementById("stressVal");
const sleepInput = document.getElementById("sleepInput");
const noteInput = document.getElementById("noteInput");

/* DOM elements */
const streakNum = document.getElementById("streakNum");
const streakBig = document.getElementById("streakBig");
const streakText = document.getElementById("streakText");
const aiInsight = document.getElementById("aiInsight");

const scoreNum = document.getElementById("scoreNum");
const scoreLabel = document.getElementById("scoreLabel");
const latestMood = document.getElementById("latestMood");
const latestStress = document.getElementById("latestStress");
const latestSleep = document.getElementById("latestSleep");

/* Onboarding modal */
const onboardModal = document.getElementById("onboardModal");
const onboardOk = document.getElementById("onboardOk");

/* ==========================
   LOCAL STORAGE HANDLING
========================== */
const STORAGE_KEY = "mindwatch_data_v1";

function loadData() {
  const json = localStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ==========================
   NAVIGATION
========================== */
navBtns.forEach(btn =>
  btn.addEventListener("click", () => {
    navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.target;
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  })
);

/* ==========================
   TOAST
========================== */
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2000);
}

/* ==========================
   MOOD PICKER
========================== */
document.querySelectorAll(".mood").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mood").forEach(m => m.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMood = Number(btn.dataset.value);
  });
});

/* ==========================
   STRESS SLIDER UPDATE
========================== */
stressInput.addEventListener("input", () => {
  stressVal.textContent = stressInput.value;
});

/* ==========================
   SAVE CHECK-IN
========================== */
document.getElementById("saveBtn").addEventListener("click", () => {
  if (selectedMood === null) return showToast("Choose a mood first.");

  const entry = {
    ts: Date.now(),
    mood: selectedMood,
    stress: Number(stressInput.value),
    sleep: Number(sleepInput.value),
    note: noteInput.value.trim()
  };

  const data = loadData();
  data.push(entry);
  saveData(data);

  refreshUI();
  showToast("Check-in saved!");

  noteInput.value = "";
});

/* ==========================
   CLEAR DATA
========================== */
document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Clear all check-in data?")) {
    saveData([]);
    refreshUI();
    showToast("Data cleared.");
  }
});

document.getElementById("clearAll").addEventListener("click", () => {
  if (confirm("Clear local storage completely?")) {
    saveData([]);
    refreshUI();
    showToast("All data removed.");
  }
});

/* ==========================
   SCORE CALCULATION
========================== */
function computeScore(entry) {
  if (!entry) return 0;

  const moodScore = (entry.mood / 4) * 50;
  const stressScore = ((100 - entry.stress) / 100) * 35;
  const sleepNorm = Math.min(entry.sleep / 8, 1);
  const sleepScore = sleepNorm * 15;

  return Math.round(moodScore + stressScore + sleepScore);
}

/* ==========================
   STREAK CALCULATION
========================== */
function computeStreak(data) {
  if (data.length === 0) return 0;

  let streak = 1;
  let cur = new Date(data[data.length - 1].ts);

  for (let i = data.length - 2; i >= 0; i--) {
    const d = new Date(data[i].ts);
    const diff = Math.floor((cur - d) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      streak++;
      cur = d;
    } else break;
  }
  return streak;
}

/* ==========================
   INSIGHTS GENERATOR
========================== */
function generateInsight(data) {
  if (data.length < 3) return "Need more entries to generate insights.";

  const last = data[data.length - 1];
  const last3 = data.slice(-3);

  const avgMood = last3.reduce((a, b) => a + b.mood, 0) / 3;
  const avgStress = last3.reduce((a, b) => a + b.stress, 0) / 3;

  let msg = "";

  if (avgMood < 2) msg += "Your mood has been low lately. Consider rest or talking to someone. ";
  if (avgStress > 70) msg += "Stress has been high recently. Try breathing exercises or short breaks. ";
  if (last.sleep < 6) msg += "Recent sleep is low — consider adjusting bedtime. ";

  return msg || "You're maintaining a balanced trend. Keep it up!";
}

/* ==========================
   TREND CHARTS
========================== */
let trendChart, moodChart, stressChart;

function updateCharts(data) {
  const labels = data.map(e => new Date(e.ts).toLocaleDateString());
  const moods = data.map(e => e.mood);
  const stresses = data.map(e => e.stress);

  // Destroy previous charts to avoid duplicates
  if (trendChart) trendChart.destroy();
  if (moodChart) moodChart.destroy();
  if (stressChart) stressChart.destroy();

  trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Mood",
          data: moods,
          tension: 0.4
        },
        {
          label: "Stress",
          data: stresses,
          tension: 0.4
        }
      ]
    }
  });

  moodChart = new Chart(document.getElementById("moodChart"), {
    type: "line",
    data: { labels, datasets: [{ label: "Mood", data: moods }] }
  });

  stressChart = new Chart(document.getElementById("stressChart"), {
    type: "line",
    data: { labels, datasets: [{ label: "Stress", data: stresses }] }
  });
}

/* ==========================
   SCORE RING
========================== */
let scoreRing;

function updateScoreRing(score) {
  if (scoreRing) scoreRing.destroy();

  scoreRing = new Chart(document.getElementById("scoreRing"), {
    type: "doughnut",
    data: {
      labels: ["Score", "Remaining"],
      datasets: [
        {
          data: [score, 100 - score],
          borderWidth: 0
        }
      ]
    },
    options: {
      cutout: "70%"
    }
  });
}

/* ==========================
   MOOD CALENDAR
========================== */
function renderCalendar(data) {
  const cal = document.getElementById("moodCalendar");
  cal.innerHTML = "";

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toDateString();

    const entry = data.find(e => new Date(e.ts).toDateString() === ds);

    const div = document.createElement("div");
    div.classList.add("mood-day");

    if (!entry) {
      div.classList.add("mood-none");
      div.textContent = "-";
    } else if (entry.mood >= 3) {
      div.classList.add("mood-good");
      div.textContent = "😊";
    } else if (entry.mood === 2) {
      div.classList.add("mood-neutral");
      div.textContent = "😐";
    } else {
      div.classList.add("mood-low");
      div.textContent = "☹️";
    }

    cal.appendChild(div);
  }
}

/* ==========================
   CSV EXPORT
========================== */
document.getElementById("exportCsv").addEventListener("click", () => {
  const data = loadData();
  if (data.length === 0) return showToast("No data.");

  const header = "timestamp,mood,stress,sleep,note\n";
  const rows = data
    .map(e => `${e.ts},${e.mood},${e.stress},${e.sleep},"${e.note}"`)
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "mindwatch_export.csv";
  a.click();

  URL.revokeObjectURL(url);
});

/* ==========================
   NOTIFICATIONS
========================== */
document.getElementById("notifyBtn").addEventListener("click", async () => {
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    new Notification("MindWatch Reminder", {
      body: "Don't forget your daily check-in!"
    });
    showToast("Daily reminder enabled!");
  }
});

/* ==========================
   QUICK ACTIONS
========================== */
document.getElementById("quickBreathe").addEventListener("click", () => {
  showToast("Take a deep breath…");
});

document.getElementById("quickWalk").addEventListener("click", () => {
  showToast("Try a 5-minute walk!");
});

/* ==========================
   ONBOARDING MODAL
========================== */
if (!localStorage.getItem("mw_seen_onboarding")) {
  onboardModal.classList.remove("hidden");
}

onboardOk.addEventListener("click", () => {
  onboardModal.classList.add("hidden");
  localStorage.setItem("mw_seen_onboarding", "yes");
});

/* ==========================
   REFRESH UI
========================== */
function refreshUI() {
  const data = loadData();
  const last = data[data.length - 1];

  // Streak
  const streak = computeStreak(data);
  streakNum.textContent = streak;
  streakBig.textContent = streak;
  streakText.textContent = streak === 0 ? "Start tracking daily." : "Great consistency!";

  // Latest stats
  if (last) {
    latestMood.textContent = last.mood;
    latestStress.textContent = last.stress;
    latestSleep.textContent = last.sleep;

    const score = computeScore(last);
    scoreNum.textContent = score;
    scoreLabel.textContent = score > 70 ? "Good" : score > 40 ? "Fair" : "Low";
    updateScoreRing(score);
  } else {
    updateScoreRing(0);
  }

  // Insights
  aiInsight.textContent = generateInsight(data);

  // Charts + Calendar
  updateCharts(data);
  renderCalendar(data);
}

/* ==========================
   INIT
========================== */
refreshUI();
