// ===== STATE =====
let currentDate = '';
let pageData = null;
let categories = [];
let categoryMap = new Map();
let selectedTaskId = null;

const STATUS_CYCLE = [null, 'done', 'failed', 'carry'];
const STATUS_ICONS = { done: '✔', failed: '✖', carry: '▲', null: '—' };

// ===== DATE HELPERS =====
function getDateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('date')) return params.get('date');
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function navigateToDate(dateStr) {
  window.location.href = `/day?date=${dateStr}`;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTitle(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
}

// ===== API HELPERS =====
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ===== TOTAL TIME =====
function calcTotalMinutes() {
  if (!pageData) return 0;
  let total = 0;
  for (const task of pageData.tasks) {
    for (const block of task.time_blocks) {
      const [sh, sm] = block.start_at.split(':').map(Number);
      const [eh, em] = block.end_at.split(':').map(Number);
      total += (eh * 60 + em) - (sh * 60 + sm);
    }
  }
  return total;
}

function updateTotalTime() {
  const mins = calcTotalMinutes();
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  document.getElementById('totalTime').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ===== CATEGORY HELPERS =====
function getCategoryById(id) {
  return categoryMap.get(id) || { color: '#94a3b8', name: '?' };
}

// ===== TASK LIST EVENT DELEGATION =====
async function handleTaskListClick(e) {
  const taskItem = e.target.closest('.task-item');
  if (!taskItem) return;
  const taskId = parseInt(taskItem.dataset.taskId);
  const task = pageData.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (e.target.classList.contains('task-delete')) {
    e.stopPropagation();
    if (!confirm(`"${task.title}" 삭제할까요?`)) return;
    // Optimistic: remove from DOM and state immediately
    const taskIndex = pageData.tasks.indexOf(task);
    pageData.tasks = pageData.tasks.filter(t => t.id !== task.id);
    if (selectedTaskId === task.id) selectedTaskId = null;
    taskItem.remove();
    updateTotalTime();
    document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
    // API in background
    api('DELETE', `/api/tasks/${task.id}`).catch(err => {
      // Rollback: re-insert task and re-render
      pageData.tasks.splice(taskIndex, 0, task);
      renderTasks();
      fillTimetableFromTasks();
      updateTotalTime();
      alert('삭제 실패: ' + err.message);
    });
    return;
  }

  if (e.target.classList.contains('task-status') || e.target.classList.contains('task-status-badge')) {
    e.stopPropagation();
    const currentIdx = STATUS_CYCLE.indexOf(task.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    const prevStatus = task.status;
    // Optimistic: update DOM immediately
    task.status = nextStatus;
    const statusEl = taskItem.querySelector('.task-status');
    statusEl.textContent = STATUS_ICONS[task.status] || '—';
    statusEl.className = `task-status task-status-badge status-badge-${task.status || 'none'}`;
    const statusClass = task.status ? `status-${task.status}` : '';
    taskItem.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '') + (statusClass ? ` ${statusClass}` : '');
    // API in background
    api('PUT', `/api/tasks/${task.id}`, { status: nextStatus || '' }).catch(err => {
      // Rollback on failure
      task.status = prevStatus;
      statusEl.textContent = STATUS_ICONS[prevStatus] || '—';
      statusEl.className = `task-status task-status-badge status-badge-${prevStatus || 'none'}`;
      const rollbackClass = prevStatus ? `status-${prevStatus}` : '';
      taskItem.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '') + (rollbackClass ? ` ${rollbackClass}` : '');
      console.error('상태 변경 실패:', err);
    });
    return;
  }

  selectedTaskId = task.id === selectedTaskId ? null : task.id;
  document.querySelectorAll('.task-item').forEach(item => {
    const id = parseInt(item.dataset.taskId);
    item.classList.toggle('selected', id === selectedTaskId);
  });
  document.dispatchEvent(new CustomEvent('taskSelected', { detail: { taskId: selectedTaskId } }));
}

// ===== TASK RENDERING =====
function renderTasks() {
  const container = document.getElementById('taskList');
  container.innerHTML = '';

  const tasks = pageData?.tasks || [];
  tasks.sort((a, b) => a.priority - b.priority);

  for (const task of tasks) {
    const cat = getCategoryById(task.category_id);
    const item = document.createElement('div');
    const statusClass = task.status ? ` status-${task.status}` : '';
    item.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '') + statusClass;
    item.dataset.taskId = task.id;

    item.innerHTML = `
      <div class="task-color-dot" style="background:${cat.color}"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-status task-status-badge status-badge-${task.status || 'none'}" title="클릭하여 상태 변경">${STATUS_ICONS[task.status] || '—'}</span>
      <span class="task-delete" title="삭제">✕</span>
    `;

    container.appendChild(item);
  }
}

