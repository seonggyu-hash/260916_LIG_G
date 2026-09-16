/**
 * LIG DNA SMART KPI MANAGER - FRONTEND CONTROLLER
 * Full Reactive UI, Web Audio API Sound Effects, Real-time Filtering & Modal Management
 */

// State Management
const state = {
  kpis: [],
  filters: {
    status: 'all',
    kpi_status: 'all',
    kpi_type: 'all',
    department: 'all',
    q: '',
    sort: 'created_desc'
  },
  stats: {
    total: 0,
    completed: 0,
    pending: 0,
    avg_achievement_rate: 0,
    at_risk_count: 0,
    type_distribution: {}
  },
  isLoading: false,
  theme: localStorage.getItem('lig_theme') || 'dark'
};

// Sound Effect Synthesizer using Web Audio API (Zero external assets needed)
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playSuccessChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      // Dual tone pleasant chime
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5

      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.18); // C6

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.05);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (e) {
      // Audio might be blocked by browser autoplay policy until user gesture
    }
  }

  playPopSound() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }
}

const soundFX = new SoundFX();

// DOM Elements
const DOM = {
  // Theme & Clock
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  liveTime: document.getElementById('liveTime'),
  liveDate: document.getElementById('liveDate'),

  // KPI Dashboard
  kpiTotalCount: document.getElementById('kpiTotalCount'),
  kpiCompletedCount: document.getElementById('kpiCompletedCount'),
  kpiPendingCount: document.getElementById('kpiPendingCount'),
  kpiRateBadge: document.getElementById('kpiRateBadge'),
  kpiProgressBar: document.getElementById('kpiProgressBar'),
  kpiCriticalCount: document.getElementById('kpiCriticalCount'),
  countChallenge: document.getElementById('countChallenge'),
  countTrust: document.getElementById('countTrust'),
  countTech: document.getElementById('countTech'),
  countInnovation: document.getElementById('countInnovation'),

  // Filters & Actions
  taskSearchInput: document.getElementById('taskSearchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  statusTabs: document.getElementById('statusTabs'),
  filterPriority: document.getElementById('filterPriority'),
  filterDna: document.getElementById('filterDna'),
  filterCategory: document.getElementById('filterCategory'),
  sortBy: document.getElementById('sortBy'),
  clearCompletedBtn: document.getElementById('clearCompletedBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),

  // List & State
  taskItemsList: document.getElementById('taskItemsList'),
  activeListCount: document.getElementById('activeListCount'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),

  // Modals
  openNewModalBtn: document.getElementById('openNewModalBtn'),
  createModalBackdrop: document.getElementById('createModalBackdrop'),
  closeCreateModalBtn: document.getElementById('closeCreateModalBtn'),
  cancelCreateModalBtn: document.getElementById('cancelCreateModalBtn'),
  createTaskForm: document.getElementById('createTaskForm'),
  createDueDate: document.getElementById('createDueDate'),

  editModalBackdrop: document.getElementById('editModalBackdrop'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditModalBtn: document.getElementById('cancelEditModalBtn'),
  editTaskForm: document.getElementById('editTaskForm'),

  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  setupEventListeners();
  setDefaultDueDate();
  loadData();
});

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeButtonUI();
}

function updateThemeButtonUI() {
  if (state.theme === 'dark') {
    DOM.themeIcon.textContent = '☀️';
    DOM.themeToggleBtn.querySelector('.btn-text').textContent = '라이트 모드';
  } else {
    DOM.themeIcon.textContent = '🌙';
    DOM.themeToggleBtn.querySelector('.btn-text').textContent = '다크 모드';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('lig_theme', state.theme);
  updateThemeButtonUI();
  soundFX.playPopSound();
  showToast(`화면 모드가 ${state.theme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`, 'info');
}

function initClock() {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    DOM.liveTime.textContent = `${hours}:${minutes}:${seconds}`;

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    DOM.liveDate.textContent = `${year}.${month}.${date} (${dayNames[now.getDay()]})`;
  };

  updateClock();
  setInterval(updateClock, 1000);
}

function setDefaultDueDate() {
  const today = new Date().toISOString().split('T')[0];
  DOM.createDueDate.value = today;
}

/* ==========================================================================
   API Communication
   ========================================================================== */
async function loadData() {
  showLoading(true);
  try {
    await Promise.all([fetchKpis(), fetchStats()]);
  } catch (err) {
    console.error('Data load error:', err);
    showToast('데이터를 불러오는 중 문제가 발생했습니다.', 'error');
  } finally {
    showLoading(false);
  }
}

async function fetchKpis() {
  const params = new URLSearchParams({
    status: state.filters.status,
    kpi_status: state.filters.kpi_status,
    kpi_type: state.filters.kpi_type,
    department: state.filters.department,
    q: state.filters.q,
    sort: state.filters.sort
  });

  const res = await fetch(`/api/kpis?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch kpis');
  const kpis = await res.json();
  state.kpis = kpis;
  renderTasks();
}

async function fetchStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  const stats = await res.json();
  state.stats = stats;
  renderStats();
}

async function createKpi(payload) {
  const res = await fetch('/api/kpis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'KPI 등록에 실패했습니다.');
  }

  return await res.json();
}

async function updateKpi(id, payload) {
  const res = await fetch(`/api/kpis/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'KPI 수정에 실패했습니다.');
  }

  return await res.json();
}

