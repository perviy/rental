const API = '/api';
const path = window.location.pathname;

document.addEventListener('DOMContentLoaded', () => {
  if (path.includes('login')) {
    initLogin();
  } else if (path.includes('dashboard')) {
    guardAuth();
    initDashboard();
  }
});

// ── Auth helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('admin_token'); }
function setToken(t) { localStorage.setItem('admin_token', t); }
function clearToken() { localStorage.removeItem('admin_token'); }

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

function guardAuth() {
  if (!getToken()) {
    window.location.href = '/admin/login.html';
  }
}

// ── Login ─────────────────────────────────────────────────────────────────
function initLogin() {
  if (getToken()) { window.location.href = '/admin/dashboard.html'; return; }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Вхід...';

    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: document.getElementById('loginInput').value,
          password: document.getElementById('passwordInput').value,
        }),
      });

      if (res.ok) {
        const { access_token } = await res.json();
        setToken(access_token);
        window.location.href = '/admin/dashboard.html';
      } else {
        errEl.style.display = 'block';
      }
    } catch {
      errEl.style.display = 'block';
      errEl.textContent = 'Помилка зʼєднання';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Увійти';
    }
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────
let currentPage = 1;
let editingId = null;

function initDashboard() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/admin/login.html';
  });

  document.getElementById('addAptBtn').addEventListener('click', () => openModal(null));
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveApartment);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Image upload
  setupImageUpload();

  loadApartments(1);
}

async function loadApartments(page) {
  currentPage = page;
  setLoading(true);

  try {
    const res = await fetch(`${API}/admin/apartments?page=${page}&per_page=20`, {
      headers: authHeaders(),
    });

    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }

    const data = await res.json();
    renderTable(data.apartments);
    renderPagination(data.pages, page);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}

