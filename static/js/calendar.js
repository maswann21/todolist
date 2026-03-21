const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

async function fetchMonthlySummary(year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const resp = await fetch(`/api/daily-pages?month=${monthStr}`);
  if (!resp.ok) return [];
  return resp.json();
}

function buildSummaryMap(summaries) {
  const map = {};
  for (const s of summaries) {
    map[s.date] = s;
  }
  return map;
}

async function renderCalendar(year, month) {
  const title = document.getElementById('monthTitle');
  title.textContent = `${year}년 ${month}월`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // Day labels row
  for (const label of DAY_LABELS) {
    const el = document.createElement('div');
    el.className = 'calendar-day-label';
    el.textContent = label;
    grid.appendChild(el);
  }

  const summaries = await fetchMonthlySummary(year, month);
  const summaryMap = buildSummaryMap(summaries);

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'calendar-cell empty';
    grid.appendChild(el);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'calendar-cell' + (dateStr === today ? ' today' : '');

    const dateEl = document.createElement('div');
    dateEl.className = 'cell-date';
    dateEl.textContent = d;
    el.appendChild(dateEl);

    const summary = summaryMap[dateStr];
    if (summary && summary.task_count > 0) {
      const statsEl = document.createElement('div');
      statsEl.className = 'cell-stats';
      statsEl.textContent = `${summary.done_count}/${summary.task_count} 완료`;
      el.appendChild(statsEl);
    }

    el.addEventListener('click', () => {
      window.location.href = `/day?date=${dateStr}`;
    });

    grid.appendChild(el);
  }
}

document.getElementById('prevBtn').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  renderCalendar(currentYear, currentMonth);
});

document.getElementById('nextBtn').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  renderCalendar(currentYear, currentMonth);
});

renderCalendar(currentYear, currentMonth);