async function toggleKpiStatus(id) {
  const res = await fetch(`/api/kpis/${id}/toggle`, {
    method: 'PATCH'
  });

  if (!res.ok) throw new Error('상태 변경에 실패했습니다.');
  return await res.json();
}

async function deleteKpiItem(id) {
  const res = await fetch(`/api/kpis/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('삭제에 실패했습니다.');
  return await res.json();
}

async function clearCompletedKpis() {
  const res = await fetch('/api/kpis/clear-completed', {
    method: 'POST'
  });

  if (!res.ok) throw new Error('완료 항목 정리에 실패했습니다.');
  return await res.json();
}

/* ==========================================================================
   Render UI Functions
   ========================================================================== */
function renderStats() {
  const { total, completed, pending, avg_achievement_rate, at_risk_count, type_distribution } = state.stats;

  DOM.kpiTotalCount.textContent = total;
  DOM.kpiCompletedCount.textContent = completed;
  DOM.kpiPendingCount.textContent = pending;
  DOM.kpiRateBadge.textContent = `${avg_achievement_rate}%`;
  DOM.kpiProgressBar.style.width = `${Math.min(avg_achievement_rate, 100)}%`;
  DOM.kpiCriticalCount.textContent = at_risk_count;

  // KPI 유형(BSC 4대 관점)별 분포
  DOM.countChallenge.textContent = type_distribution['재무'] || 0;
  DOM.countTrust.textContent = type_distribution['고객'] || 0;
  DOM.countTech.textContent = type_distribution['프로세스'] || 0;
  DOM.countInnovation.textContent = type_distribution['성장'] || 0;
}

// 상태값을 기존 우선순위 배지 색상 체계(critical/high/medium/low)에 매핑
function getStatusClass(status) {
  switch (status) {
    case '지연': return 'critical';
    case '보류': return 'high';
    case '완료': return 'low';
    case '진행중':
    default: return 'medium';
  }
}

function getStatusLabel(status) {
  const labels = {
    '지연': '🚨 지연',
    '보류': '⏸️ 보류',
    '진행중': '⚡ 진행중',
    '완료': '✅ 완료'
  };
  return labels[status] || status;
}

function renderTasks() {
  DOM.activeListCount.textContent = `(${state.kpis.length})`;

  if (state.kpis.length === 0) {
    DOM.taskItemsList.innerHTML = '';
    DOM.emptyState.style.display = 'flex';
    return;
  }

  DOM.emptyState.style.display = 'none';

  const todayStr = new Date().toISOString().split('T')[0];

  const html = state.kpis.map(kpi => {
    const isDone = kpi.status === '완료';

    // 종료일 계산
    let dueDateHtml = '';
    if (kpi.end_date) {
      let dateClass = '';
      let datePrefix = '📅 종료: ';
      if (kpi.end_date < todayStr && !isDone) {
        dateClass = 'overdue';
        datePrefix = '⚠️ 기한 초과: ';
      } else if (kpi.end_date === todayStr && !isDone) {
        dateClass = 'today';
        datePrefix = '🔥 오늘 마감: ';
      }
      dueDateHtml = `<span class="due-date-pill ${dateClass}">${datePrefix}${escapeHtml(kpi.end_date)}</span>`;
    }

    const periodHtml = kpi.start_date
      ? `<span class="due-date-pill">📆 ${escapeHtml(kpi.start_date)} ~ ${kpi.end_date ? escapeHtml(kpi.end_date) : '진행중'}</span>`
      : '';

    const ownerHtml = kpi.owner ? `<span class="created-at">👤 ${escapeHtml(kpi.owner)}</span>` : '';

    // 설명/메모 미리보기
    const descHtml = kpi.description ? `<div class="task-memo-preview">${escapeHtml(kpi.description)}</div>` : '';

    const rate = Math.max(0, kpi.achievement_rate || 0);
    const rateDisplay = `${kpi.current_value ?? 0}${kpi.unit ? ' ' + escapeHtml(kpi.unit) : ''} / ${kpi.target_value ?? 0}${kpi.unit ? ' ' + escapeHtml(kpi.unit) : ''} (${rate}%)`;

    return `
      <div class="task-card ${isDone ? 'completed' : ''}" data-id="${kpi.id}" data-priority="${getStatusClass(kpi.status)}">
        <div class="task-checkbox-wrap">
          <button type="button" class="task-custom-checkbox" onclick="handleToggleTask(${kpi.id})" title="${isDone ? '완료 취소' : 'KPI 완료 처리'}">
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>

        <div class="task-body">
          <div class="task-meta-top">
            <span class="badge badge-dna" data-tag="${escapeHtml(kpi.kpi_type)}">${getKpiTypeIcon(kpi.kpi_type)} ${escapeHtml(kpi.kpi_type)}</span>
            <span class="badge badge-category">${escapeHtml(kpi.department)}</span>
            <span class="badge badge-priority ${getStatusClass(kpi.status)}">${getStatusLabel(kpi.status)}</span>
          </div>

          <div class="task-title-text">${escapeHtml(kpi.name)}</div>
          ${descHtml}

          <div class="kpi-progress-wrapper" title="${rateDisplay}">
            <div class="kpi-progress-bar" style="width: ${Math.min(rate, 100)}%;"></div>
          </div>
          <div class="task-meta-bottom">
            <span class="due-date-pill">📊 ${rateDisplay}</span>
          </div>

          <div class="task-meta-bottom">
            ${periodHtml}
            ${dueDateHtml}
            ${ownerHtml}
            <span class="created-at">등록: ${formatDate(kpi.created_at)}</span>
          </div>
        </div>

        <div class="task-actions">
          <button type="button" class="action-icon-btn edit-btn" onclick="openEditModal(${kpi.id})" title="수정">
            ✏️
          </button>
          <button type="button" class="action-icon-btn delete-btn" onclick="handleDeleteTask(${kpi.id})" title="삭제">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  DOM.taskItemsList.innerHTML = html;
}

function getKpiTypeIcon(type) {
  switch (type) {
    case '재무': return '💰';
    case '고객': return '🤝';
    case '프로세스': return '⚙️';
    case '성장': return '🌱';
    default: return '🧬';
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  return dateString.substring(0, 16);
}

function showLoading(isLoading) {
  state.isLoading = isLoading;
  DOM.loadingState.style.display = isLoading ? 'flex' : 'none';
}

/* ==========================================================================
   Event Handlers & User Actions
   ========================================================================== */
function setupEventListeners() {
  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Status Filter Tabs
  DOM.statusTabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      DOM.statusTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.filters.status = e.target.getAttribute('data-status');
      fetchKpis();
    });
  });

  // Status(지연/보류/진행중/완료) Filter
  DOM.filterPriority.addEventListener('change', (e) => {
    state.filters.kpi_status = e.target.value;
    fetchKpis();
  });

  // KPI 유형 Filter
  DOM.filterDna.addEventListener('change', (e) => {
    state.filters.kpi_type = e.target.value;
    fetchKpis();
  });

  // KPI 유형 Pills quick filter in dashboard card
  document.querySelectorAll('.dna-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tag = pill.getAttribute('data-tag');
      if (state.filters.kpi_type === tag) {
        state.filters.kpi_type = 'all';
        DOM.filterDna.value = 'all';
        showToast('KPI 유형 필터가 해제되었습니다.', 'info');
      } else {
        state.filters.kpi_type = tag;
        DOM.filterDna.value = tag;
        showToast(`'${tag}' 관점 KPI만 모아봅니다.`, 'info');
      }
      fetchKpis();
    });
  });

  // 부서 Filter
  DOM.filterCategory.addEventListener('change', (e) => {
    state.filters.department = e.target.value;
    fetchKpis();
  });

  // Sort By
  DOM.sortBy.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    fetchKpis();
  });

  // Search input with debounce
  let searchTimeout = null;
  DOM.taskSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.searchClearBtn.style.display = val.length > 0 ? 'block' : 'none';

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.q = val;
      fetchKpis();
    }, 280);
  });

  DOM.searchClearBtn.addEventListener('click', () => {
    DOM.taskSearchInput.value = '';
    DOM.searchClearBtn.style.display = 'none';
    state.filters.q = '';
    fetchKpis();
    DOM.taskSearchInput.focus();
  });

  // Batch clear completed
  DOM.clearCompletedBtn.addEventListener('click', handleClearCompleted);

  // CSV Export
  DOM.exportCsvBtn.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
    showToast('CSV KPI 파일 다운로드를 시작합니다.', 'info');
  });

  // Modal open/close
  DOM.openNewModalBtn.addEventListener('click', openCreateModal);
  DOM.closeCreateModalBtn.addEventListener('click', closeCreateModal);
  DOM.cancelCreateModalBtn.addEventListener('click', closeCreateModal);

  DOM.closeEditModalBtn.addEventListener('click', closeEditModal);
  DOM.cancelEditModalBtn.addEventListener('click', closeEditModal);

  // Click outside modal window to close
  DOM.createModalBackdrop.addEventListener('click', (e) => {
    if (e.target === DOM.createModalBackdrop) closeCreateModal();
  });
  DOM.editModalBackdrop.addEventListener('click', (e) => {
    if (e.target === DOM.editModalBackdrop) closeEditModal();
  });

  // Form Submissions
  DOM.createTaskForm.addEventListener('submit', handleCreateFormSubmit);
  DOM.editTaskForm.addEventListener('submit', handleEditFormSubmit);

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreateModal();
      closeEditModal();
    } else if ((e.key === 'n' || e.key === 'N') && !isInputFocused()) {
      e.preventDefault();
      openCreateModal();
    } else if (e.key === '/' && !isInputFocused()) {
      e.preventDefault();
      DOM.taskSearchInput.focus();
    }
  });
}

