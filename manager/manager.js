// Cluster MV3 - Manager JavaScript
// Full-page kanban interface with drag-drop

// State
let allWindows = [];
let savedSessions = [];
let recentlyClosed = [];
let searchQuery = '';
let currentWindowId = null;
let managerTabId = null;

// Drag state
let draggedTab = null;
let draggedElement = null;
let dragPlaceholder = null;

// Window to save (for modal)
let windowToSave = null;

// DOM Elements
const searchInput = document.getElementById('search');
const tabCountEl = document.getElementById('tabCount');
const windowsContainer = document.getElementById('windowsContainer');
const newWindowZone = document.getElementById('newWindowZone');
const sessionsListEl = document.getElementById('sessionsList');
const recentlyClosedListEl = document.getElementById('recentlyClosedList');
const themeSelect = document.getElementById('themeSelect');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get current tab ID (this manager tab)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  managerTabId = tab.id;
  
  // Get current window
  const currentWindow = await chrome.windows.getCurrent();
  currentWindowId = currentWindow.id;
  
  // Load settings and apply theme
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
  applyTheme(settings.darkMode);
  themeSelect.value = settings.darkMode;
  
  // Load all data
  await Promise.all([
    loadWindows(),
    loadSessions(),
    loadRecentlyClosed()
  ]);
  
  // Set up event listeners
  setupEventListeners();
  
  // Focus search
  searchInput.focus();
  
  // Auto-refresh
  setInterval(loadWindows, 2000);
}

function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderWindows();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // Export button
  document.getElementById('btnExport').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('hidden');
  });

  // Settings button
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
  });

  // Export actions
  document.getElementById('exportCsv').addEventListener('click', exportToCsv);
  document.getElementById('exportJson').addEventListener('click', exportToJson);

  // Save session modal
  document.getElementById('confirmSaveSession').addEventListener('click', confirmSaveSession);
  document.getElementById('sessionName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmSaveSession();
  });

  // Theme select
  themeSelect.addEventListener('change', async (e) => {
    const theme = e.target.value;
    applyTheme(theme);
    await chrome.runtime.sendMessage({ action: 'updateSettings', settings: { darkMode: theme } });
  });

  // New window drop zone
  newWindowZone.addEventListener('dragover', handleNewWindowDragOver);
  newWindowZone.addEventListener('dragleave', handleNewWindowDragLeave);
  newWindowZone.addEventListener('drop', handleNewWindowDrop);

  // Event delegation for dynamically rendered elements
  // Windows container - handles tabs and window actions
  windowsContainer.addEventListener('click', handleWindowsContainerClick);
  windowsContainer.addEventListener('dragstart', handleWindowsContainerDragStart);
  windowsContainer.addEventListener('dragend', handleDragEnd);
  windowsContainer.addEventListener('dragover', handleWindowsContainerDragOver);
  windowsContainer.addEventListener('dragleave', handleWindowsContainerDragLeave);
  windowsContainer.addEventListener('drop', handleWindowsContainerDrop);

  // Sessions list - handles session clicks
  sessionsListEl.addEventListener('click', handleSessionsClick);

  // Recently closed list - handles restore clicks
  recentlyClosedListEl.addEventListener('click', handleRecentlyClosedClick);

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });
}

// Event delegation handlers
function handleWindowsContainerClick(e) {
  // Check for tab action buttons first (they have stopPropagation behavior)
  const suspendBtn = e.target.closest('.tab-btn[data-action="suspend-tab"]');
  if (suspendBtn) {
    const tabId = parseInt(suspendBtn.dataset.tabId);
    suspendTab(tabId);
    return;
  }

  const closeTabBtn = e.target.closest('.tab-btn[data-action="close-tab"]');
  if (closeTabBtn) {
    const tabId = parseInt(closeTabBtn.dataset.tabId);
    closeTab(tabId);
    return;
  }

  // Check for window action buttons
  const saveBtn = e.target.closest('.window-btn[data-action="save-session"]');
  if (saveBtn) {
    const windowId = parseInt(saveBtn.dataset.windowId);
    saveWindowSession(windowId);
    return;
  }

  const suspendWindowBtn = e.target.closest('.window-btn[data-action="suspend-window"]');
  if (suspendWindowBtn) {
    const windowId = parseInt(suspendWindowBtn.dataset.windowId);
    suspendWindow(windowId);
    return;
  }

  const closeWindowBtn = e.target.closest('.window-btn[data-action="close-window"]');
  if (closeWindowBtn) {
    const windowId = parseInt(closeWindowBtn.dataset.windowId);
    closeWindow(windowId);
    return;
  }

  // Check for tab card click (navigate to tab)
  const tabCard = e.target.closest('.tab-card');
  if (tabCard && !draggedTab) {
    const tabId = parseInt(tabCard.dataset.tabId);
    const windowId = parseInt(tabCard.dataset.windowId);
    navigateToTab(tabId, windowId);
    return;
  }
}

