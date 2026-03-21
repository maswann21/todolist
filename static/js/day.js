// ===== STATE =====
let currentDate = '';
let pageData = null;
let categories = [];
let selectedTaskId = null;

const STATUS_CYCLE = [null, 'done', 'failed', 'carry'];
const STATUS_ICONS = { done: '✔', failed: '✖', carry: '▲', null: '—' };

// ===== DATE HELPERS =====
function getDateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('date') || new Date().toISOString().slice(0, 10);
}

function navigateToDate(dateStr) {
  window.location.href = `/day?date=${dateStr}`;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  return categories.find(c => c.id === id) || { color: '#94a3b8', name: '?' };
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
    item.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '');
    item.dataset.taskId = task.id;

    item.innerHTML = `
      <div class="task-color-dot" style="background:${cat.color}"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-status" title="클릭하여 상태 변경">${STATUS_ICONS[task.status] || '—'}</span>
      <span class="task-delete" title="삭제">✕</span>
    `;

    // Select task on click (for timetable painting)
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-status') || e.target.classList.contains('task-delete')) return;
      selectedTaskId = task.id === selectedTaskId ? null : task.id;
      renderTasks();
      // Notify timetable (Task 10 will hook into this)
      document.dispatchEvent(new CustomEvent('taskSelected', { detail: { taskId: selectedTaskId } }));
    });

    // Status cycle
    item.querySelector('.task-status').addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentIdx = STATUS_CYCLE.indexOf(task.status);
      const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      try {
        const updated = await api('PUT', `/api/tasks/${task.id}`, { status: nextStatus || '' });
        task.status = updated.status;
        renderTasks();
      } catch (err) {
        alert('상태 변경 실패: ' + err.message);
      }
    });

    // Delete
    item.querySelector('.task-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${task.title}" 삭제할까요?`)) return;
      try {
        await api('DELETE', `/api/tasks/${task.id}`);
        pageData.tasks = pageData.tasks.filter(t => t.id !== task.id);
        if (selectedTaskId === task.id) selectedTaskId = null;
        renderTasks();
        updateTotalTime();
        document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
      } catch (err) {
        alert('삭제 실패: ' + err.message);
      }
    });

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

  try {
    const newTask = await api('POST', `/api/daily-pages/${currentDate}/tasks`, {
      title,
      category_id: categoryId,
      priority,
    });
    newTask.time_blocks = [];
    pageData.tasks.push(newTask);
    titleInput.value = '';
    renderTasks();
    document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
  } catch (err) {
    alert('추가 실패: ' + err.message);
  }
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
    [pageData, categories] = await Promise.all([
      api('GET', `/api/daily-pages/${currentDate}`),
      api('GET', '/api/categories'),
    ]);
  } catch (err) {
    alert('데이터 로드 실패: ' + err.message);
    return;
  }

  // Fill fields
  document.getElementById('commentInput').value = pageData.comment || '';
  document.getElementById('memoInput').value = pageData.memo || '';
  document.getElementById('ddayInput').value = pageData.d_day_label || '';

  populateCategoryDropdown();
  renderTasks();
  updateTotalTime();
  setupAutoSave();

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
    cellsWrapper.style.display = 'grid';
    cellsWrapper.style.gridTemplateColumns = 'repeat(6, 1fr)';
    cellsWrapper.style.flex = '1';

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
      timetableSlots[i].style.background = color;
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
  if (!activeTimetableTaskId) return;
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
  clearDragPaint(dragStartSlot, dragEndSlot);
  dragEndSlot = slot;
  const cat = getCategoryById(pageData.tasks.find(t => t.id === activeTimetableTaskId)?.category_id);
  paintRange(dragStartSlot, dragEndSlot, cat.color + '88');
}

async function onSlotMouseup(e) {
  if (!isDragging) return;
  const slot = parseInt(e.currentTarget.dataset.slot);
  dragEndSlot = slot;
  isDragging = false;

  clearDragPaint(dragStartSlot, dragEndSlot);

  const lo = Math.min(dragStartSlot, dragEndSlot);
  const hi = Math.max(dragStartSlot, dragEndSlot) + 1; // end is exclusive

  const startTime = slotToTime(lo);
  const endTime = slotToTime(hi);

  try {
    const block = await api('POST', `/api/tasks/${activeTimetableTaskId}/time-blocks`, {
      start_at: startTime,
      end_at: endTime,
    });
    // Add block to pageData
    const task = pageData.tasks.find(t => t.id === activeTimetableTaskId);
    if (task) task.time_blocks.push(block);
    fillTimetableFromTasks();
    updateTotalTime();
  } catch (err) {
    if (err.message.includes('409') || err.message.toLowerCase().includes('overlap')) {
      alert('이 시간대에 이미 다른 블록이 있습니다.');
    } else {
      alert('블록 추가 실패: ' + err.message);
    }
    fillTimetableFromTasks(); // restore
  }
}

function onDocumentMouseup() {
  if (isDragging) {
    isDragging = false;
    if (dragStartSlot !== null && dragEndSlot !== null) {
      clearDragPaint(dragStartSlot, dragEndSlot);
    }
  }
}

async function onSlotClick(e) {
  const slot = e.currentTarget;
  if (!slot.classList.contains('filled')) return;
  const blockId = parseInt(slot.dataset.blockId);
  if (!blockId) return;
  if (!confirm('이 시간 블록을 삭제할까요?')) return;
  try {
    await api('DELETE', `/api/time-blocks/${blockId}`);
    // Remove block from pageData
    for (const task of pageData.tasks) {
      task.time_blocks = task.time_blocks.filter(b => b.id !== blockId);
    }
    fillTimetableFromTasks();
    updateTotalTime();
  } catch (err) {
    alert('삭제 실패: ' + err.message);
  }
}

// Listen for task selection from checklist
document.addEventListener('taskSelected', (e) => {
  activeTimetableTaskId = e.detail.taskId;
  const task = pageData?.tasks.find(t => t.id === activeTimetableTaskId);
  const label = document.getElementById('selectedTaskLabel');
  if (label) {
    label.textContent = task ? `— ${task.title} 선택됨` : '';
  }
});

// Listen for tasks changes (delete) to update timetable
document.addEventListener('tasksChanged', () => {
  fillTimetableFromTasks();
  updateTotalTime();
});
