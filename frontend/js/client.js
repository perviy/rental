const API = '/api';

// ── Router ────────────────────────────────────────────────────────────────
const path = window.location.pathname;
const isDetail = path.includes('apartment.html');

document.addEventListener('DOMContentLoaded', () => {
  if (isDetail) {
    initDetailPage();
  } else {
    initListPage();
  }
});

// ── List Page ─────────────────────────────────────────────────────────────
let currentPage = 1;
let currentFilters = {};

function initListPage() {
  try { initMap(); } catch (e) { console.warn('Map init failed:', e); }
  loadApartments(1, {});

  document.getElementById('filterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    currentFilters = {};
    for (const [k, v] of data.entries()) {
      if (v.trim()) currentFilters[k] = v.trim();
    }
    loadApartments(1, currentFilters);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('filterForm').reset();
    currentFilters = {};
    loadApartments(1, {});
  });
}

async function loadApartments(page, filters) {
  setLoading(true);
  currentPage = page;

  const params = new URLSearchParams({ page, per_page: 12, ...filters });

  try {
    const res = await fetch(`${API}/apartments?${params}`);
    const data = await res.json();

    renderApartments(data.apartments);
    renderPagination(data.pages, page);
    addMapMarkers(data.apartments);
  } catch (err) {
    console.error(err);
    document.getElementById('apartmentsGrid').innerHTML =
      '<p style="color:red;grid-column:1/-1">Помилка завантаження даних</p>';
  } finally {
    setLoading(false);
  }
}

function renderApartments(apartments) {
  const grid = document.getElementById('apartmentsGrid');
  const empty = document.getElementById('emptyState');

  if (!apartments.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = apartments.map(apt => {
    const thumb = apt.images?.[0]?.url;
    const imageHtml = thumb
      ? `<img class="apt-card-image" src="${thumb}" alt="Квартира" loading="lazy" />`
      : `<div class="apt-card-image-placeholder">🏠</div>`;

    return `
      <a class="apt-card" href="/client/apartment.html?id=${apt.id}">
        ${imageHtml}
        <div class="apt-card-body">
          <div class="apt-card-address">вул. ${apt.street}, буд. ${apt.building}</div>
          <div class="apt-card-city">${apt.city}, ${apt.region} обл.</div>
          <div class="apt-card-tags">
            <span class="tag">${apt.rooms} кімн.</span>
            <span class="tag">${apt.area} м²</span>
            <span class="tag">${apt.floor} поверх</span>
          </div>
          <div class="apt-card-phone">📞 ${apt.phone}</div>
        </div>
      </a>`;
  }).join('');
}

function renderPagination(totalPages, current) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = '';

  if (current > 1) {
    html += `<button class="page-btn" onclick="loadApartments(${current - 1}, currentFilters)">‹</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || i === totalPages ||
      (i >= current - 2 && i <= current + 2)
    ) {
      html += `<button class="page-btn ${i === current ? 'active' : ''}"
        onclick="loadApartments(${i}, currentFilters)">${i}</button>`;
    } else if (i === current - 3 || i === current + 3) {
      html += `<span class="page-btn" style="cursor:default">…</span>`;
    }
  }

  if (current < totalPages) {
    html += `<button class="page-btn" onclick="loadApartments(${current + 1}, currentFilters)">›</button>`;
  }

  el.innerHTML = html;
}

// ── Map ───────────────────────────────────────────────────────────────────
let map = null;
let aptMarkers = [];
let markerBatchId = 0;
const geoCache = {};

function initMap() {
  map = L.map('map').setView([49.0, 31.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  if (typeof L.Control.geocoder === 'function') {
    L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: 'Пошук адреси...',
      errorMessage: 'Адресу не знайдено',
    }).on('markgeocode', (e) => {
      map.fitBounds(e.geocode.bbox);
    }).addTo(map);
  }
}

function clearAptMarkers() {
  aptMarkers.forEach(m => map.removeLayer(m));
  aptMarkers = [];
}

async function geocodeAddress(key) {
  if (geoCache[key]) return geoCache[key];

  const stored = localStorage.getItem('geo:' + key);
  if (stored) {
    try {
      const coords = JSON.parse(stored);
      geoCache[key] = coords;
      return coords;
    } catch (_) {}
  }

  try {
    const q = encodeURIComponent(key + ', Україна');
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=uk`
    );
    const data = await res.json();
    if (data.length > 0) {
      const coords = { lat: +data[0].lat, lng: +data[0].lon };
      geoCache[key] = coords;
      localStorage.setItem('geo:' + key, JSON.stringify(coords));
      return coords;
    }
  } catch (e) {
    console.warn('Geocode failed:', key);
  }
  return null;
}