// ===== ADD TASK =====
async function addTask() {
  const titleInput = document.getElementById('newTaskTitle');
  const catSelect = document.getElementById('newTaskCategory');
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }

  const categoryId = parseInt(catSelect.value);
  const priority = (pageData?.tasks?.length || 0) + 1;

  // Optimistic: add to DOM immediately with temp ID
  const tempId = -Date.now();
  const tempTask = { id: tempId, title, category_id: categoryId, priority, status: null, time_blocks: [] };
  pageData.tasks.push(tempTask);
  titleInput.value = '';
  const cat = getCategoryById(categoryId);
  const item = document.createElement('div');
  item.className = 'task-item';
  item.dataset.taskId = tempId;
  item.innerHTML = `
    <div class="task-color-dot" style="background:${cat.color}"></div>
    <span class="task-title">${escapeHtml(title)}</span>
    <span class="task-status task-status-badge status-badge-none" title="클릭하여 상태 변경">—</span>
    <span class="task-delete" title="삭제">✕</span>
  `;
  document.getElementById('taskList').appendChild(item);
  document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
  // API in background — replace temp ID with real one
  api('POST', `/api/daily-pages/${currentDate}/tasks`, {
    title,
    category_id: categoryId,
    priority,
  }).then(newTask => {
    tempTask.id = newTask.id;
    item.dataset.taskId = newTask.id;
  }).catch(err => {
    // Rollback
    pageData.tasks = pageData.tasks.filter(t => t.id !== tempId);
    item.remove();
    alert('추가 실패: ' + err.message);
  });
}

// ===== AUTO-SAVE FIELDS =====
function setupAutoSave() {
  const comment = document.getElementById('commentInput');
  const memo = document.getElementById('memoInput');
  const dday = document.getElementById('ddayInput');

  async function save(field, value) {
    try {
      await api('PUT', `/api/daily-pages/${currentDate}`, { [field]: value });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }

  comment.addEventListener('blur', () => save('comment', comment.value));
  memo.addEventListener('blur', () => save('memo', memo.value));
  dday.addEventListener('blur', () => save('d_day_label', dday.value));
}

// ===== ESCAPE HTML =====
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== CATEGORY DROPDOWN =====
function populateCategoryDropdown() {
  const select = document.getElementById('newTaskCategory');
  select.innerHTML = '';
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  }
}

