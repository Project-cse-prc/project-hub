/**
 * sheets.js - Google Sheets data fetcher (JSONP, works from file://)
 *
 * Sheet columns (A-F):
 * A - Project Title
 * B - Description
 * C - Team Members (comma-separated)
 * D - Category/Tags (comma-separated)
 * E - Project Status ("In Progress" | "Completed")
 * F - PDF Link
 */

const SHEET_ID = '1Wp4nw5eH4GxmHYNKqf7OGIhvNPgbAKr5cmzSDQlObmE';
const TABS = ['S2', 'S6', 'S8'];

const ICON_POOL = {
  S2: ['🤖', '🌱', '📚', '💬', '🔬', '💡', '🎯', '🧩', '📷', '🌍'],
  S6: ['🛒', '🚗', '🏥', '📊', '🔐', '🌐', '⚙️', '📱', '🔎', '🗂️'],
  S8: ['🧠', '🌾', '📡', '🎓', '🗺️', '🔭', '🛡️', '🎨', '🚀', '💎'],
};

function normalizeUrl(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return 'https://' + value;
  return '';
}

function extractUrlFromText(text) {
  const value = String(text || '').trim();
  if (!value) return '';

  const direct = normalizeUrl(value);
  if (direct) return direct;

  const match = value.match(/https?:\/\/[^\s"'<>)]*/i);
  return match ? normalizeUrl(match[0]) : '';
}

function extractPdfLink(cellObj) {
  if (!cellObj) return '';

  const fromV = extractUrlFromText(cellObj.v);
  if (fromV) return fromV;

  const fromF = extractUrlFromText(cellObj.f);
  if (fromF) return fromF;

  return '';
}

function parseTable(tableData, tab) {
  const rows = tableData?.rows ?? [];
  const pool = ICON_POOL[tab] ?? ['📁'];

  return rows
    .filter((row) => row.c && row.c[0] && row.c[0].v)
    .map((row, idx) => {
      const cell = (i) => (row.c[i] && row.c[i].v != null ? String(row.c[i].v).trim() : '');

      return {
        class: tab,
        icon: pool[idx % pool.length],
        title: cell(0),
        desc: cell(1),
        members: cell(2).split(',').map((s) => s.trim()).filter(Boolean),
        tags: cell(3).split(',').map((s) => s.trim()).filter(Boolean),
        status: cell(4) || 'In Progress',
        pdfLink: extractPdfLink(row.c[5]),
      };
    });
}

function fetchTabJsonp(tab) {
  return new Promise((resolve, reject) => {
    const cbName = '__sheetsCallback_' + tab + '_' + Date.now();

    const url =
      'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
      '/gviz/tq?tqx=responseHandler:' + cbName +
      '&sheet=' + encodeURIComponent(tab);

    const cleanup = (script) => {
      delete window[cbName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup(script);
      reject(new Error('Timeout fetching tab ' + tab));
    }, 10000);

    window[cbName] = (response) => {
      clearTimeout(timer);
      cleanup(script);
      try {
        resolve(parseTable(response.table, tab));
      } catch (err) {
        reject(err);
      }
    };

    script.src = url;
    script.onerror = () => {
      clearTimeout(timer);
      cleanup(script);
      reject(new Error('Script load error for tab ' + tab));
    };
    document.head.appendChild(script);
  });
}

async function loadAllProjects() {
  const results = await Promise.all(TABS.map(fetchTabJsonp));
  return results.flat();
}
