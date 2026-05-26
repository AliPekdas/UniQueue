const API = '/api';
const TYPES = {
  STUDY: 'StudyRoom',
  OFFICE: 'OfficeHours',
  TRANSIT: 'TransitLine',
};

let state = {
  token: localStorage.getItem('uq_token'),
  user: JSON.parse(localStorage.getItem('uq_user') || 'null'),
};

let adminTab = 'study';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('#toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { res, body };
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('uq_token', token);
  localStorage.setItem('uq_user', JSON.stringify(user));
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('uq_token');
  localStorage.removeItem('uq_user');
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(`#${id}`)?.classList.add('active');
}

function screenForRole(role) {
  return (
    { Student: 'studentScreen', Lecturer: 'lecturerScreen', BusDriver: 'driverScreen', Admin: 'adminScreen' }[
      role
    ] || 'loginScreen'
  );
}

function updateHeader() {
  const badge = $('#userBadge');
  const logout = $('#logoutBtn');
  const systemTitle = $('#systemTitle');
  if (!state.user) {
    badge.classList.add('hidden');
    logout.classList.add('hidden');
    if (systemTitle) systemTitle.classList.remove('hidden');
    return;
  }
  badge.classList.remove('hidden');
  logout.classList.remove('hidden');
  if (systemTitle) systemTitle.classList.add('hidden');
  badge.innerHTML = `<strong>${state.user.role}</strong> · ${state.user.name}`;
}

function formatSqlTime(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 5);
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  return String(value).slice(0, 5);
}

function capacityPercent(resource) {
  if (!resource.maxCapacity) return 0;
  return Math.min(100, Math.round((resource.currentCapacity / resource.maxCapacity) * 100));
}

function renderStudyRoomCard(resource) {
  const pct = capacityPercent(resource);
  const statusClass =
    resource.status === 'Available' ? 'available' : resource.status === 'Full' ? 'full' : 'out';
  const full = resource.currentCapacity >= resource.maxCapacity || resource.status === 'Full';
  let actions = `<button class="btn btn-ghost" disabled>Unavailable</button>`;
  if (resource.status !== 'OutOfService') {
    actions = full
      ? `<button class="btn btn-waitlist" data-action="waitlist" data-id="${resource.resourceID}">Join Waitlist</button>`
      : `<button class="btn btn-primary" data-action="book" data-id="${resource.resourceID}">Book a Slot</button>`;
  }
  return `
    <article class="resource-card" data-resource-id="${resource.resourceID}">
      <span class="status-pill ${statusClass}">${resource.status}</span>
      <h3>${resource.resourceName}</h3>
      <p class="text-muted">${resource.currentCapacity} / ${resource.maxCapacity} booked</p>
      <div class="capacity-bar"><div class="capacity-fill" style="width:${pct}%"></div></div>
      <div class="card-actions">${actions}</div>
    </article>`;
}



function renderTransitCard(resource, { manage = false } = {}) {
  const actions = manage
    ? `<button class="btn btn-danger" data-action="delete-resource" data-id="${resource.resourceID}">Remove</button>`
    : '';
  return `
    <article class="resource-card schedule-card" data-resource-id="${resource.resourceID}">
      <span class="status-pill available">Schedule</span>
      <h3>${resource.resourceName}</h3>
      <p class="schedule-text">${resource.scheduleInfo || 'TBA'}</p>
      ${actions}
    </article>`;
}

function renderManagedBookableCard(resource, { canUpdate = true } = {}) {
  const windowInfo = `<p class="text-muted">${resource.currentCapacity} / ${resource.maxCapacity} booked</p>
       <div class="capacity-bar"><div class="capacity-fill" style="width:${capacityPercent(resource)}%"></div></div>`;
  const updateBtn = canUpdate
    ? `<button class="btn btn-ghost" data-action="update-resource" data-id="${resource.resourceID}" data-type="${resource.resourceType}" data-name="${encodeURIComponent(resource.resourceName)}" data-capacity="${resource.maxCapacity}">Update</button>`
    : '';
  return `
    <article class="resource-card" data-resource-id="${resource.resourceID}">
      <h3>${resource.resourceName}</h3>
      ${windowInfo}
      <div class="card-actions">
        ${updateBtn}
        <button class="btn btn-danger" data-action="delete-resource" data-id="${resource.resourceID}">Remove</button>
      </div>
    </article>`;
}

async function loadResources() {
  const { res, body } = await api('/resources');
  if (!res.ok) {
    showToast(body.error || 'Failed to load resources', 'error');
    return [];
  }
  return body;
}

