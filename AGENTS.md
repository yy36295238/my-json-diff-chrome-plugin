# AGENTS.md

This file provides guidance for agentic coding agents working on this JSON tool Chrome extension.

## Build/Test/Development Commands

This project uses vanilla JavaScript with ES6 modules - **no build tools required**.

```bash
# Run the web application locally
python3 -m http.server 8080
# Open http://localhost:8080 in browser

# Load Chrome extension
# 1. Open chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select chrome-extension/ directory

# Testing (manual - no automated test runner)
# Open test HTML files directly in browser
open chrome-extension/index.html
```

**Note**: There are no formal automated tests. Testing is done by manually opening HTML files in the browser and verifying functionality.

## Code Style Guidelines

### JavaScript
- Use **ES6 modules** with `import`/`export` syntax
- Classes follow PascalCase: `FormatterManager`, `JSONToolApp`
- Functions and variables use **camelCase**: `formatJSON`, `loadExample`
- Arrow functions for event handlers: `() => this.formatJSON()`
- Use `async/await` for async operations
- No build step required - direct ES module imports in HTML

### File Organization
```
chrome-extension/
├── manifest.json          # Extension config (Manifest V3)
├── index.html             # Main UI entry
├── styles-*.css           # CSS with theme variables
└── js/
    ├── app.js             # Main app class (JSONToolApp)
    ├── utils.js           # Utility functions (export const Utils)
    ├── JSONRenderer.js    # JSON tree rendering
    ├── managers/          # Feature modules
    │   ├── FormatterManager.js
    │   ├── CompareManager.js
    │   ├── ConverterManager.js
    │   ├── LayoutManager.js
    │   └── OtherToolsManager.js
    ├── background.js       # Service worker
    └── content.js         # Content script
```

### Naming Conventions
- **Classes**: PascalCase - `class JSONToolApp`
- **Methods**: camelCase - `formatJSON()`, `loadExample()`
- **Variables**: camelCase - `const jsonEditor`, `this.history`
- **Constants**: UPPER_SNAKE_CASE - `MAX_HISTORY_SIZE`
- **Private fields**: prefix with underscore - `this._suppressHistory`
- **Exported objects**: PascalCase - `export const Utils`, `export const JSONRenderer`

### Imports/Exports
- Use named exports: `export class FormatterManager`
- Named imports: `import { FormatterManager } from './managers/FormatterManager.js'`
- Always include `.js` extension in imports (required for ES modules)

### Error Handling
- Use try-catch for JSON parsing: `try { JSON.parse(input) } catch (error) { ... }`
- Display user-friendly Chinese error messages via `this.app.layout.showError()`
- Log to console for debugging: `console.error('Failed to load state', e)`

### CSS and Theming
- Use CSS custom properties (variables) for theming: `var(--text-muted)`, `var(--error-color)`
- Support both `light` and `dark` themes via `data-theme` attribute
- Theme selection persisted to `localStorage` with key `json-tool-theme`
- Responsive design with flexbox/grid

### Data Persistence
- Use `localStorage` for state persistence
- State object structure: `{ history, theme, compareHistoryLeft, compareHistoryRight }`
- Key: `json-tool-state`
- Wrap localStorage operations in try-catch for quota errors

### Event Handling
- Use event delegation where appropriate (especially for dynamic content)
- Store event handler references to prevent memory leaks: `textarea._scrollHandler = scrollHandler`
- Remove handlers when cleaning up: `textarea.removeEventListener('scroll', textarea._scrollHandler)`

### Chrome Extension Specifics
- **Manifest V3** compliance required
- **Permissions**: `storage` only (minimal for privacy)
- **Content Security Policy**: Strict - `script-src 'self'`
- No inline event handlers in HTML (use `addEventListener` in JS)

### JSON Processing
- Use `Utils.deepParseJSON()` for recursive parsing of nested JSON strings
- Use `JSON.stringify(obj, null, 2)` for formatting
- Use `JSON.stringify(obj)` for compression
- Handle escape characters with regex patterns
- Always validate JSON before processing

### Comments and Documentation
- Use Chinese for user-facing messages and UI text
- Use English for code comments (if any)
- Add JSDoc-style comments for complex functions only
- Keep code self-documenting with clear naming

### Performance Considerations
- Debounce expensive operations where needed
- Use `requestAnimationFrame` for UI updates when appropriate
- Avoid excessive DOM manipulation - batch updates
- Use `textContent` instead of `innerHTML` for simple text updates
- Limit history size to prevent localStorage quota issues (default: 50-100 entries)

### Browser Compatibility
- Target modern browsers (Chrome 90+)
- No polyfills needed
- Use native browser APIs (clipboard, localStorage, etc.)
- Test in both light and dark themes

## Key Patterns to Follow

### Manager Pattern
Each feature module extends from a base manager pattern:
```javascript
export class FormatterManager {
    constructor(app) {
        this.app = app;  // Reference to main app
    }
    
    init() {
        // Setup event listeners
    }
}
```

### Deep Parsing Pattern
Always use `Utils.deepParseJSON()` when parsing JSON that may contain nested JSON strings.

### Error Display Pattern
```javascript
try {
    // operation
} catch (error) {
    this.app.layout.showError('Operation Failed', error.message);
}
```

### Status Update Pattern
```javascript
this.app.layout.updateStatus('Operation completed');
```

## Prohibited Practices

- ❌ No inline event handlers in HTML (CSP violation)
- ❌ No eval() or Function() constructor (CSP violation)
- ❌ No external CDN dependencies without manifest permission
- ❌ No build step or bundler - keep it simple vanilla JS
- ❌ No TypeScript - use vanilla JavaScript
- ❌ Don't use jQuery or other large libraries unnecessarily