function handleWindowsContainerDragStart(e) {
  const tabCard = e.target.closest('.tab-card');
  if (tabCard) {
    const tabId = parseInt(tabCard.dataset.tabId);
    const windowId = parseInt(tabCard.dataset.windowId);
    handleDragStart(e, tabId, windowId, tabCard);
  }
}

function handleWindowsContainerDragOver(e) {
  const column = e.target.closest('.window-column');
  if (column && draggedTab) {
    const windowId = parseInt(column.dataset.windowId);
    handleWindowDragOver(e, windowId, column);
  }
}

function handleWindowsContainerDragLeave(e) {
  const column = e.target.closest('.window-column');
  if (column) {
    handleWindowDragLeave(e, column);
  }
}

function handleWindowsContainerDrop(e) {
  const column = e.target.closest('.window-column');
  if (column && draggedTab) {
    const windowId = parseInt(column.dataset.windowId);
    handleWindowDrop(e, windowId, column);
  }
}

function handleSessionsClick(e) {
  // Check for delete button first
  const deleteBtn = e.target.closest('.chip-close');
  if (deleteBtn) {
    const sessionId = deleteBtn.dataset.sessionId;
    deleteSession(sessionId);
    return;
  }

  // Check for session chip click
  const sessionChip = e.target.closest('.session-chip');
  if (sessionChip) {
    const sessionId = sessionChip.dataset.sessionId;
    restoreSession(sessionId);
  }
}

function handleRecentlyClosedClick(e) {
  const closedChip = e.target.closest('.closed-chip');
  if (closedChip) {
    const sessionId = closedChip.dataset.sessionId;
    restoreClosedItem(sessionId);
  }
}

// Theme
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Load windows and tabs
async function loadWindows() {
  allWindows = await chrome.windows.getAll({ populate: true });
  
  // Filter out manager tab from its window
  allWindows = allWindows.map(w => ({
    ...w,
    tabs: w.tabs.filter(t => t.id !== managerTabId)
  }));
  
  renderWindows();
}

// Load saved sessions
async function loadSessions() {
  savedSessions = await chrome.runtime.sendMessage({ action: 'getSessions' });
  renderSessions();
}

// Load recently closed
async function loadRecentlyClosed() {
  recentlyClosed = await chrome.runtime.sendMessage({ action: 'getRecentlyClosed' });
  renderRecentlyClosed();
}

