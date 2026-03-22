/**
 * Charts — Handles Chart.js rendering for layer bar charts and radar chart.
 */
const Charts = (() => {
  let radarChart = null;
  let layerChart = null;

  function renderLayerChart(layer) {
    const ctx = document.getElementById('layer-chart');
    if (!ctx) return;

    if (layerChart) {
      layerChart.destroy();
      layerChart = null;
    }

    const displayMetrics = Object.entries(layer.metrics)
      .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'))
      .slice(0, 4);

    const labels = displayMetrics.map(([id]) => id);
    const values = displayMetrics.map(([, m]) => {
      const v = parseFloat(m.value);
      return isNaN(v) ? 50 : metricPct(m);
    });
    const colors = values.map(v => {
      if (v >= 60) return '#0D9488';
      if (v >= 35) return '#D97706';
      return '#BE3A4A';
    });

    layerChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + '33'),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(128,128,128,0.1)' },
            ticks: { font: { size: 10 }, color: '#94A3B8' },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#94A3B8' },
          },
        },
      },
    });
  }

  function metricPct(metric) {
    const v = parseFloat(metric.value);
    if (isNaN(v)) return 50;
    switch (metric.unit) {
      case 'ratio': case 'cos': case 'score': case 'ZPD': return Math.min(v * 100, 100);
      case 'bits': return Math.min(v / 12 * 100, 100);
      case '/9': return v / 9 * 100;
      case '/5': return v / 5 * 100;
      case 'tokens': return Math.min(v / 5 * 100, 100);
      case 'SD': return Math.min(v / 3 * 100, 100);
      default: return Math.min(v * 10, 100);
    }
  }

  function renderRadarChart(compositeScores) {
    const ctx = document.getElementById('radar-chart');
    if (!ctx) return;

    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }

    const factors = Object.values(compositeScores);
    const labels = factors.map(f => f.label);
    const data = factors.map(f => f.score);

    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Essay',
            data,
            fill: true,
            backgroundColor: 'rgba(13,148,136,0.15)',
            borderColor: 'rgba(13,148,136,0.8)',
            borderWidth: 1.5,
            pointBackgroundColor: 'rgba(13,148,136,0.8)',
            pointRadius: 3,
          },
          {
            label: 'Cohort avg',
            data: Array(labels.length).fill(70),
            fill: false,
            borderColor: 'rgba(150,150,150,0.4)',
            borderWidth: 1,
            borderDash: [4, 3],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 100,
            grid: { color: 'rgba(128,128,128,0.15)' },
            angleLines: { color: 'rgba(128,128,128,0.15)' },
            ticks: { display: false },
          },
        },
      },
    });
  }

  return { renderLayerChart, renderRadarChart };
})();
