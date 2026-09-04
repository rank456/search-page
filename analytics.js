(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycby1NCoFRael5KDBlI7qsDo6ETOBnaa8dl8BZcnQb-bYSY4TgCwbuxR-uS7scIxvpmIN/exec';
  const APP_VERSION = '2.1';
  const SEARCH_DEBOUNCE_MS = 800;
  const DUPLICATE_WINDOW_MS = 30000;
  const PAGE_VIEW_DUPLICATE_MS = 10000;

  const input = document.getElementById('searchInput');
  const tableBody = document.querySelector('#data-table tbody');
  if (!input || !tableBody) return;

  function randomId(prefix) {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') {
        return prefix + '-' + crypto.randomUUID();
      }
    } catch (_) {}
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function getPersistentId(storage, key, prefix) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = randomId(prefix);
        storage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return randomId(prefix);
    }
  }

  const deviceId = getPersistentId(localStorage, 'searchToolDeviceId', 'dev');
  const sessionId = getPersistentId(sessionStorage, 'searchToolSessionId', 'ses');
  const recentSearches = new Map();
  let searchTimer = null;

  function send(payload) {
    const body = JSON.stringify({
      deviceId,
      sessionId,
      page: location.pathname || '/',
      version: APP_VERSION,
      ...payload
    });

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body
      }).catch(() => {});
    } catch (_) {}
  }

  function sendPageViewOnce() {
    const key = 'searchToolLastPageViewAt';
    const now = Date.now();
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (now - last < PAGE_VIEW_DUPLICATE_MS) return;
      sessionStorage.setItem(key, String(now));
    } catch (_) {}
    send({ event: 'page_view' });
  }

  function dataIsReady() {
    try {
      return Array.isArray(records) && records.length > 0;
    } catch (_) {
      return tableBody.children.length > 0;
    }
  }

  function getSearchSnapshot(term) {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const resultCount = rows.length;
    if (resultCount === 0) {
      return { resultCount: 0, matchType: '無結果' };
    }

    const lowerTerm = term.toLowerCase();
    const hasExact = rows.some(row => row.textContent.toLowerCase().includes(lowerTerm));
    return {
      resultCount,
      matchType: hasExact ? '精確' : '聰明'
    };
  }

  function recordSearch() {
    const searchTerm = input.value.trim();
    if (!searchTerm || !dataIsReady()) return;

    const snapshot = getSearchSnapshot(searchTerm);
    const signature = [searchTerm, snapshot.resultCount, snapshot.matchType].join('|');
    const now = Date.now();
    const previousTime = recentSearches.get(signature) || 0;
    if (now - previousTime < DUPLICATE_WINDOW_MS) return;

    recentSearches.set(signature, now);
    if (recentSearches.size > 100) {
      for (const [key, time] of recentSearches) {
        if (now - time > DUPLICATE_WINDOW_MS) recentSearches.delete(key);
      }
    }

    send({
      event: 'search',
      searchTerm,
      resultCount: snapshot.resultCount,
      matchType: snapshot.matchType
    });
  }

  function scheduleSearchRecord() {
    clearTimeout(searchTimer);
    if (!input.value.trim()) return;
    searchTimer = setTimeout(recordSearch, SEARCH_DEBOUNCE_MS);
  }

  input.addEventListener('input', scheduleSearchRecord);
  input.addEventListener('change', recordSearch);
  window.addEventListener('pagehide', () => {
    clearTimeout(searchTimer);
    recordSearch();
  });

  if (document.readyState === 'complete') {
    sendPageViewOnce();
  } else {
    window.addEventListener('load', sendPageViewOnce, { once: true });
  }
})();