async function loadReservations() {
  const { res, body } = await api('/reservations');
  const ul = $('#studentReservations');
  if (!ul) return;
  if (!res.ok) {
    ul.innerHTML = '<li>Could not load reservations</li>';
    return;
  }
  if (!body.length) {
    ul.innerHTML = '<li>No active reservations</li>';
    return;
  }
  ul.innerHTML = body
    .map((r) => {
      const slot = '';
      return `
    <li>
      <span>${r.resourceName}${slot} — <em>${r.status}</em></span>
      <button class="btn btn-ghost" data-action="cancel" data-id="${r.reservationID}">Cancel</button>
    </li>`;
    })
    .join('');
}

async function loadNotifications() {
  const ul = $('#studentNotifications');
  if (!ul) return;
  const { res, body } = await api('/notifications');
  if (!res.ok) {
    ul.innerHTML = '<li>Could not load notifications</li>';
    return;
  }
  if (!body.length) {
    ul.innerHTML = '<li>No notifications yet</li>';
    return;
  }
  ul.innerHTML = body
    .map((n) => `<li class="notification-item"><strong>${n.type}</strong><br>${n.message}</li>`)
    .join('');
}

async function renderStudentView() {
  const all = await loadResources();
  const study = all.filter((r) => r.resourceType === TYPES.STUDY);
  const office = all.filter((r) => r.resourceType === TYPES.OFFICE);
  const transit = all.filter((r) => r.resourceType === TYPES.TRANSIT);

  $('#studentStudyGrid').innerHTML =
    study.map(renderStudyRoomCard).join('') || '<p>No study rooms available.</p>';

  $('#studentOfficeGrid').innerHTML =
    office.map(renderStudyRoomCard).join('') || '<p>No office hours available.</p>';

  $('#studentTransitGrid').innerHTML =
    transit.map((r) => renderTransitCard(r)).join('') || '<p>No transit lines.</p>';
  await loadReservations();
  await loadNotifications();
}

async function renderLecturerView() {
  const office = await loadResources();
  $('#lecturerResourceGrid').innerHTML =
    office.map((r) => renderManagedBookableCard(r)).join('') ||
    '<p>No office hours yet. Add one above.</p>';
}

async function renderDriverView() {
  const transit = await loadResources();
  $('#driverResourceGrid').innerHTML =
    transit.map((r) => renderTransitCard(r, { manage: true })).join('') ||
    '<p>No lines yet. Add one above.</p>';
}

function renderAdminFormFields() {
  const fields = $('#adminFormFields');
  if (adminTab === 'transit') {
    fields.innerHTML = `
      <input type="text" id="adminName" placeholder="Name" required />
      <input type="text" id="adminSchedule" placeholder="Schedule" required />`;
    $('#adminSubmitBtn').textContent = 'Add';
  } else if (adminTab === 'office') {
    fields.innerHTML = `
      <input type="text" id="adminName" placeholder="Name" required />
      <input type="number" id="adminCapacity" placeholder="Capacity" min="1" required />`;
    $('#adminSubmitBtn').textContent = 'Add';
  } else {
    fields.innerHTML = `
      <input type="text" id="adminName" placeholder="Name" required />
      <input type="number" id="adminCapacity" placeholder="Capacity" min="1" required />`;
    $('#adminSubmitBtn').textContent = 'Add';
  }
}

async function renderAdminView() {
  renderAdminFormFields();
  const all = await loadResources();
  let list = all;
  if (adminTab === 'office') list = all.filter((r) => r.resourceType === TYPES.OFFICE);
  else if (adminTab === 'study') list = all.filter((r) => r.resourceType === TYPES.STUDY);
  else list = all.filter((r) => r.resourceType === TYPES.TRANSIT);

  $('#adminResourceGrid').innerHTML = list.length
    ? list
        .map((r) =>
          r.resourceType === TYPES.TRANSIT
            ? renderTransitCard(r, { manage: true })
            : renderManagedBookableCard(r)
        )
        .join('')
    : '<p>None in this category.</p>';
}



async function handleBook(resourceId, waitlist = false) {
  const { res, body } = await api('/reservations', {
    method: 'POST',
    body: JSON.stringify({ resourceId, waitlist }),
  });
  if (res.status === 201) {
    showToast(body.waitlisted ? 'Added to waitlist.' : 'Booking confirmed!', 'success');
    await refreshDashboard();
    return;
  }
  if (res.status === 409 && body.canWaitlist) {
    showToast('Full — use Join Waitlist.', 'warn');
    return;
  }
  showToast(body.error || 'Booking failed', 'error');
}

