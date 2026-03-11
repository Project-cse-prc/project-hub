/**
 * app.js - UI logic for filters, card rendering, and detail modal.
 * Depends on: sheets.js (loaded first)
 */

let projects = [];
let currentFilter = 'all';
let currentView = 'grid';

const EXCLUDED_TITLES = new Set([
  'project title',
  'smart attendance system',
  'plant disease detector',
  'library management app',
  'campus chat bot',
  'e-commerce platform',
  'vehicle parking optimizer',
  'hospital appointment app',
  'stock price predictor',
  'secure file vault',
  'mental health companion',
  'smart irrigation system',
  'disaster alert network',
  'ai exam proctoring',
  'campus navigation ar',
]);

const MEMBER_ICON = `
<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2">
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
  <circle cx="9" cy="7" r="4"/>
  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
</svg>`;

const EXTERNAL_LINK_ICON = `
<svg width="11" height="11" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <line x1="7" y1="17" x2="17" y2="7"/>
  <polyline points="7 7 17 7 17 17"/>
</svg>`;

let modalRoot;
let modalCloseBtn;
let modalTitle;
let modalSemester;
let modalDesc;
let modalMembers;
let modalCategory;
let modalStatus;
let modalPdfBtn;
let modalReportEmpty;
let modalTags;
let modalBound = false;
let controlsBound = false;
let activeProject = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePdfUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const openIdMatch = raw.match(/^https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (openIdMatch) {
    return `https://drive.google.com/file/d/${openIdMatch[1]}/view`;
  }

  const ucIdMatch = raw.match(/^https?:\/\/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/i);
  if (ucIdMatch) {
    return `https://drive.google.com/file/d/${ucIdMatch[1]}/view`;
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return 'https://' + raw;
  return '';
}

function isRenderableProject(project) {
  const title = String(project?.title || '').trim();
  if (!title) return false;
  return !EXCLUDED_TITLES.has(title.toLowerCase());
}

function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'completed' || raw === 'done') {
    return { className: 'status-done', label: 'Completed' };
  }
  return { className: 'status-wip', label: 'In Progress' };
}

function categoryText(project) {
  if (!Array.isArray(project.tags) || project.tags.length === 0) {
    return 'Uncategorized';
  }
  return project.tags.join(', ');
}

function memberText(project) {
  if (!Array.isArray(project.members) || project.members.length === 0) {
    return 'No team members listed.';
  }
  return project.members.join(', ');
}

function getCount(cls) {
  return cls === 'all'
    ? projects.length
    : projects.filter((project) => project.class === cls).length;
}

function updateCounts() {
  ['all', 'S2', 'S6', 'S8'].forEach((cls) => {
    document.getElementById('cnt-' + cls).textContent = getCount(cls);
  });

  ['S2', 'S6', 'S8'].forEach((cls) => {
    document.getElementById('fc-' + cls).textContent = getCount(cls);
  });
}

function buildTagHtml(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '<span class="tag">General</span>';
  }

  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
}

function buildModalMemberHtml(project) {
  if (!Array.isArray(project.members) || project.members.length === 0) {
    return '<span class="modal-member-pill">Not Listed</span>';
  }

  return project.members
    .map((member) => `<span class="modal-member-pill">${escapeHtml(member)}</span>`)
    .join('');
}

function buildModalTagHtml(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '<span class="modal-chip">GENERAL</span>';
  }

  return tags
    .map((tag) => `<span class="modal-chip">${escapeHtml(String(tag).toUpperCase())}</span>`)
    .join('');
}

function buildCardBody(project) {
  const status = normalizeStatus(project.status);

  return `
    <h3>${escapeHtml(project.title)}</h3>
    <div class="card-meta">
      <span class="status-badge ${status.className}">${status.label}</span>
    </div>
    <div class="card-divider"></div>
    <div class="members">${MEMBER_ICON} ${escapeHtml(memberText(project))}</div>`;
}

function createCard(project, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.class = project.class;
  card.style.setProperty('--i', index);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Open details for ' + project.title);

  const head = `
    <div class="card-head">
      <span class="sem-badge sem-${project.class}">${project.class}</span>
    </div>`;

  const body = buildCardBody(project);
  card.innerHTML = currentView === 'list'
    ? head + `<div class="card-body">${body}</div>`
    : head + body;

  card.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    openProjectModal(project);
  });

  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProjectModal(project);
    }
  });

  return card;
}

function renderCards(list) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <span class="emoji">No Results</span>
        <p>No projects found for this selection.</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach((project, index) => fragment.appendChild(createCard(project, index)));
  grid.appendChild(fragment);
}

