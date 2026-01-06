# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clustr is a Chrome extension (Manifest V3) that replicates the functionality of the now-defunct "Cluster" tab manager. It provides window and tab management with session saving, searching, and drag-drop organization.

## Development

This is a vanilla JavaScript Chrome extension with no build process, package manager, or test framework.

**To develop:**

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the project directory
4. Reload the extension after code changes

**Keyboard shortcuts (configurable in `chrome://extensions/shortcuts`):**

- `Cmd+M` / `Ctrl+M` - Open popup search
- `Cmd+Shift+M` / `Ctrl+Shift+M` - Open full manager

## Architecture

### Component Communication

```text
┌─────────────────┐         chrome.runtime.sendMessage         ┌───────────────────────┐
│   Popup UI      │ ──────────────────────────────────────────→│  Service Worker       │
│  (popup/*.*)    │                                            │  (background/*.js)    │
└─────────────────┘                                            │                       │
                                                               │  - Session storage    │
┌─────────────────┐         chrome.runtime.sendMessage         │  - Settings mgmt      │
│   Manager UI    │ ──────────────────────────────────────────→│  - Undo history       │
│  (manager/*.*)  │                                            │  - Recently closed    │
└─────────────────┘                                            └───────────────────────┘
```

### Three Main Components

1. **Background Service Worker** (`background/service-worker.js`)
   - Handles storage operations (sessions, settings, undo history)
   - Processes messages from UI components
   - Manages recently closed tabs via Chrome Sessions API

2. **Popup UI** (`popup/`)
   - Quick tab search interface (380x500px popup)
   - Keyboard-driven navigation (↑/↓/Enter/Escape)
   - Real-time filtering by title/URL

3. **Manager UI** (`manager/`)
   - Full-page kanban-style interface
   - Drag-and-drop tabs between windows
   - Session save/restore, export (CSV/JSON)
   - Auto-refreshes every 2 seconds

### Chrome APIs Used

- `chrome.tabs.*` - Tab queries, movement, discard, close
- `chrome.windows.*` - Window management
- `chrome.storage.local` - Persistent storage for sessions/settings
- `chrome.sessions.*` - Recently closed tabs/windows
- `chrome.runtime.onMessage` - Inter-component messaging

### Storage Schema

```javascript
// Sessions stored in chrome.storage.local
{
  sessions: [
    { id: "uuid", name: "string", createdAt: "ISO date", tabs: [...] }
  ],
  settings: { theme: "system" | "dark" | "light" },
  undoHistory: [{ type: "string", data: {...}, timestamp: number }]
}
```

### Theming

CSS variable-based theming with three modes: system (default), dark, light. Theme preference stored in settings and applied via `data-theme` attribute on `<html>`.
