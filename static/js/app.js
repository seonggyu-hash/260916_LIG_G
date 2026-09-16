/**
 * LIG DNA SMART TASK MANAGER - FRONTEND CONTROLLER
 * Full Reactive UI, Web Audio API Sound Effects, Real-time Filtering & Modal Management
 */

// State Management
const state = {
  todos: [],
  filters: {
    status: 'all',
    priority: 'all',
    dna_tag: 'all',
    category: 'all',
    q: '',
    sort: 'created_desc'
  },
  stats: {
    total: 0,
    completed: 0,
    pending: 0,
    completion_rate: 0,
    critical_count: 0,
    dna_distribution: {}
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

  // KPI
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
    await Promise.all([fetchTodos(), fetchStats()]);
  } catch (err) {
    console.error('Data load error:', err);
    showToast('데이터를 불러오는 중 문제가 발생했습니다.', 'error');
  } finally {
    showLoading(false);
  }
}

async function fetchTodos() {
  const params = new URLSearchParams({
    status: state.filters.status,
    priority: state.filters.priority,
    dna_tag: state.filters.dna_tag,
    category: state.filters.category,
    q: state.filters.q,
    sort: state.filters.sort
  });

  const res = await fetch(`/api/todos?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch todos');
  const todos = await res.json();
  state.todos = todos;
  renderTasks();
}

async function fetchStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  const stats = await res.json();
  state.stats = stats;
  renderStats();
}

async function createTodo(payload) {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || '할 일 등록에 실패했습니다.');
  }

  return await res.json();
}

async function updateTodo(id, payload) {
  const res = await fetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || '할 일 수정에 실패했습니다.');
  }

  return await res.json();
}

async function toggleTodoStatus(id) {
  const res = await fetch(`/api/todos/${id}/toggle`, {
    method: 'PATCH'
  });

  if (!res.ok) throw new Error('상태 변경에 실패했습니다.');
  return await res.json();
}

async function deleteTodoItem(id) {
  const res = await fetch(`/api/todos/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('삭제에 실패했습니다.');
  return await res.json();
}

async function clearCompletedTodos() {
  const res = await fetch('/api/todos/clear-completed', {
    method: 'POST'
  });

  if (!res.ok) throw new Error('완료 항목 정리에 실패했습니다.');
  return await res.json();
}

/* ==========================================================================
   Render UI Functions
   ========================================================================== */
function renderStats() {
  const { total, completed, pending, completion_rate, critical_count, dna_distribution } = state.stats;

  DOM.kpiTotalCount.textContent = total;
  DOM.kpiCompletedCount.textContent = completed;
  DOM.kpiPendingCount.textContent = pending;
  DOM.kpiRateBadge.textContent = `${completion_rate}%`;
  DOM.kpiProgressBar.style.width = `${completion_rate}%`;
  DOM.kpiCriticalCount.textContent = critical_count;

  // DNA Value counts
  DOM.countChallenge.textContent = dna_distribution['도전'] || 0;
  DOM.countTrust.textContent = dna_distribution['신뢰'] || 0;
  DOM.countTech.textContent = dna_distribution['첨단'] || 0;
  DOM.countInnovation.textContent = dna_distribution['혁신'] || 0;
}

function renderTasks() {
  DOM.activeListCount.textContent = `(${state.todos.length})`;

  if (state.todos.length === 0) {
    DOM.taskItemsList.innerHTML = '';
    DOM.emptyState.style.display = 'flex';
    return;
  }

  DOM.emptyState.style.display = 'none';

  const todayStr = new Date().toISOString().split('T')[0];

  const html = state.todos.map(todo => {
    const isDone = todo.completed === 1;

    // Due Date calculation
    let dueDateHtml = '';
    if (todo.due_date) {
      let dateClass = '';
      let datePrefix = '📅 ';
      if (todo.due_date < todayStr && !isDone) {
        dateClass = 'overdue';
        datePrefix = '⚠️ 기한 초과: ';
      } else if (todo.due_date === todayStr && !isDone) {
        dateClass = 'today';
        datePrefix = '🔥 오늘 마감: ';
      }
      dueDateHtml = `<span class="due-date-pill ${dateClass}">${datePrefix}${escapeHtml(todo.due_date)}</span>`;
    }

    // Priority Labels
    const priorityLabels = {
      critical: '🚨 긴급',
      high: '🔥 높음',
      medium: '⚡ 보통',
      low: '🌱 낮음'
    };

    // Memo snippet
    const memoHtml = todo.memo ? `<div class="task-memo-preview">${escapeHtml(todo.memo)}</div>` : '';

    return `
      <div class="task-card ${isDone ? 'completed' : ''}" data-id="${todo.id}" data-priority="${todo.priority}">
        <div class="task-checkbox-wrap">
          <button type="button" class="task-custom-checkbox" onclick="handleToggleTask(${todo.id})" title="${isDone ? '완료 취소' : '업무 완료 처리'}">
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>

        <div class="task-body">
          <div class="task-meta-top">
            <span class="badge badge-dna" data-tag="${escapeHtml(todo.dna_tag)}">${getDnaIcon(todo.dna_tag)} ${escapeHtml(todo.dna_tag)}</span>
            <span class="badge badge-category">${escapeHtml(todo.category)}</span>
            <span class="badge badge-priority ${todo.priority}">${priorityLabels[todo.priority] || todo.priority}</span>
          </div>

          <div class="task-title-text">${escapeHtml(todo.title)}</div>
          ${memoHtml}

          <div class="task-meta-bottom">
            ${dueDateHtml}
            <span class="created-at">등록: ${formatDate(todo.created_at)}</span>
          </div>
        </div>

        <div class="task-actions">
          <button type="button" class="action-icon-btn edit-btn" onclick="openEditModal(${todo.id})" title="수정">
            ✏️
          </button>
          <button type="button" class="action-icon-btn delete-btn" onclick="handleDeleteTask(${todo.id})" title="삭제">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  DOM.taskItemsList.innerHTML = html;
}

function getDnaIcon(tag) {
  switch (tag) {
    case '도전': return '🔥';
    case '신뢰': return '🤝';
    case '첨단': return '⚡';
    case '혁신': return '💡';
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
      fetchTodos();
    });
  });

  // Priority Filter
  DOM.filterPriority.addEventListener('change', (e) => {
    state.filters.priority = e.target.value;
    fetchTodos();
  });

  // DNA Tag Filter
  DOM.filterDna.addEventListener('change', (e) => {
    state.filters.dna_tag = e.target.value;
    fetchTodos();
  });

  // DNA Pills quick filter in KPI card
  document.querySelectorAll('.dna-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tag = pill.getAttribute('data-tag');
      if (state.filters.dna_tag === tag) {
        state.filters.dna_tag = 'all';
        DOM.filterDna.value = 'all';
        showToast('DNA 필터가 해제되었습니다.', 'info');
      } else {
        state.filters.dna_tag = tag;
        DOM.filterDna.value = tag;
        showToast(`'${tag}' 가치 업무만 모아봅니다.`, 'info');
      }
      fetchTodos();
    });
  });

  // Category Filter
  DOM.filterCategory.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    fetchTodos();
  });

  // Sort By
  DOM.sortBy.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    fetchTodos();
  });

  // Search input with debounce
  let searchTimeout = null;
  DOM.taskSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.searchClearBtn.style.display = val.length > 0 ? 'block' : 'none';

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.q = val;
      fetchTodos();
    }, 280);
  });

  DOM.searchClearBtn.addEventListener('click', () => {
    DOM.taskSearchInput.value = '';
    DOM.searchClearBtn.style.display = 'none';
    state.filters.q = '';
    fetchTodos();
    DOM.taskSearchInput.focus();
  });

  // Batch clear completed
  DOM.clearCompletedBtn.addEventListener('click', handleClearCompleted);

  // CSV Export
  DOM.exportCsvBtn.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
    showToast('CSV 업무 파일 다운로드를 시작합니다.', 'info');
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
   Task Operations
   ========================================================================== */
window.handleToggleTask = async function(id) {
  soundFX.playSuccessChime();
  try {
    const updated = await toggleTodoStatus(id);
    await Promise.all([fetchTodos(), fetchStats()]);

    if (updated.completed === 1) {
      showToast('🎉 업무를 완료했습니다! 수고하셨습니다.', 'success');
    } else {
      showToast('업무를 진행중 상태로 변경했습니다.', 'info');
    }
  } catch (err) {
    showToast('상태 변경 중 오류가 발생했습니다.', 'error');
  }
};

window.handleDeleteTask = async function(id) {
  if (!confirm('이 업무를 정말 삭제하시겠습니까?')) return;
  soundFX.playPopSound();
  try {
    await deleteTodoItem(id);
    await Promise.all([fetchTodos(), fetchStats()]);
    showToast('업무가 성공적으로 삭제되었습니다.', 'info');
  } catch (err) {
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
};

async function handleClearCompleted() {
  const completedCount = state.stats.completed;
  if (completedCount === 0) {
    showToast('정리할 완료된 업무가 없습니다.', 'info');
    return;
  }

  if (!confirm(`완료된 업무 ${completedCount}개를 모두 정리(삭제)하시겠습니까?`)) return;

  try {
    const res = await clearCompletedTodos();
    await Promise.all([fetchTodos(), fetchStats()]);
    showToast(`완료된 ${res.deleted_count}개 업무를 정리했습니다.`, 'success');
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
    title: formData.get('title'),
    category: formData.get('category'),
    dna_tag: formData.get('dna_tag'),
    priority: formData.get('priority'),
    due_date: formData.get('due_date'),
    memo: formData.get('memo')
  };

  try {
    await createTodo(payload);
    closeCreateModal();
    soundFX.playSuccessChime();
    showToast('새로운 업무가 성공적으로 등록되었습니다!', 'success');
    await Promise.all([fetchTodos(), fetchStats()]);
  } catch (err) {
    showToast(err.message || '업무 등록에 실패했습니다.', 'error');
  }
}

window.openEditModal = function(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  document.getElementById('editTaskId').value = todo.id;
  document.getElementById('editTitle').value = todo.title;
  document.getElementById('editCategory').value = todo.category || '업무';
  document.getElementById('editDna').value = todo.dna_tag || '혁신';
  document.getElementById('editPriority').value = todo.priority || 'medium';
  document.getElementById('editDueDate').value = todo.due_date || '';
  document.getElementById('editMemo').value = todo.memo || '';
  document.getElementById('editCompleted').checked = todo.completed === 1;

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
    title: formData.get('title'),
    category: formData.get('category'),
    dna_tag: formData.get('dna_tag'),
    priority: formData.get('priority'),
    due_date: formData.get('due_date'),
    memo: formData.get('memo'),
    completed: document.getElementById('editCompleted').checked
  };

  try {
    await updateTodo(id, payload);
    closeEditModal();
    soundFX.playSuccessChime();
    showToast('업무 내용이 저장되었습니다.', 'success');
    await Promise.all([fetchTodos(), fetchStats()]);
  } catch (err) {
    showToast(err.message || '업무 수정에 실패했습니다.', 'error');
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
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