function renderTable(apartments) {
  const tbody = document.getElementById('aptTableBody');
  const wrapper = document.getElementById('tableWrapper');
  const empty = document.getElementById('emptyState');

  if (!apartments.length) {
    wrapper.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';

  tbody.innerHTML = apartments.map(apt => {
    const thumb = apt.images?.[0]?.url;
    const imgHtml = thumb
      ? `<img class="table-thumb" src="${thumb}" alt="" />`
      : `<div class="table-thumb-placeholder">🏠</div>`;

    return `
      <tr>
        <td>${imgHtml}</td>
        <td>${escapeHtml(apt.city)}, вул. ${escapeHtml(apt.street)}, ${escapeHtml(apt.building)}</td>
        <td>${apt.rooms}</td>
        <td>${apt.area} м²</td>
        <td>${apt.floor}</td>
        <td>${escapeHtml(apt.phone)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="openModal(${apt.id})">✏️ Редагувати</button>
            <button class="btn btn-danger btn-sm" onclick="deleteApartment(${apt.id})">🗑 Видалити</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderPagination(totalPages, current) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}"
      onclick="loadApartments(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

// ── Modal ─────────────────────────────────────────────────────────────────
async function openModal(id) {
  editingId = id;
  clearForm();

  if (id) {
    document.getElementById('modalTitle').textContent = 'Редагувати квартиру';
    try {
      const res = await fetch(`${API}/admin/apartments`, { headers: authHeaders() });
      // Fetch single apartment via client route (public)
      const singleRes = await fetch(`${API}/apartments/${id}`);
      const apt = await singleRes.json();
      fillForm(apt);
      document.getElementById('imageSection').style.display = 'block';
      renderExistingImages(apt.images);
    } catch (err) {
      console.error(err);
    }
  } else {
    document.getElementById('modalTitle').textContent = 'Додати квартиру';
    document.getElementById('imageSection').style.display = 'none';
  }

  document.getElementById('modalOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.body.style.overflow = '';
  editingId = null;
  clearForm();
}

function clearForm() {
  const ids = ['city', 'region', 'street', 'building', 'apt_number', 'area', 'rooms', 'floor', 'phone', 'features'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('formError').style.display = 'none';
  document.getElementById('imagesPreview').innerHTML = '';
  document.getElementById('imageFiles').value = '';
}

function fillForm(apt) {
  const fields = { city: apt.city, region: apt.region, street: apt.street, building: apt.building,
    apt_number: apt.apt_number, area: apt.area, rooms: apt.rooms, floor: apt.floor,
    phone: apt.phone, features: apt.features || '' };
  Object.entries(fields).forEach(([k, v]) => {
    const el = document.getElementById(k);
    if (el) el.value = v;
  });
}

async function saveApartment() {
  const btn = document.getElementById('saveBtn');
  const errEl = document.getElementById('formError');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Збереження...';

  const payload = {
    city: document.getElementById('city').value.trim(),
    region: document.getElementById('region').value.trim(),
    street: document.getElementById('street').value.trim(),
    building: document.getElementById('building').value.trim(),
    apt_number: document.getElementById('apt_number').value.trim(),
    area: parseFloat(document.getElementById('area').value),
    rooms: parseInt(document.getElementById('rooms').value),
    floor: parseInt(document.getElementById('floor').value),
    phone: document.getElementById('phone').value.trim(),
    features: document.getElementById('features').value.trim() || null,
  };

  // Validate
  const required = ['city', 'region', 'street', 'building', 'apt_number', 'phone'];
  const missing = required.filter(k => !payload[k]);
  if (missing.length || isNaN(payload.area) || isNaN(payload.rooms) || isNaN(payload.floor)) {
    showError('Заповніть всі обовʼязкові поля');
    btn.disabled = false;
    btn.textContent = 'Зберегти';
    return;
  }

  try {
    const url = editingId
      ? `${API}/admin/apartments/${editingId}`
      : `${API}/admin/apartments`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      showError(JSON.stringify(err));
      return;
    }

    const apt = await res.json();

    // Upload images if new apartment or files selected
    const files = document.getElementById('imageFiles').files;
    if (files.length > 0) {
      await uploadImages(apt.id, files);
    }

    closeModal();
    loadApartments(currentPage);
  } catch (err) {
    showError('Помилка зберігання');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Зберегти';
  }
}

async function deleteApartment(id) {
  if (!confirm('Видалити квартиру? Це також видалить всі фотографії.')) return;

  try {
    const res = await fetch(`${API}/admin/apartments/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) loadApartments(currentPage);
  } catch (err) {
    alert('Помилка видалення');
  }
}

// ── Images ────────────────────────────────────────────────────────────────
function setupImageUpload() {
  const area = document.getElementById('uploadArea');
  const input = document.getElementById('imageFiles');
  const browseBtn = document.getElementById('browseBtn');

  browseBtn.addEventListener('click', () => input.click());
  area.addEventListener('click', (e) => { if (e.target !== browseBtn) input.click(); });

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    handleNewFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', () => handleNewFiles(input.files));
}

function handleNewFiles(files) {
  const preview = document.getElementById('imagesPreview');
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${e.target.result}" alt="" /><span class="preview-delete new-img">✕</span>`;
      div.querySelector('.preview-delete').addEventListener('click', () => div.remove());
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImages(aptId, files) {
  const formData = new FormData();
  Array.from(files).forEach(f => formData.append('images', f));

  const res = await fetch(`${API}/admin/apartments/${aptId}/images`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: formData,
  });

  return res.ok;
}

async function deleteImage(imageId, el) {
  if (!confirm('Видалити фото?')) return;
  try {
    const res = await fetch(`${API}/admin/images/${imageId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) el.closest('.preview-item').remove();
  } catch { alert('Помилка видалення фото'); }
}

function renderExistingImages(images) {
  const preview = document.getElementById('imagesPreview');
  preview.innerHTML = images.map(img => `
    <div class="preview-item">
      <img src="${img.url}" alt="" />
      <button class="preview-delete" onclick="deleteImage(${img.id}, this)">✕</button>
    </div>`).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
}

function setLoading(on) {
  document.getElementById('loader').style.display = on ? 'flex' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
