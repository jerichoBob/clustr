# Release Notes

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
