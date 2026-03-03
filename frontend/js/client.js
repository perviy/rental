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
    </div>`;
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
