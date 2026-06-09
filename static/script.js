let candidatesData = [];
let statsData = null;

// Tab switching
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + link.dataset.tab).classList.add('active');
  });
});

// Filter change events
document.getElementById('search-input')?.addEventListener('input', renderCandidates);
document.getElementById('role-filter')?.addEventListener('change', renderCandidates);
document.getElementById('fit-filter')?.addEventListener('change', renderCandidates);

// ---- API helpers ----
async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ---- Dashboard ----
async function loadDashboard() {
  statsData = await apiGet('/api/stats');

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card highlight">
      <div class="stat-value">${statsData.total_candidates}</div>
      <div class="stat-label">Total Candidates</div>
    </div>
    <div class="stat-card success">
      <div class="stat-value">${statsData.k_neighbors}</div>
      <div class="stat-label">K Neighbors</div>
    </div>
    <div class="stat-card warn">
      <div class="stat-value">${(statsData.accuracy * 100).toFixed(1)}%</div>
      <div class="stat-label">Model Accuracy</div>
    </div>
    <div class="stat-card highlight">
      <div class="stat-value">${Object.keys(statsData.job_roles).length}</div>
      <div class="stat-label">Job Roles</div>
    </div>
  `;

  renderBarChart('actual-chart', statsData.actual_fit_distribution, true);
  renderBarChart('predicted-chart', statsData.predicted_fit_distribution, true);
  renderRoleChart('role-chart', statsData.job_roles);
}

function renderBarChart(containerId, data, isFit) {
  const container = document.getElementById(containerId);
  const maxVal = Math.max(...Object.values(data), 1);
  const classMap = { Good: 'good', Average: 'average', Poor: 'poor' };
  container.innerHTML = Object.entries(data).length
    ? Object.entries(data).map(([k, v]) => {
        const pct = (v / maxVal) * 100;
        const cls = isFit ? (classMap[k] || '') : '';
        return `
          <div class="bar-row">
            <span class="bar-label">${k}</span>
            <div class="bar-track">
              <div class="bar-fill ${cls}" style="width:${Math.max(pct, 8)}%">${v}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<div style="color:#94a3b8;padding:20px 0">No data</div>';
}

function renderRoleChart(containerId, roles) {
  const container = document.getElementById(containerId);
  const vals = Object.values(roles);
  const maxVal = Math.max(...vals.map(r => r.count), 1);
  container.innerHTML = vals.map(r => {
    const pct = (r.count / maxVal) * 100;
    return `
      <div class="bar-row">
        <span class="bar-label">${r.name}</span>
        <div class="bar-track">
          <div class="bar-fill role" style="width:${Math.max(pct, 10)}%">${r.count}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Candidates ----
async function loadCandidates() {
  const data = await apiGet('/api/candidates');
  candidatesData = data.candidates;
  renderCandidates();
}

function getFilteredCandidates() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  const role = document.getElementById('role-filter').value;
  const fit = document.getElementById('fit-filter').value;
  return candidatesData.filter(c => {
    if (search && !c.Candidate_ID.toLowerCase().includes(search)) return false;
    if (role && String(c.Job_Role_Code) !== role) return false;
    if (fit && c.Predicted_Fit !== fit) return false;
    return true;
  });
}

function renderCandidates() {
  const filtered = getFilteredCandidates();
  document.getElementById('result-count').textContent = `${filtered.length} of ${candidatesData.length} candidates`;
  const tbody = document.getElementById('candidates-body');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:#94a3b8">No candidates found</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(c => {
    const actualBadge = badgeHtml(c.Job_Fit);
    const predBadge = badgeHtml(c.Predicted_Fit);
    return `<tr>
      <td><strong>${c.Candidate_ID}</strong></td>
      <td>${c.Years_of_Experience}</td>
      <td>${c.Skill_Match_Score}</td>
      <td>${c.Programming_Skill_Level}</td>
      <td>${c.Domain_Knowledge_Level}</td>
      <td>${c.Certifications_Count}</td>
      <td>${c.Coding_Test_Score}</td>
      <td>${c.Communication_Score}</td>
      <td>${c.Job_Role}</td>
      <td>${actualBadge}</td>
      <td>${predBadge}</td>
    </tr>`;
  }).join('');
}

function badgeHtml(fit) {
  const cls = fit === 'Good' ? 'badge-good' : fit === 'Average' ? 'badge-average' : 'badge-poor';
  return `<span class="badge ${cls}">${fit}</span>`;
}

// ---- Predictor ----
async function handlePredict() {
  const body = {
    years_experience: parseFloat(document.getElementById('p-exp').value) || 0,
    skill_match_score: parseInt(document.getElementById('p-skill').value) || 0,
    programming_level: parseInt(document.getElementById('p-prog').value) || 1,
    domain_knowledge: parseInt(document.getElementById('p-domain').value) || 1,
    certifications: parseInt(document.getElementById('p-certs').value) || 0,
    coding_test_score: parseInt(document.getElementById('p-code').value) || 0,
    communication_score: parseInt(document.getElementById('p-comm').value) || 1,
    job_role_code: parseInt(document.getElementById('p-role').value) || 1,
  };

  const result = await apiPost('/api/predict', body);
  const container = document.getElementById('predict-results');
  const classMap = { Good: 'good', Average: 'average', Poor: 'poor' };

  const probBars = Object.entries(result.probabilities).map(([k, v]) => {
    const pct = (v * 100).toFixed(1);
    return `
      <div class="prob-bar-row">
        <span class="bar-label">${k}</span>
        <div class="prob-track">
          <div class="prob-fill ${classMap[k]}" style="width:${Math.max(pct, 4)}%">${pct}%</div>
        </div>
      </div>
    `;
  }).join('');

  const neighborsRows = result.neighbors.map(n => {
    const nb = badgeHtml(n.job_fit);
    return `<tr><td>${n.candidate_id}</td><td>${n.distance.toFixed(4)}</td><td>${nb}</td></tr>`;
  }).join('');

  container.innerHTML = `
    <div class="prediction-main">
      <div class="prediction-label">Predicted Job Fit</div>
      <div class="prediction-value" style="color:${result.prediction === 'Good' ? '#16a34a' : result.prediction === 'Average' ? '#d97706' : '#dc2626'}">
        ${result.prediction}
      </div>
    </div>
    <div class="prob-section">
      <h4>Prediction Probabilities</h4>
      ${probBars}
    </div>
    <div class="neighbors-section">
      <h4>${result.neighbors.length} Nearest Neighbors</h4>
      <table class="neighbors-table">
        <thead><tr><th>Candidate</th><th>Distance</th><th>Job Fit</th></tr></thead>
        <tbody>${neighborsRows}</tbody>
      </table>
    </div>
  `;
}

document.getElementById('predict-btn')?.addEventListener('click', handlePredict);

// ---- Init ----
async function init() {
  await Promise.all([loadDashboard(), loadCandidates()]);
}

init();
