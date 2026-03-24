let categoryChart = null;
let completionChart = null;
let trendChart = null;

async function fetchAnalytics(range) {
  const [trend, ratio, completion] = await Promise.all([
    fetch(`/api/analytics/time-trend?range=${range}`).then(r => r.json()),
    fetch(`/api/analytics/category-ratio?range=${range}`).then(r => r.json()),
    fetch(`/api/analytics/completion-rate?range=${range}`).then(r => r.json()),
  ]);
  return { trend, ratio, completion };
}

function renderCategoryChart(ratioData) {
  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (!ratioData.length) {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 100);
    return;
  }

  const data = {
    labels: ratioData.map(d => d.category_name),
    datasets: [{
      data: ratioData.map(d => d.total_minutes),
      backgroundColor: ratioData.map(d => d.category_color),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  if (categoryChart) {
    categoryChart.data = data;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const mins = ctx.parsed;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return ` ${ctx.label}: ${h}h ${m}m`;
              }
            }
          }
        }
      }
    });
  }
}

function renderCompletionChart(completionData) {
  const ctx = document.getElementById('completionChart').getContext('2d');

  const STATUS_LABELS = { done: '✔ 완료', failed: '✖ 미완료', carry: '▲ 이월', pending: '— 미정' };
  const STATUS_COLORS = { done: '#22c55e', failed: '#ef4444', carry: '#f97316', pending: '#94a3b8' };

  if (!completionData.length) {
    if (completionChart) { completionChart.destroy(); completionChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 100);
    return;
  }

  const data = {
    labels: completionData.map(d => STATUS_LABELS[d.status] || d.status),
    datasets: [{
      data: completionData.map(d => d.count),
      backgroundColor: completionData.map(d => STATUS_COLORS[d.status] || '#94a3b8'),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  if (completionChart) {
    completionChart.data = data;
    completionChart.update();
  } else {
    completionChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}개 (${completionData[ctx.dataIndex]?.percentage}%)`
            }
          }
        }
      }
    });
  }
}

function renderTrendChart(trendData) {
  const ctx = document.getElementById('trendChart').getContext('2d');

  if (!trendData.length) {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 60);
    return;
  }

  const dates = [...new Set(trendData.map(d => d.date))].sort();
  const categoryNames = [...new Set(trendData.map(d => d.category_name))];
  const colorMap = {};
  for (const d of trendData) colorMap[d.category_name] = d.category_color;

  const datasets = categoryNames.map(name => {
    const dataMap = {};
    for (const d of trendData) {
      if (d.category_name === name) dataMap[d.date] = d.total_minutes;
    }
    return {
      label: name,
      data: dates.map(date => dataMap[date] || 0),
      backgroundColor: colorMap[name],
      stack: 'stack',
    };
  });

  const data = { labels: dates, datasets };

  if (trendChart) {
    trendChart.data = data;
    trendChart.update();
  } else {
    trendChart = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            title: { display: true, text: '분 (minutes)' },
          },
        },
        plugins: {
          legend: { position: 'top' },
        }
      }
    });
  }
}

async function loadDashboard(range) {
  try {
    const { trend, ratio, completion } = await fetchAnalytics(range);
    renderCategoryChart(ratio);
    renderCompletionChart(completion);
    renderTrendChart(trend);
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

document.getElementById('rangeSelect').addEventListener('change', (e) => {
  loadDashboard(e.target.value);
});

loadDashboard('week');