function filter(cls) {
  currentFilter = cls;
  document.querySelectorAll('.f-btn').forEach((btn) => btn.classList.remove('active'));
  document.getElementById('btn-' + cls).classList.add('active');
  const list = cls === 'all' ? projects : projects.filter((project) => project.class === cls);
  renderCards(list);
}

function setView(view) {
  currentView = view;
  const grid = document.getElementById('grid');
  grid.classList.toggle('list-view', view === 'list');
  document.getElementById('vgrid').classList.toggle('active', view === 'grid');
  document.getElementById('vlist').classList.toggle('active', view === 'list');
  filter(currentFilter);
}

function bindControlEvents() {
  if (controlsBound) return;
  controlsBound = true;

  document.getElementById('btn-all').addEventListener('click', () => filter('all'));
  document.getElementById('btn-S2').addEventListener('click', () => filter('S2'));
  document.getElementById('btn-S6').addEventListener('click', () => filter('S6'));
  document.getElementById('btn-S8').addEventListener('click', () => filter('S8'));

  document.getElementById('vgrid').addEventListener('click', () => setView('grid'));
  document.getElementById('vlist').addEventListener('click', () => setView('list'));
}

function showLoader() {
  document.getElementById('grid').innerHTML = `
    <div class="loader-wrap">
      <div class="spinner"></div>
      <p class="loader-text">Loading projects from Google Sheets...</p>
    </div>`;
}

function showError(message) {
  document.getElementById('grid').innerHTML = `
    <div class="empty">
      <span class="emoji">Error</span>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

function initModalRefs() {
  modalRoot = document.getElementById('project-modal');
  modalCloseBtn = document.getElementById('project-modal-close');
  modalTitle = document.getElementById('modal-title');
  modalSemester = document.getElementById('modal-semester');
  modalDesc = document.getElementById('modal-description');
  modalMembers = document.getElementById('modal-members');
  modalCategory = document.getElementById('modal-category');
  modalStatus = document.getElementById('modal-status');
  modalPdfBtn = document.getElementById('modal-pdf-btn');
  modalReportEmpty = document.getElementById('modal-report-empty');
  modalTags = document.getElementById('modal-tags');
}

function closeProjectModal() {
  if (!modalRoot || modalRoot.hidden) return;

  modalRoot.classList.remove('open');
  document.body.classList.remove('modal-open');

  window.setTimeout(() => {
    if (!modalRoot.classList.contains('open')) {
      modalRoot.hidden = true;
    }
  }, 140);
}

function openProjectModal(project) {
  if (!modalRoot) return;

  activeProject = project;
  const status = normalizeStatus(project.status);
  const pdfUrl = normalizePdfUrl(project.pdfLink);

  modalTitle.textContent = project.title || 'Untitled Project';
  modalSemester.textContent = project.class || 'NA';
  modalSemester.className = 'sem-badge sem-' + (project.class || 'S2');

  modalDesc.textContent = project.desc || 'No description available.';
  modalMembers.innerHTML = buildModalMemberHtml(project);
  modalCategory.textContent = categoryText(project).toUpperCase();

  modalStatus.className = 'status-badge ' + status.className;
  modalStatus.textContent = status.label;

  modalTags.innerHTML = buildModalTagHtml(project.tags);

  if (pdfUrl) {
    modalPdfBtn.href = pdfUrl;
    modalPdfBtn.hidden = false;
    modalReportEmpty.hidden = true;
  } else {
    modalPdfBtn.removeAttribute('href');
    modalPdfBtn.hidden = true;
    modalReportEmpty.hidden = false;
  }

  modalRoot.hidden = false;
  document.body.classList.add('modal-open');
  window.requestAnimationFrame(() => {
    modalRoot.classList.add('open');
  });
}

function bindModalEvents() {
  if (modalBound || !modalRoot) return;
  modalBound = true;

  modalCloseBtn.addEventListener('click', closeProjectModal);

  modalRoot.addEventListener('click', (event) => {
    if (event.target === modalRoot) {
      closeProjectModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalRoot && !modalRoot.hidden) {
      closeProjectModal();
    }
  });

  modalPdfBtn.addEventListener('click', (event) => {
    const url = normalizePdfUrl(modalPdfBtn.getAttribute('href') || activeProject?.pdfLink);
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.assign(url);
    }
  });
}

async function init() {
  bindControlEvents();
  initModalRefs();
  bindModalEvents();

  showLoader();

  try {
    const loaded = await loadAllProjects();
    projects = loaded.filter(isRenderableProject);
    updateCounts();
    filter('all');
  } catch (err) {
    console.error('Sheets fetch error:', err);
    showError('Could not load projects. Check your internet connection and sheet permissions.');
  }
}

init();
