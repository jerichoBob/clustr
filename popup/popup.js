// Cluster MV3 - Popup JavaScript (Quick Search)

let allTabs = [];
let filteredTabs = [];
let selectedIndex = 0;
let windowMap = {};

const searchInput = document.getElementById('search');
const tabCountEl = document.getElementById('tabCount');
const resultsEl = document.getElementById('results');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load theme
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
  applyTheme(settings.darkMode);
  
  // Load tabs
  await loadTabs();
  
  // Setup listeners
  searchInput.addEventListener('input', handleSearch);
  searchInput.addEventListener('keydown', handleKeydown);
  document.getElementById('openManager').addEventListener('click', openManager);
  
  // Focus search
  searchInput.focus();
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

async function loadTabs() {
  const windows = await chrome.windows.getAll({ populate: true });
  
  // Build window map and flatten tabs
  allTabs = [];
  windows.forEach((win, idx) => {
    windowMap[win.id] = `Window ${idx + 1}`;
    win.tabs.forEach(tab => {
      allTabs.push({
        ...tab,
        windowName: windowMap[win.id]
      });
    });
  });
  
  tabCountEl.textContent = allTabs.length;
  filteredTabs = allTabs;
  renderResults();
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    filteredTabs = allTabs;
  } else {
    filteredTabs = allTabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      return title.includes(query) || url.includes(query);
    });
  }
  
  selectedIndex = 0;
  renderResults();
}

function handleKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredTabs.length - 1);
      renderResults();
      scrollToSelected();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults();
      scrollToSelected();
      break;
      
    case 'Enter':
      e.preventDefault();
      if (filteredTabs[selectedIndex]) {
        navigateToTab(filteredTabs[selectedIndex]);
      }
      break;
      
    case 'Escape':
      window.close();
      break;
  }
}

function scrollToSelected() {
  const selected = resultsEl.querySelector('.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

function renderResults() {
  if (filteredTabs.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">No matching tabs</div>';
    return;
  }
  
  const query = searchInput.value.toLowerCase().trim();
  
  resultsEl.innerHTML = filteredTabs.slice(0, 50).map((tab, idx) => {
    const title = highlightMatch(tab.title || 'Untitled', query);
    const url = highlightMatch(getDisplayUrl(tab.url), query);
    const favicon = tab.favIconUrl || '';
    
    return `
      <div class="tab-result ${idx === selectedIndex ? 'selected' : ''}"
           data-tab-id="${tab.id}"
           data-window-id="${tab.windowId}"
           onclick="navigateToTab(filteredTabs[${idx}])">
        ${favicon 
          ? `<img class="tab-favicon" src="${escapeHtml(favicon)}" onerror="this.outerHTML='<div class=\\'tab-favicon placeholder\\'>🌐</div>'">`
          : '<div class="tab-favicon placeholder">🌐</div>'
        }
        <div class="tab-info">
          <div class="tab-title">${title}</div>
          <div class="tab-meta">
            <span class="window-badge">${tab.windowName}</span>
            <span class="tab-url">${url}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function navigateToTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

async function openManager() {
  await chrome.runtime.sendMessage({ action: 'openManager' });
  window.close();
}

// Utility functions
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getDisplayUrl(url) {
  try {
    const u = new URL(url);
    let display = u.hostname;
    if (u.pathname !== '/') {
      display += u.pathname;
    }
    return display.length > 50 ? display.substring(0, 47) + '...' : display;
  } catch {
    return url;
  }
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Make navigateToTab available globally for onclick
window.navigateToTab = navigateToTab;
window.filteredTabs = filteredTabs;
