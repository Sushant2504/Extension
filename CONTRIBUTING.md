# Contributing to DevTrace AI

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **Go** 1.21+
- **VS Code** 1.106.1+

### Clone and Install

```bash
git clone https://github.com/Sushant2504/Extension.git
cd Extension

# Extension
cd devtrace-ai
npm install

# Backend
cd ../gologchat-backend
go mod tidy
```

### Running Locally

**Extension:**

```bash
cd devtrace-ai
npm run watch
```

Then press **F5** in VS Code to launch the Extension Development Host.

**Backend:**

```bash
cd gologchat-backend
go run main.go
```

If running the backend locally, update `API_BASE_URL` in `devtrace-ai/src/types.ts` to `http://localhost:8080`.

## Project Structure

```
devtrace-ai/           # VS Code extension (TypeScript)
  src/
    extension.ts       # Entry point — commands, providers, lifecycle
    apiClient.ts       # HTTP client for all backend calls
    types.ts           # Shared interfaces, constants
    settingsViewProvider.ts       # Settings sidebar webview
    promptTreeProvider.ts         # Prompt History tree view
    promptDetailPanel.ts          # Prompt detail panel (webview)
    orgPatternsTreeProvider.ts   # Org Patterns tree view
    orgPatternsDashboard.ts      # Org dashboard (webview)

gologchat-backend/     # Go HTTP server
  main.go              # Routes and server startup
  handlers/            # Request handlers + pattern detection
  models/              # Data models (Prompt, User)
  storage/             # In-memory storage layer
  middleware/          # CORS middleware
```

## Making Changes

### Branching

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in small, focused commits.

3. Push and open a pull request against `main`.

### Extension Changes

Before submitting:

```bash
cd devtrace-ai

# Type check
npm run check-types

# Lint
npm run lint

# Production build
npm run package
```

All three must pass with no errors.

### Backend Changes

Before submitting:

```bash
cd gologchat-backend

# Build
go build ./...

# Format
go fmt ./...

# Test
go test ./...
```

### Webview UI Changes

The extension has three webview panels with inline HTML/CSS/JS:

- **Settings panel** (`settingsViewProvider.ts`) — sidebar webview
- **Prompt detail** (`promptDetailPanel.ts`) — editor panel
- **Org dashboard** (`orgPatternsDashboard.ts`) — editor panel

All webviews use VS Code CSS variables (`--vscode-*`) for theming. When modifying webview UI:

- Test in both light and dark themes
- Keep `enableScripts: true` if the webview uses JavaScript
- Use `postMessage`/`onDidReceiveMessage` for webview-to-host communication

### Adding a New Command

1. Add the command to `devtrace-ai/package.json` under `contributes.commands`
2. Register it in `extension.ts` with `vscode.commands.registerCommand`
3. Add it to `context.subscriptions`
4. Add menu entries in `contributes.menus` if it should appear in view toolbars

### Adding a New API Endpoint

1. Add the handler method to `gologchat-backend/handlers/handlers.go`
2. Register the route in `gologchat-backend/main.go`
3. Add the client method to `devtrace-ai/src/apiClient.ts`
4. Add any new types to `devtrace-ai/src/types.ts` and `gologchat-backend/models/models.go`

## Code Style

### TypeScript (Extension)

- No comments unless explaining a non-obvious "why"
- Use VS Code API conventions (dispose pattern, event emitters)
- Prefix command IDs with `devtraceai.`
- Prefix config keys with `devtraceai.`
- Use `const` by default; `let` only when reassignment is needed

### Go (Backend)

- Follow standard Go formatting (`go fmt`)
- Use `sync.RWMutex` for thread-safe storage access
- Return errors rather than panicking
- Keep handlers thin — business logic goes in dedicated functions

### Webview HTML/CSS

- Use `var(--vscode-*)` CSS variables for all colors
- Provide fallback values: `var(--vscode-widget-border, rgba(128,128,128,0.2))`
- Keep inline styles minimal; use `<style>` blocks

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include a clear description of what changed and why
- Make sure type checks and builds pass
- Test the extension in the Extension Development Host (F5)
- Test in both light and dark VS Code themes for UI changes

## Reporting Issues

Open an issue at [github.com/Sushant2504/Extension/issues](https://github.com/Sushant2504/Extension/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- VS Code version and OS
- Any error messages from the Output panel (select "DevTrace AI" channel)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