// ===== INIT =====
async function init() {
  currentDate = getDateFromUrl();
  document.getElementById('dayTitle').textContent = formatDateTitle(currentDate);

  // Navigation
  document.getElementById('prevDayBtn').addEventListener('click', () => navigateToDate(offsetDate(currentDate, -1)));
  document.getElementById('nextDayBtn').addEventListener('click', () => navigateToDate(offsetDate(currentDate, 1)));

  // Load data
  try {
    const cachedCats = localStorage.getItem('categories');
    const [pageDataResult, categoriesResult] = await Promise.all([
      api('GET', `/api/daily-pages/${currentDate}`),
      cachedCats ? Promise.resolve(JSON.parse(cachedCats)) : api('GET', '/api/categories'),
    ]);
    pageData = pageDataResult;
    categories = categoriesResult;
    if (!cachedCats) localStorage.setItem('categories', JSON.stringify(categories));
  } catch (err) {
    alert('데이터 로드 실패: ' + err.message);
    return;
  }

  categoryMap = new Map(categories.map(c => [c.id, c]));

  // Fill fields
  document.getElementById('commentInput').value = pageData.comment || '';
  document.getElementById('memoInput').value = pageData.memo || '';
  document.getElementById('ddayInput').value = pageData.d_day_label || '';

  populateCategoryDropdown();
  renderTasks();
  updateTotalTime();
  setupAutoSave();
  document.getElementById('taskList').addEventListener('click', handleTaskListClick);

  // Add task button + enter key
  document.getElementById('addTaskBtn').addEventListener('click', addTask);
  document.getElementById('newTaskTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  buildTimetable();
  fillTimetableFromTasks();
}

init();

// ===== TIMETABLE =====

const TOTAL_SLOTS = 144; // 24 hours × 6 slots (10 min each)
let timetableSlots = []; // array of DOM elements, index = slot index (0 = 00:00, 143 = 23:50)
let isDragging = false;
let dragStartSlot = null;
let dragEndSlot = null;
let activeTimetableTaskId = null;
let dragRAFId = null;
let justFinishedDrag = false;

function slotToTime(slotIndex) {
  const totalMinutes = slotIndex * 10;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return Math.floor((h * 60 + m) / 10);
}

function buildTimetable() {
  const grid = document.getElementById('timetableGrid');
  if (!grid) return;
  grid.innerHTML = '';
  timetableSlots = [];

  for (let hour = 0; hour < 24; hour++) {
    const row = document.createElement('div');
    row.className = 'timetable-hour-row';

    // Hour label
    const label = document.createElement('div');
    label.className = 'timetable-hour-label';
    label.textContent = `${hour}:00`;
    row.appendChild(label);

    // 6 cells for this hour (10 min each)
    const cellsWrapper = document.createElement('div');
    cellsWrapper.className = 'timetable-hour-cells';

    for (let min = 0; min < 6; min++) {
      const slotIndex = hour * 6 + min;
      const cell = document.createElement('div');
      cell.className = 'timetable-slot';
      cell.dataset.slot = slotIndex;

      cell.addEventListener('mousedown', onSlotMousedown);
      cell.addEventListener('mouseover', onSlotMouseover);
      cell.addEventListener('mouseup', onSlotMouseup);
      cell.addEventListener('click', onSlotClick);

      timetableSlots.push(cell);
      cellsWrapper.appendChild(cell);
    }

    row.appendChild(cellsWrapper);
    grid.appendChild(row);
  }

  // Prevent text selection during drag
  grid.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('mouseup', onDocumentMouseup);

  // Initial state: no task selected
  grid.classList.add('timetable-no-task');
}

function fillTimetableFromTasks() {
  // Clear all fills
  for (const slot of timetableSlots) {
    slot.style.background = '';
    slot.classList.remove('filled');
    delete slot.dataset.blockId;
    delete slot.dataset.taskId;
  }

  if (!pageData) return;

  for (const task of pageData.tasks) {
    const cat = getCategoryById(task.category_id);
    for (const block of task.time_blocks) {
      const startSlot = timeToSlot(block.start_at);
      const endSlot = timeToSlot(block.end_at);
      for (let i = startSlot; i < endSlot; i++) {
        if (timetableSlots[i]) {
          timetableSlots[i].style.background = cat.color;
          timetableSlots[i].classList.add('filled');
          timetableSlots[i].dataset.blockId = block.id;
          timetableSlots[i].dataset.taskId = task.id;
        }
      }
    }
  }
}

function paintRange(startSlot, endSlot, color) {
  const lo = Math.min(startSlot, endSlot);
  const hi = Math.max(startSlot, endSlot);
  for (let i = lo; i <= hi; i++) {
    if (timetableSlots[i] && !timetableSlots[i].classList.contains('filled')) {
      timetableSlots[i].style.background = color + '99';
      timetableSlots[i].classList.add('dragging');
    }
  }
}

function clearDragPaint(startSlot, endSlot) {
  const lo = Math.min(startSlot, endSlot);
  const hi = Math.max(startSlot, endSlot);
  for (let i = lo; i <= hi; i++) {
    if (timetableSlots[i] && timetableSlots[i].classList.contains('dragging')) {
      timetableSlots[i].style.background = '';
      timetableSlots[i].classList.remove('dragging');
    }
  }
}

function onSlotMousedown(e) {
  if (!activeTimetableTaskId) {
    const grid = document.getElementById('timetableGrid');
    grid.classList.add('timetable-shake');
    setTimeout(() => grid.classList.remove('timetable-shake'), 400);
    return;
  }
  const slot = parseInt(e.currentTarget.dataset.slot);
  if (timetableSlots[slot].classList.contains('filled')) return; // don't start drag on filled
  isDragging = true;
  dragStartSlot = slot;
  dragEndSlot = slot;
  const cat = getCategoryById(pageData.tasks.find(t => t.id === activeTimetableTaskId)?.category_id);
  paintRange(dragStartSlot, dragEndSlot, cat.color + '88');
  e.preventDefault();
}

function onSlotMouseover(e) {
  if (!isDragging) return;
  const slot = parseInt(e.currentTarget.dataset.slot);
  if (dragRAFId) cancelAnimationFrame(dragRAFId);
  dragRAFId = requestAnimationFrame(() => {
    clearDragPaint(dragStartSlot, dragEndSlot);
    dragEndSlot = slot;
    const cat = getCategoryById(pageData.tasks.find(t => t.id === activeTimetableTaskId)?.category_id);
    paintRange(dragStartSlot, dragEndSlot, cat.color + '88');
    dragRAFId = null;
  });
}

async function onSlotMouseup(e) {
  if (!isDragging) return;
  justFinishedDrag = true;
  setTimeout(() => { justFinishedDrag = false; }, 0);
  const slot = parseInt(e.currentTarget.dataset.slot);
  dragEndSlot = slot;
  isDragging = false;

  clearDragPaint(dragStartSlot, dragEndSlot);

  const lo = Math.min(dragStartSlot, dragEndSlot);
  const hi = Math.max(dragStartSlot, dragEndSlot) + 1; // end is exclusive

  const startTime = slotToTime(lo);
  const endTime = slotToTime(hi);

  // Optimistic: paint slots and add temp block immediately
  const task = pageData.tasks.find(t => t.id === activeTimetableTaskId);
  const tempBlockId = -Date.now();
  const tempBlock = { id: tempBlockId, task_id: activeTimetableTaskId, start_at: startTime + ':00', end_at: endTime + ':00' };
  if (task) task.time_blocks.push(tempBlock);
  fillTimetableFromTasks();
  updateTotalTime();
  // API in background
  api('POST', `/api/tasks/${activeTimetableTaskId}/time-blocks`, {
    start_at: startTime,
    end_at: endTime,
  }).then(block => {
    // Replace temp with real ID
    tempBlock.id = block.id;
    fillTimetableFromTasks();
  }).catch(err => {
    // Rollback
    if (task) task.time_blocks = task.time_blocks.filter(b => b.id !== tempBlockId);
    fillTimetableFromTasks();
    updateTotalTime();
    if (err.message.includes('409') || err.message.toLowerCase().includes('overlap')) {
      alert('이 시간대에 이미 다른 블록이 있습니다.');
    } else {
      alert('블록 추가 실패: ' + err.message);
    }
  });
}

function onDocumentMouseup() {
  if (isDragging) {
    isDragging = false;
    if (dragRAFId) { cancelAnimationFrame(dragRAFId); dragRAFId = null; }
    if (dragStartSlot !== null && dragEndSlot !== null) {
      clearDragPaint(dragStartSlot, dragEndSlot);
    }
  }
}

async function onSlotClick(e) {
  if (justFinishedDrag) return;
  const slot = e.currentTarget;
  if (!slot.classList.contains('filled')) return;
  const blockId = parseInt(slot.dataset.blockId);
  if (!blockId) return;
  if (!confirm('이 시간 블록을 삭제할까요?')) return;
  // Optimistic: remove from state and DOM immediately
  let removedBlock = null;
  let removedFromTask = null;
  for (const task of pageData.tasks) {
    const idx = task.time_blocks.findIndex(b => b.id === blockId);
    if (idx !== -1) {
      removedBlock = task.time_blocks[idx];
      removedFromTask = task;
      task.time_blocks.splice(idx, 1);
      break;
    }
  }
  fillTimetableFromTasks();
  updateTotalTime();
  // API in background
  api('DELETE', `/api/time-blocks/${blockId}`).catch(err => {
    // Rollback
    if (removedBlock && removedFromTask) {
      removedFromTask.time_blocks.push(removedBlock);
      fillTimetableFromTasks();
      updateTotalTime();
    }
    alert('삭제 실패: ' + err.message);
  });
}

// Listen for task selection from checklist
document.addEventListener('taskSelected', (e) => {
  activeTimetableTaskId = e.detail.taskId;
  const task = pageData?.tasks.find(t => t.id === activeTimetableTaskId);
  const label = document.getElementById('selectedTaskLabel');
  const grid = document.getElementById('timetableGrid');
  if (label) {
    if (task) {
      label.textContent = `— ${task.title} 선택됨`;
      label.style.color = '#3b82f6';
    } else {
      label.textContent = '— 할 일을 선택 후 드래그';
      label.style.color = '#94a3b8';
    }
  }
  if (grid) {
    grid.classList.toggle('timetable-no-task', !activeTimetableTaskId);
  }
});

// Listen for tasks changes (delete) to update timetable
document.addEventListener('tasksChanged', () => {
  fillTimetableFromTasks();
  updateTotalTime();
});