function isInputFocused() {
  const activeEl = document.activeElement;
  return activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
}

/* ==========================================================================
   KPI Operations
   ========================================================================== */
window.handleToggleTask = async function(id) {
  soundFX.playSuccessChime();
  try {
    const updated = await toggleKpiStatus(id);
    await Promise.all([fetchKpis(), fetchStats()]);

    if (updated.status === '완료') {
      showToast('🎉 KPI를 완료 처리했습니다! 수고하셨습니다.', 'success');
    } else {
      showToast('KPI를 진행중 상태로 변경했습니다.', 'info');
    }
  } catch (err) {
    showToast('상태 변경 중 오류가 발생했습니다.', 'error');
  }
};

window.handleDeleteTask = async function(id) {
  if (!confirm('이 KPI를 정말 삭제하시겠습니까?')) return;
  soundFX.playPopSound();
  try {
    await deleteKpiItem(id);
    await Promise.all([fetchKpis(), fetchStats()]);
    showToast('KPI가 성공적으로 삭제되었습니다.', 'info');
  } catch (err) {
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
};

async function handleClearCompleted() {
  const completedCount = state.stats.completed;
  if (completedCount === 0) {
    showToast('정리할 완료된 KPI가 없습니다.', 'info');
    return;
  }

  if (!confirm(`완료된 KPI ${completedCount}개를 모두 정리(삭제)하시겠습니까?`)) return;

  try {
    const res = await clearCompletedKpis();
    await Promise.all([fetchKpis(), fetchStats()]);
    showToast(`완료된 ${res.deleted_count}개 KPI를 정리했습니다.`, 'success');
  } catch (err) {
    showToast('완료 항목 정리 중 오류가 발생했습니다.', 'error');
  }
}

/* ==========================================================================
   Modals Management
   ========================================================================== */
window.openCreateModal = function() {
  DOM.createTaskForm.reset();
  setDefaultDueDate();
  DOM.createModalBackdrop.style.display = 'flex';
  setTimeout(() => document.getElementById('createTitle').focus(), 50);
  soundFX.playPopSound();
};

function closeCreateModal() {
  DOM.createModalBackdrop.style.display = 'none';
}

async function handleCreateFormSubmit(e) {
  e.preventDefault();
  const formData = new FormData(DOM.createTaskForm);

  const payload = {
    name: formData.get('name'),
    description: formData.get('description'),
    owner: formData.get('owner'),
    department: formData.get('department'),
    kpi_type: formData.get('kpi_type'),
    unit: formData.get('unit'),
    target_value: formData.get('target_value') || 0,
    current_value: formData.get('current_value') || 0,
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    status: formData.get('status'),
    memo: formData.get('memo')
  };

  try {
    await createKpi(payload);
    closeCreateModal();
    soundFX.playSuccessChime();
    showToast('새로운 KPI가 성공적으로 등록되었습니다!', 'success');
    await Promise.all([fetchKpis(), fetchStats()]);
  } catch (err) {
    showToast(err.message || 'KPI 등록에 실패했습니다.', 'error');
  }
}

window.openEditModal = function(id) {
  const kpi = state.kpis.find(k => k.id === id);
  if (!kpi) return;

  document.getElementById('editTaskId').value = kpi.id;
  document.getElementById('editTitle').value = kpi.name;
  document.getElementById('editDescription').value = kpi.description || '';
  document.getElementById('editOwner').value = kpi.owner || '';
  document.getElementById('editCategory').value = kpi.department || '영업팀';
  document.getElementById('editDna').value = kpi.kpi_type || '성장';
  document.getElementById('editPriority').value = kpi.status || '진행중';
  document.getElementById('editUnit').value = kpi.unit || '';
  document.getElementById('editTarget').value = kpi.target_value ?? 0;
  document.getElementById('editCurrent').value = kpi.current_value ?? 0;
  document.getElementById('editStartDate').value = kpi.start_date || '';
  document.getElementById('editDueDate').value = kpi.end_date || '';
  document.getElementById('editMemo').value = kpi.memo || '';

  DOM.editModalBackdrop.style.display = 'flex';
  setTimeout(() => document.getElementById('editTitle').focus(), 50);
  soundFX.playPopSound();
};

function closeEditModal() {
  DOM.editModalBackdrop.style.display = 'none';
}

async function handleEditFormSubmit(e) {
  e.preventDefault();
  const formData = new FormData(DOM.editTaskForm);
  const id = formData.get('id');

  const payload = {
    name: formData.get('name'),
    description: formData.get('description'),
    owner: formData.get('owner'),
    department: formData.get('department'),
    kpi_type: formData.get('kpi_type'),
    unit: formData.get('unit'),
    target_value: formData.get('target_value') || 0,
    current_value: formData.get('current_value') || 0,
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    status: formData.get('status'),
    memo: formData.get('memo')
  };

  try {
    await updateKpi(id, payload);
    closeEditModal();
    soundFX.playSuccessChime();
    showToast('KPI 내용이 저장되었습니다.', 'success');
    await Promise.all([fetchKpis(), fetchStats()]);
  } catch (err) {
    showToast(err.message || 'KPI 수정에 실패했습니다.', 'error');
  }
}

/* ==========================================================================
   Toast Notification Helper
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease-out';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Security: HTML Escaping
function escapeHtml(str) {
  if (str === null || str === undefined || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