async function addMapMarkers(apartments) {
  if (!map) return;
  clearAptMarkers();
  const batchId = ++markerBatchId;
  let firstSet = false;

  for (let i = 0; i < apartments.length; i++) {
    if (batchId !== markerBatchId) return;

    const apt = apartments[i];
    const key = `вул. ${apt.street} ${apt.building}, ${apt.city}`;

    const fromCache = geoCache[key] || (() => {
      const s = localStorage.getItem('geo:' + key);
      return s ? JSON.parse(s) : null;
    })();

    let coords = fromCache;
    if (!coords) {
      if (i > 0) await new Promise(r => setTimeout(r, 350));
      if (batchId !== markerBatchId) return;
      coords = await geocodeAddress(key);
    } else {
      geoCache[key] = coords;
    }

    if (!coords || batchId !== markerBatchId || !map) continue;

    const marker = L.marker([coords.lat, coords.lng]).bindPopup(`
      <div style="min-width:190px;line-height:1.5">
        <strong>вул. ${escapeHtml(apt.street)}, буд. ${escapeHtml(apt.building)}</strong><br>
        <span style="color:#64748b;font-size:.85em">${escapeHtml(apt.city)}, ${escapeHtml(apt.region)} обл.</span><br>
        <span>${apt.rooms} кімн. · ${apt.area} м²</span><br>
        <a href="/client/apartment.html?id=${apt.id}" style="color:#2563eb;font-weight:600">Детальніше →</a>
      </div>`).addTo(map);

    aptMarkers.push(marker);

    if (!firstSet) {
      map.setView([coords.lat, coords.lng], 13);
      firstSet = true;
    }
  }
}

function setLoading(on) {
  document.getElementById('loader').style.display = on ? 'flex' : 'none';
}

// ── Detail Page ───────────────────────────────────────────────────────────
async function initDetailPage() {
  const id = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('aptDetail');

  if (!id) {
    container.innerHTML = '<p>Квартиру не знайдено</p>';
    return;
  }

  try {
    const res = await fetch(`${API}/apartments/${id}`);
    if (!res.ok) throw new Error('Not found');
    const apt = await res.json();
    document.title = `вул. ${apt.street}, буд. ${apt.building} — Оренда`;
    container.innerHTML = renderDetail(apt);
    initGallery(apt.images);
    initDetailMap(apt);
  } catch {
    container.innerHTML = '<p>Квартиру не знайдено</p>';
  }
}

function renderDetail(apt) {
  const mainImg = apt.images?.[0]?.url;
  const galleryHtml = mainImg
    ? `<img class="gallery-main" id="galleryMain" src="${mainImg}" alt="Фото" />`
    : `<div class="gallery-main" style="display:flex;align-items:center;justify-content:center;font-size:5rem;background:#e2e8f0">🏠</div>`;

  const thumbsHtml = apt.images?.length > 1
    ? `<div class="gallery-thumbs">${apt.images.map((img, i) =>
        `<img class="gallery-thumb ${i === 0 ? 'active' : ''}" src="${img.url}" data-src="${img.url}" />`
      ).join('')}</div>`
    : '';

  const featuresHtml = apt.features
    ? `<div class="features-section">
        <h3>Додаткова інформація</h3>
        <p class="features-text">${escapeHtml(apt.features)}</p>
       </div>`
    : '';

  return `
    <div class="apt-detail">
      <a href="/" class="back-link">← Назад до списку</a>
      <div class="apt-detail-grid">
        <div>
          <div class="gallery">
            ${galleryHtml}
            ${thumbsHtml}
          </div>
          ${featuresHtml}
        </div>
        <div>
          <div class="info-card">
            <div class="info-card-title">вул. ${escapeHtml(apt.street)}, буд. ${escapeHtml(apt.building)}, кв. ${escapeHtml(apt.apt_number)}</div>
            <div style="color:var(--color-text-muted);font-size:0.9rem;margin-bottom:1rem">
              ${escapeHtml(apt.city)}, ${escapeHtml(apt.region)} обл.
            </div>
            <div class="info-specs">
              <div class="spec-item">
                <div class="spec-label">Площа</div>
                <div class="spec-value">${apt.area} м²</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Кімнати</div>
                <div class="spec-value">${apt.rooms}</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Поверх</div>
                <div class="spec-value">${apt.floor}</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Фото</div>
                <div class="spec-value">${apt.images?.length || 0}</div>
              </div>
            </div>
            <div class="contact-block">
              <div class="contact-label">Телефон власника</div>
              <a class="contact-phone" href="tel:${apt.phone}">${escapeHtml(apt.phone)}</a>
              <a class="call-btn" href="tel:${apt.phone}">📞 Зателефонувати</a>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-map-section">
        <h3 class="detail-map-title">Розташування</h3>
        <div id="detailMap"></div>
      </div>
    </div>`;
}

async function initDetailMap(apt) {
  const el = document.getElementById('detailMap');
  if (!el || typeof L === 'undefined') return;

  const key = `вул. ${apt.street} ${apt.building}, ${apt.city}`;
  const coords = await geocodeAddress(key);

  if (!coords) {
    el.parentElement.style.display = 'none';
    return;
  }

  const detailMap = L.map('detailMap').setView([coords.lat, coords.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(detailMap);

  L.marker([coords.lat, coords.lng])
    .bindPopup(`<strong>вул. ${escapeHtml(apt.street)}, буд. ${escapeHtml(apt.building)}</strong><br>${escapeHtml(apt.city)}, ${escapeHtml(apt.region)} обл.`)
    .addTo(detailMap)
    .openPopup();
}

function initGallery(images) {
  if (!images?.length) return;
  const main = document.getElementById('galleryMain');
  if (!main) return;

  document.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      main.src = thumb.dataset.src;
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
