# Release Notes

## v0.3.3 (2026-01-08)

### Changes

- feat: Add window management AI actions
  - Add createWindow action to open new windows with specified URLs
  - Add moveTabsToWindow action to move existing tabs to a new window
  - Update AI system prompt to document new actions

## v0.3.2 (2026-01-08)

### Changes

- chore: Update Anthropic model list
  - Add all Claude 4.5 models (Opus, Sonnet, Haiku)
  - Add Claude 4 Sonnet
  - Keep Claude 3.5 family (Sonnet, Haiku)
  - Remove Claude 3 family
  - Default to Claude 4.5 Haiku for cost efficiency

## v0.3.1 (2026-01-08)

### Changes

- fix: UI improvements and tab grouping implementation
  - Fix chat sidebar overlapping header by positioning below header
  - Fix modal close buttons not working with ES modules
  - Implement tab grouping by domain using Chrome tabGroups API
  - Add model selector dropdown for AI providers
  - Add Claude 4.5 Sonnet and updated model strings
  - Add tabGroups permission to manifest

## v0.3.0 (2026-01-08)

### Changes

- chore: Add Vite build system and dependencies
  - Add package.json with vite, @anthropic-ai/sdk, openai dependencies
  - Configure vite.config.js for Chrome extension bundling
  - Build outputs bundled extension to dist/ directory

- feat: Add AI chat assistant to manager
  - Restructure project to src/ directory for Vite builds
  - Add AI service layer supporting Chrome AI (Gemini Nano), OpenAI, and Anthropic
  - Add collapsible chat sidebar to manager UI (right side)
  - Add AI provider settings in settings modal
  - Add bookmarks permission for AI context
  - AI can answer questions about tabs and suggest organization
  - AI actions: closeTabs, focusTab, saveSession, searchTabs

## v0.2.0 (2026-01-08)

### Changes

- feat: Display version number in manager header
  - Shows version from manifest.json next to the Clustr logo (e.g., "Clustr v0.2.0")
  - Uses `chrome.runtime.getManifest()` to dynamically fetch version
  - Styled with muted color to complement the logo

## v0.1.1 (2026-01-08)

### Changes

- docs: Improve CLAUDE.md and add release notes
  - Fix storage schema accuracy (sessions → savedSessions, theme → darkMode)
  - Add Message API reference table documenting all service worker actions
  - Add versioning section documenting manifest.json as version source
  - Initialize docs/release-notes.md with v0.1.0 initial release

## v0.1.0 (2025-01-08)

### Initial Release

- Kanban-style tab management with drag-and-drop
- Quick search popup (`Cmd+M` / `Ctrl+M`)
- Full manager view (`Cmd+Shift+M` / `Ctrl+Shift+M`)
- Session saving and restoration
- Recently closed tabs recovery
- Export to CSV/JSON
- Tab suspension to free memory
- Dark/light/system theme support
