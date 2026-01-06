// Cluster MV3 - Service Worker
// Handles background events and storage operations

const UNDO_HISTORY_MAX = 50;
const MANAGER_URL = chrome.runtime.getURL('manager/manager.html');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['savedSessions', 'undoHistory', 'settings']);
  
  if (!existing.savedSessions) {
    await chrome.storage.local.set({ savedSessions: [] });
  }
  if (!existing.undoHistory) {
    await chrome.storage.local.set({ undoHistory: [] });
  }
  if (!existing.settings) {
    await chrome.storage.local.set({ 
      settings: {
        darkMode: 'system', // 'system', 'dark', 'light'
      }
    });
  }
  
  console.log('Clustr initialized');
});

// Handle keyboard command for opening full manager
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-manager') {
    openManager();
  }
});

// Open the full manager tab (or focus if already open)
async function openManager() {
  // Check if manager tab already exists
  const tabs = await chrome.tabs.query({ url: MANAGER_URL });
  
  if (tabs.length > 0) {
    // Focus existing manager tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Create new manager tab
    await chrome.tabs.create({ url: MANAGER_URL });
  }
}

// Track closed tabs for undo functionality
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // We can't get tab info after it's removed, so we use sessions API instead
  // The sessions API tracks recently closed tabs/windows automatically
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openManager':
      openManager().then(() => sendResponse({ success: true }));
      return true;
      
    case 'saveSession':
      saveSession(message.name, message.tabs).then(sendResponse);
      return true; // async response
      
    case 'deleteSession':
      deleteSession(message.sessionId).then(sendResponse);
      return true;
      
    case 'getSessions':
      getSessions().then(sendResponse);
      return true;
      
    case 'getRecentlyClosed':
      getRecentlyClosed().then(sendResponse);
      return true;
      
    case 'restoreSession':
      restoreSession(message.sessionId).then(sendResponse);
      return true;
      
    case 'restoreClosedItem':
      restoreClosedItem(message.sessionId).then(sendResponse);
      return true;
      
    case 'getSettings':
      getSettings().then(sendResponse);
      return true;
      
    case 'updateSettings':
      updateSettings(message.settings).then(sendResponse);
      return true;
  }
});

// Save a window's tabs as a session
async function saveSession(name, tabs) {
  const { savedSessions } = await chrome.storage.local.get('savedSessions');
  
  const session = {
    id: crypto.randomUUID(),
    name: name,
    createdAt: Date.now(),
    tabs: tabs.map(t => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      pinned: t.pinned || false
    }))
  };
  
  savedSessions.push(session);
  await chrome.storage.local.set({ savedSessions });
  
  return { success: true, session };
}

// Delete a saved session
async function deleteSession(sessionId) {
  const { savedSessions } = await chrome.storage.local.get('savedSessions');
  const filtered = savedSessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ savedSessions: filtered });
  return { success: true };
}

// Get all saved sessions
async function getSessions() {
  const { savedSessions } = await chrome.storage.local.get('savedSessions');
  return savedSessions || [];
}

// Get recently closed tabs/windows using Sessions API
async function getRecentlyClosed() {
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
    return sessions;
  } catch (e) {
    console.error('Error getting recently closed:', e);
    return [];
  }
}

// Restore a saved session (opens in new window)
async function restoreSession(sessionId) {
  const { savedSessions } = await chrome.storage.local.get('savedSessions');
  const session = savedSessions.find(s => s.id === sessionId);
  
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  try {
    // Create new window with first tab
    const firstTab = session.tabs[0];
    const newWindow = await chrome.windows.create({
      url: firstTab.url,
      focused: true
    });
    
    // Add remaining tabs (discarded to save memory)
    for (let i = 1; i < session.tabs.length; i++) {
      const tab = session.tabs[i];
      await chrome.tabs.create({
        windowId: newWindow.id,
        url: tab.url,
        pinned: tab.pinned,
        active: false
      });
    }
    
    return { success: true };
  } catch (e) {
    console.error('Error restoring session:', e);
    return { success: false, error: e.message };
  }
}

// Restore a recently closed tab or window
async function restoreClosedItem(sessionId) {
  try {
    const restored = await chrome.sessions.restore(sessionId);
    return { success: true, restored };
  } catch (e) {
    console.error('Error restoring closed item:', e);
    return { success: false, error: e.message };
  }
}

// Get settings
async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings || { darkMode: 'system' };
}

// Update settings
async function updateSettings(newSettings) {
  const { settings } = await chrome.storage.local.get('settings');
  const updated = { ...settings, ...newSettings };
  await chrome.storage.local.set({ settings: updated });
  return { success: true, settings: updated };
}