// Render windows
function renderWindows() {
  const filteredWindows = filterWindows();
  const totalTabs = allWindows.reduce((sum, w) => sum + w.tabs.length, 0);
  const visibleTabs = filteredWindows.reduce((sum, w) => sum + w.tabs.length, 0);
  
  tabCountEl.textContent = searchQuery 
    ? `${visibleTabs}/${totalTabs} tabs`
    : `${totalTabs} tabs`;
  
  if (filteredWindows.length === 0 && searchQuery) {
    windowsContainer.innerHTML = `
      <div class="no-results">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <div>No tabs matching "${escapeHtml(searchQuery)}"</div>
      </div>
    `;
    return;
  }
  
  windowsContainer.innerHTML = filteredWindows.map((window, idx) => {
    const isCurrent = window.id === currentWindowId;
    const windowName = isCurrent ? 'Current Window' : `Window ${idx + 1}`;

    return `
      <div class="window-column ${isCurrent ? 'current' : ''}" data-window-id="${window.id}">
        <div class="window-header">
          <div class="window-indicator"></div>
          <span class="window-title">${windowName}</span>
          <span class="window-badge">${window.tabs.length}</span>
          <div class="window-actions">
            <button class="window-btn" title="Save as session" data-action="save-session" data-window-id="${window.id}">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
            </button>
            <button class="window-btn" title="Suspend all" data-action="suspend-window" data-window-id="${window.id}">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
              </svg>
            </button>
            ${!isCurrent ? `
              <button class="window-btn danger" title="Close window" data-action="close-window" data-window-id="${window.id}">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="tabs-container" data-window-id="${window.id}">
          ${window.tabs.map(tab => renderTab(tab)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderTab(tab) {
  const title = highlightMatch(tab.title || 'Untitled', searchQuery);
  const url = highlightMatch(getDisplayUrl(tab.url), searchQuery);
  const favicon = tab.favIconUrl || '';

  return `
    <div class="tab-card ${tab.active ? 'active' : ''} ${tab.discarded ? 'discarded' : ''} ${tab.pinned ? 'pinned' : ''}"
         data-tab-id="${tab.id}"
         data-window-id="${tab.windowId}"
         draggable="true">
      ${favicon
        ? `<img class="tab-favicon" src="${escapeHtml(favicon)}" data-fallback="true">`
        : '<div class="tab-favicon placeholder">🌐</div>'
      }
      <div class="tab-info">
        <div class="tab-title">${title}</div>
        <div class="tab-url">${url}</div>
      </div>
      <div class="tab-actions">
        <button class="tab-btn" title="Suspend" data-action="suspend-tab" data-tab-id="${tab.id}">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
          </svg>
        </button>
        <button class="tab-btn danger" title="Close" data-action="close-tab" data-tab-id="${tab.id}">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// Render saved sessions
function renderSessions() {
  if (savedSessions.length === 0) {
    sessionsListEl.innerHTML = '<span class="empty-state">No saved sessions</span>';
    return;
  }

  sessionsListEl.innerHTML = savedSessions.map(session => `
    <div class="session-chip" data-session-id="${session.id}">
      <span>${escapeHtml(session.name)}</span>
      <span class="chip-count">${session.tabs.length}</span>
      <button class="chip-close" data-session-id="${session.id}" title="Delete">
        <svg viewBox="0 0 24 24" width="10" height="10">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Render recently closed
function renderRecentlyClosed() {
  if (recentlyClosed.length === 0) {
    recentlyClosedListEl.innerHTML = '<span class="empty-state">No recently closed</span>';
    return;
  }

  recentlyClosedListEl.innerHTML = recentlyClosed.slice(0, 8).map(item => {
    if (item.tab) {
      return `
        <div class="closed-chip" data-session-id="${item.tab.sessionId}">
          <span>${escapeHtml(truncate(item.tab.title || 'Untitled', 25))}</span>
        </div>
      `;
    } else if (item.window) {
      return `
        <div class="closed-chip" data-session-id="${item.window.sessionId}">
          <span>Window</span>
          <span class="chip-count">${item.window.tabs.length}</span>
        </div>
      `;
    }
    return '';
  }).join('');
}

// Filter windows based on search
function filterWindows() {
  if (!searchQuery) return allWindows;
  
  return allWindows.map(window => {
    const filteredTabs = window.tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      return title.includes(searchQuery) || url.includes(searchQuery);
    });
    
    return { ...window, tabs: filteredTabs };
  }).filter(window => window.tabs.length > 0);
}

// Drag and Drop handlers
function handleDragStart(event, tabId, windowId, element) {
  draggedTab = { tabId, windowId };
  draggedElement = element;

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify({ tabId, windowId }));

  // Add dragging class after a frame (so drag image captures normal state)
  requestAnimationFrame(() => {
    draggedElement.classList.add('dragging');
  });
}

function handleDragEnd(event) {
  if (draggedElement) {
    draggedElement.classList.remove('dragging');
  }
  draggedTab = null;
  draggedElement = null;
  
  // Remove all drag-over states
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
}

function handleWindowDragOver(event, windowId, column) {
  if (!draggedTab) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  column.classList.add('drag-over');
}

function handleWindowDragLeave(event, column) {
  // Only remove if we're actually leaving the column
  if (!column.contains(event.relatedTarget)) {
    column.classList.remove('drag-over');
  }
}

async function handleWindowDrop(event, targetWindowId, column) {
  event.preventDefault();
  column.classList.remove('drag-over');

  if (!draggedTab || draggedTab.windowId === targetWindowId) {
    // Same window - could handle reordering here
    return;
  }

  try {
    // Move tab to target window
    await chrome.tabs.move(draggedTab.tabId, {
      windowId: targetWindowId,
      index: -1 // Add to end
    });
    await loadWindows();
  } catch (e) {
    console.error('Failed to move tab:', e);
  }
}

function handleNewWindowDragOver(event) {
  if (!draggedTab) return;
  
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  newWindowZone.classList.add('drag-over');
}

function handleNewWindowDragLeave(event) {
  newWindowZone.classList.remove('drag-over');
}

async function handleNewWindowDrop(event) {
  event.preventDefault();
  newWindowZone.classList.remove('drag-over');
  
  if (!draggedTab) return;
  
  try {
    // Get tab info first
    const tab = await chrome.tabs.get(draggedTab.tabId);
    
    // Create new window with this tab
    await chrome.windows.create({
      tabId: draggedTab.tabId
    });
    
    await loadWindows();
  } catch (e) {
    console.error('Failed to create new window:', e);
  }
}

// Actions
async function navigateToTab(tabId, windowId) {
  // Don't navigate if we were dragging
  if (draggedTab) return;

  try {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(windowId, { focused: true });
  } catch (e) {
    console.error('Failed to navigate to tab:', e);
  }
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  await loadWindows();
  await loadRecentlyClosed();
}

async function closeWindow(windowId) {
  if (!confirm('Close this window and all its tabs?')) return;
  await chrome.windows.remove(windowId);
  await loadWindows();
  await loadRecentlyClosed();
}

async function suspendTab(tabId) {
  try {
    await chrome.tabs.discard(tabId);
    await loadWindows();
  } catch (e) {
    console.error('Cannot suspend this tab:', e);
  }
}

async function suspendWindow(windowId) {
  const win = allWindows.find(w => w.id === windowId);
  if (!win) return;

  for (const tab of win.tabs) {
    if (!tab.active && !tab.discarded) {
      try {
        await chrome.tabs.discard(tab.id);
      } catch (e) {
        // Some tabs can't be discarded
      }
    }
  }
  await loadWindows();
}

function saveWindowSession(windowId) {
  windowToSave = allWindows.find(w => w.id === windowId);
  if (!windowToSave) return;

  const sessionNameInput = document.getElementById('sessionName');
  sessionNameInput.value = '';
  document.getElementById('saveSessionModal').classList.remove('hidden');
  setTimeout(() => sessionNameInput.focus(), 100);
}

async function confirmSaveSession() {
  const name = document.getElementById('sessionName').value.trim();
  if (!name || !windowToSave) return;
  
  await chrome.runtime.sendMessage({
    action: 'saveSession',
    name: name,
    tabs: windowToSave.tabs
  });
  
  closeModal('saveSessionModal');
  windowToSave = null;
  await loadSessions();
}

async function restoreSession(sessionId) {
  await chrome.runtime.sendMessage({ action: 'restoreSession', sessionId });
  await loadWindows();
}

async function deleteSession(sessionId) {
  await chrome.runtime.sendMessage({ action: 'deleteSession', sessionId });
  await loadSessions();
}

async function restoreClosedItem(sessionId) {
  await chrome.runtime.sendMessage({ action: 'restoreClosedItem', sessionId });
  await loadWindows();
  await loadRecentlyClosed();
}

// Export functions
async function exportToCsv() {
  const rows = [['Window', 'Title', 'URL', 'Pinned', 'Active']];
  
  allWindows.forEach((window, idx) => {
    window.tabs.forEach(tab => {
      rows.push([
        `Window ${idx + 1}`,
        tab.title || '',
        tab.url || '',
        tab.pinned ? 'Yes' : 'No',
        tab.active ? 'Yes' : 'No'
      ]);
    });
  });
  
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, 'tabs.csv', 'text/csv');
  closeModal('exportModal');
}

async function exportToJson() {
  const data = allWindows.map((window, idx) => ({
    name: `Window ${idx + 1}`,
    tabs: window.tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      pinned: tab.pinned,
      active: tab.active
    }))
  }));
  
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, 'tabs.json', 'application/json');
  closeModal('exportModal');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Modals
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
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
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
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

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Handle favicon load errors via event delegation
windowsContainer.addEventListener('error', (e) => {
  if (e.target.classList.contains('tab-favicon') && e.target.dataset.fallback) {
    const placeholder = document.createElement('div');
    placeholder.className = 'tab-favicon placeholder';
    placeholder.textContent = '🌐';
    e.target.replaceWith(placeholder);
  }
}, true);