async function handleCancel(reservationId) {
  const { res, body } = await api(`/reservations/${reservationId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast(body.promoted ? 'Canceled. Next student promoted and notified.' : 'Reservation canceled.', 'success');
    await refreshDashboard();
  } else {
    showToast(body.error || 'Cancel failed', 'error');
  }
}

async function deleteResource(id) {
  if (!confirm('Remove this resource? Affected students will be notified.')) return;
  const { res, body } = await api(`/resources/${id}`, { method: 'DELETE' });
  if (res.ok || res.status === 204) {
    showToast('Removed. Notifications sent.', 'success');
    await refreshDashboard();
  } else {
    showToast(body.error || 'Delete failed', 'error');
  }
}

async function updateResource(id, currentName, currentCapacity, resourceType) {
  const resourceName = prompt('New Name', decodeURIComponent(currentName));
  if (resourceName === null) return;

  const payload = { resourceName: resourceName.trim() };

  const capStr = prompt('New Capacity', currentCapacity);
  if (capStr === null) return;
  payload.maxCapacity = parseInt(capStr, 10);
  if (Number.isNaN(payload.maxCapacity) || payload.maxCapacity < 1) {
    showToast('Invalid capacity', 'error');
    return;
  }

  const { res, body } = await api(`/resources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    showToast('Updated. Booked students notified.', 'success');
    await refreshDashboard();
  } else {
    showToast(body.error || 'Update failed', 'error');
  }
}

async function refreshDashboard() {
  if (!state.user) return;
  const screen = screenForRole(state.user.role);
  if (screen === 'studentScreen') await renderStudentView();
  else if (screen === 'lecturerScreen') await renderLecturerView();
  else if (screen === 'driverScreen') await renderDriverView();
  else if (screen === 'adminScreen') await renderAdminView();
}

async function login(email, password) {
  const { res, body } = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    showToast(body.error || 'Login failed', 'error');
    return;
  }
  setAuth(body.token, body.user);
  updateHeader();
  showScreen(screenForRole(body.user.role));
  await refreshDashboard();
}

document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const id = parseInt(action.dataset.id, 10);
  switch (action.dataset.action) {
    case 'book':
      await handleBook(id, false);
      break;

    case 'waitlist':
      await handleBook(id, true);
      break;
    case 'cancel':
      await handleCancel(id);
      break;
    case 'delete-resource':
      await deleteResource(id);
      break;
    case 'update-resource':
      await updateResource(id, action.dataset.name, action.dataset.capacity, action.dataset.type);
      break;
  }
});

$('#loginForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  login($('#loginEmail').value.trim(), $('#loginPassword').value);
});



$('#lecturerResourceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { res, body } = await api('/resources', {
    method: 'POST',
    body: JSON.stringify({
      resourceName: $('#lecturerResourceName').value.trim(),
      maxCapacity: parseInt($('#lecturerMaxCapacity').value, 10),
      resourceType: TYPES.OFFICE,
    }),
  });
  if (res.status === 201) {
    showToast('Office hours created', 'success');
    e.target.reset();
    await renderLecturerView();
  } else showToast(body.error || 'Create failed', 'error');
});

$('#driverResourceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { res, body } = await api('/resources', {
    method: 'POST',
    body: JSON.stringify({
      resourceName: $('#driverLineName').value.trim(),
      scheduleInfo: $('#driverSchedule').value.trim(),
      resourceType: TYPES.TRANSIT,
    }),
  });
  if (res.status === 201) {
    showToast('Line added', 'success');
    e.target.reset();
    await renderDriverView();
  } else showToast(body.error || 'Create failed', 'error');
});

$('#adminResourceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = { resourceName: $('#adminName').value.trim() };
  if (adminTab === 'transit') {
    payload.scheduleInfo = $('#adminSchedule').value.trim();
    payload.resourceType = TYPES.TRANSIT;
  } else if (adminTab === 'office') {
    payload.resourceType = TYPES.OFFICE;
    payload.maxCapacity = parseInt($('#adminCapacity').value, 10);
  } else {
    payload.maxCapacity = parseInt($('#adminCapacity').value, 10);
    payload.resourceType = TYPES.STUDY;
  }
  const { res, body } = await api('/resources', { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 201) {
    showToast('Created', 'success');
    e.target.reset();
    await renderAdminView();
  } else showToast(body.error || 'Create failed', 'error');
});

$('#adminTabs')?.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  $$('#adminTabs .tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  adminTab = tab.dataset.tab;
  renderAdminView();
});

$('#studentTabs')?.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  $$('#studentTabs .tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  $$('#studentStudyPanel, #studentOfficePanel, #studentTransitPanel').forEach((p) => p.classList.add('hidden'));
  if (tab.dataset.tab === 'study') $('#studentStudyPanel').classList.remove('hidden');
  else if (tab.dataset.tab === 'office') $('#studentOfficePanel').classList.remove('hidden');
  else if (tab.dataset.tab === 'transit') $('#studentTransitPanel').classList.remove('hidden');
});

$('#logoutBtn')?.addEventListener('click', () => {
  clearAuth();
  updateHeader();
  showScreen('loginScreen');
});

async function bootstrap() {
  if (state.token && state.user) {
    updateHeader();
    showScreen(screenForRole(state.user.role));
    await refreshDashboard();
  }
}

bootstrap();
