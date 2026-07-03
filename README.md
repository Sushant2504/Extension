# DevTrace AI

A VS Code extension that tracks and analyzes AI prompts across your development team. Log prompts, view history, detect usage patterns, and gain team-wide visibility into how AI tools are being used.

**Live Backend:** `https://extension-2n4y.onrender.com`

## Features

### Prompt Logging & History
- Log AI prompts and responses via the command palette
- Browse prompt history grouped by date in the sidebar
- View full prompt details with copy-to-clipboard support
- Search prompts by text across all fields
- Filter by developer ID and date range
- Export prompts as JSON or CSV

### Team Patterns & Analytics
- Automatic pattern detection across 10 categories (debugging, refactoring, testing, feature, documentation, review, deployment, configuration, learning, api)
- Team patterns tree view with per-developer breakdown
- Visual dashboard with bar charts, stat cards, and recent activity tables
- Admin mode to view all teams' data

### Settings & Configuration
- In-extension settings panel (no need to edit settings.json)
- Custom toggle switches for logging and admin mode
- Connection status indicator
- Auto-registration with the backend on config change

### Developer Experience
- Status bar indicator showing backend connection health (with 3-retry logic)
- Onboarding flow for first-time setup
- Themed UI that matches your VS Code color scheme (light/dark)

## Project Structure

```
DevTrace-AI/
├── devtrace-ai/                   # VS Code Extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts           # Entry point, command registration
│   │   ├── apiClient.ts           # HTTP client for backend API
│   │   ├── types.ts               # Shared types, constants, API URL
│   │   ├── settingsViewProvider.ts    # Settings sidebar webview
│   │   ├── promptTreeProvider.ts      # Prompt History tree view
│   │   ├── promptDetailPanel.ts       # Prompt detail webview panel
│   │   ├── teamPatternsTreeProvider.ts # Team Patterns tree view
│   │   └── teamPatternsDashboard.ts   # Team dashboard webview panel
│   └── package.json               # Extension manifest
│
├── gologchat-backend/             # Go Backend Server
│   ├── main.go                    # Server entry point, routes
│   ├── handlers/
│   │   ├── handlers.go            # API request handlers
│   │   └── patterns.go            # Prompt pattern detection
│   ├── models/models.go           # Data models
│   ├── storage/storage.go         # In-memory storage with sync.RWMutex
│   └── middleware/cors.go         # CORS middleware
│
├── render.yaml                    # Render deployment config
└── README.md
```

## Getting Started

### Prerequisites

- **VS Code** 1.106.1+
- **Node.js** 18+ and **npm** (for extension development)
- **Go** 1.21+ (only if running the backend locally)

### Quick Start (using deployed backend)

The extension ships with the backend URL pre-configured. Just install and go:

1. Clone the repo and open in VS Code
   ```bash
   git clone https://github.com/Sushant2504/Extension.git
   cd Extension
   ```

2. Install extension dependencies
   ```bash
   cd devtrace-ai
   npm install
   ```

3. Build and launch
   ```bash
   npm run compile
   ```
   Press **F5** to launch the Extension Development Host.

4. Open the **DevTrace AI** sidebar, go to **Settings**, enter your Developer ID and Team ID, and hit **Save**.

### Running the Backend Locally

```bash
cd gologchat-backend
go mod tidy
go run main.go
```

The server starts on `http://localhost:8080`. To use it, update `API_BASE_URL` in `devtrace-ai/src/types.ts`.

## Commands

| Command | Description |
|---------|-------------|
| `DevTrace AI: Log Prompt` | Log a prompt and optional response |
| `DevTrace AI: Search Prompts` | Full-text search across all prompts |
| `DevTrace AI: Filter Prompts` | Filter by developer ID and/or date range |
| `DevTrace AI: Clear Filter` | Remove active filters |
| `DevTrace AI: Export Prompts` | Export as JSON or CSV |
| `DevTrace AI: Refresh Prompts` | Reload prompt history |
| `DevTrace AI: Team Patterns Dashboard` | Open the visual analytics dashboard |
| `DevTrace AI: Refresh Team Patterns` | Reload team pattern data |
| `DevTrace AI: Edit Developer Profile` | Update a developer's team/admin status |
| `DevTrace AI: Check Backend Connection` | Test connectivity to the backend |
| `DevTrace AI: Open Settings` | Focus the settings panel |

## API Endpoints

Base URL: `https://extension-2n4y.onrender.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/prompts` | Save a new prompt |
| `GET` | `/api/prompts` | Get prompts (with optional filters) |
| `POST` | `/api/users` | Register or update a user |
| `GET` | `/api/users/{id}` | Get user info |
| `GET` | `/api/team/patterns` | Get team working patterns |

All endpoints accept `X-Developer-ID`, `X-Team-ID`, and `X-Is-Admin` headers for access control.

## Configuration

Settings are managed through the in-extension Settings panel. They are stored in VS Code's `globalState` (persistent across sessions). Fallback values can be set in `.vscode/settings.json`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `devtraceai.developerId` | `string` | — | Your unique developer identifier |
| `devtraceai.teamId` | `string` | — | Your team identifier |
| `devtraceai.enableLogging` | `boolean` | `true` | Toggle prompt logging |
| `devtraceai.isAdmin` | `boolean` | `false` | Enable admin mode |

The backend URL (`https://extension-2n4y.onrender.com`) is hardcoded since all users share a single backend instance.

## Tech Stack

- **Extension**: TypeScript, VS Code Extension API, esbuild
- **Backend**: Go, Gorilla Mux, in-memory storage with `sync.RWMutex`
- **Deployment**: Render (free tier)

## Development

```bash
# Extension - watch mode
cd devtrace-ai
npm run watch

# Extension - type check
npm run check-types

# Extension - lint
npm run lint

# Backend - run
cd gologchat-backend
go run main.go

# Backend - test
go test ./...
```

## Known Limitations

- Backend uses in-memory storage — data resets on server restart
- No authentication (team/admin IDs are trust-based)
- Prompt logging is manual (no automatic capture from AI tools yet)
- Render free tier has cold starts (~30s on first request after inactivity)

## License

MIT — see [LICENSE](devtrace-ai/LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
