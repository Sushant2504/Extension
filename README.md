# GoLogChat - Team Prompt Tracker

## 📋 Project Overview

**GoLogChat** is a VS Code extension designed to track and analyze AI prompts used during development. It helps teams understand how AI assistance (like Cursor AI) impacts their development workflow by logging prompts, responses, and their effects on the codebase.

### What is GoLogChat?

GoLogChat is a **team collaboration tool** that:
- **Captures** all AI prompts and responses from your development sessions
- **Tracks** which developers are using AI assistance and how frequently
- **Analyzes** the impact of AI prompts on your codebase
- **Provides** team-wide visibility into AI usage patterns
- **Enables** admins to monitor and manage AI prompt history across teams

### Core Purpose

The extension addresses the need for:
- **Transparency**: See what AI prompts are being used across your team
- **Accountability**: Track AI-assisted code changes
- **Learning**: Understand which prompts are most effective
- **Governance**: Manage and review AI usage in enterprise environments
- **Analytics**: Generate insights on AI assistance patterns

---

## 🎯 What the Extension Provides

### For Individual Developers

1. **Automatic Prompt Logging**
   - Seamlessly captures prompts sent to AI assistants (Cursor, GitHub Copilot, etc.)
   - Records responses and associated code changes
   - Works in the background without interrupting workflow

2. **Personal History**
   - View your own prompt history
   - Search and filter by date, project, or prompt type
   - Track your AI usage patterns

3. **Privacy Controls**
   - Control what gets logged
   - Option to exclude sensitive information

### For Team Admins

1. **Team Dashboard**
   - View all prompts across the team
   - Filter by developer, team, date range
   - Monitor AI usage statistics

2. **Access Control**
   - Role-based permissions (Admin vs Developer)
   - Team-based data isolation
   - Secure API access

3. **Analytics & Reporting**
   - Usage statistics per developer
   - Most common prompt patterns
   - Time-based trends

### For Organizations

1. **Compliance & Audit**
   - Complete audit trail of AI interactions
   - Export capabilities for compliance reporting
   - Data retention policies

2. **Cost Management**
   - Track AI API usage
   - Identify high-usage patterns
   - Optimize AI spending

---

## 🏗️ Architecture

### Components

```
GoLogChat/
├── gologchat/              # VS Code Extension (TypeScript)
│   ├── src/
│   │   └── extension.ts    # Extension entry point
│   └── package.json        # Extension manifest
│
└── gologchat-backend/      # Go Backend Server
    ├── main.go             # Server entry point
    ├── models/             # Data models
    │   └── models.go       # Prompt, User models
    ├── storage/            # Storage layer
    │   └── storage.go      # Storage interface & implementation
    ├── handlers/           # API handlers
    │   └── handlers.go    # HTTP request handlers
    └── middleware/         # Middleware
        └── cors.go         # CORS configuration
```

### Data Flow

1. **Extension** captures prompts from VS Code
2. **Extension** sends data to **Backend API**
3. **Backend** stores data in storage layer
4. **Backend** serves data via REST API
5. **Extension** displays data in VS Code UI

### Technology Stack

- **Extension**: TypeScript, VS Code Extension API
- **Backend**: Go, Gorilla Mux (HTTP router)
- **Storage**: In-memory (can be replaced with PostgreSQL, MongoDB, etc.)

---

## ✨ Features

### Current Features (MVP)

- ✅ REST API for prompt storage and retrieval
- ✅ Role-based access control (Team ID based)
- ✅ Admin role support
- ✅ Filtering by developer ID and date range
- ✅ In-memory storage
- ✅ CORS support for extension-backend communication
- ✅ Health check endpoint

### Planned Features

- 🔄 VS Code extension UI for viewing prompts
- 🔄 Real-time prompt capture from Cursor AI
- 🔄 Dashboard view in VS Code
- 🔄 Database persistence (PostgreSQL/SQLite)
- 🔄 Authentication & authorization
- 🔄 Export functionality (CSV, JSON)
- 🔄 Analytics dashboard
- 🔄 Search functionality
- 🔄 Prompt templates library
- 🔄 Integration with other AI tools

---

## 🚀 Getting Started

### Prerequisites

- **VS Code** 1.106.1 or higher
- **Go** 1.21 or higher (for backend)
- **Node.js** and **npm** (for extension development)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd gologchat-backend
   ```

2. **Install dependencies**
   ```bash
   go mod tidy
   ```

3. **Run the server**
   ```bash
   go run main.go
   ```
   
   Or build and run:
   ```bash
   go build -o gologchat-backend
   ./gologchat-backend
   ```

4. **Configure port** (optional)
   ```bash
   export PORT=8080
   go run main.go
   ```

The server will start on `http://localhost:8080` by default.

### Extension Setup

1. **Navigate to extension directory**
   ```bash
   cd gologchat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run compile
   ```

4. **Run in development mode**
   - Press `F5` in VS Code to launch Extension Development Host
   - Or use: `code --extensionDevelopmentPath=./gologchat`

5. **Configure extension settings**
   - Set the backend API URL in VS Code settings
   - Configure your Developer ID and Team ID

---

## 📡 API Documentation

### Base URL
```
http://localhost:8080/api
```

### Endpoints

#### Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok"
}
```

#### Save Prompt
```http
POST /api/prompts
Content-Type: application/json
X-Developer-ID: developer-123
X-Team-ID: team-456
X-Is-Admin: false
```
**Request Body:**
```json
{
  "prompt": "How do I implement authentication?",
  "response": "You can use JWT tokens...",
  "developerId": "developer-123",
  "teamId": "team-456"
}
```
**Response:**
```json
{
  "id": "uuid-here",
  "developerId": "developer-123",
  "teamId": "team-456",
  "prompt": "How do I implement authentication?",
  "response": "You can use JWT tokens...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Get Prompts
```http
GET /api/prompts?developerId=developer-123&startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
X-Developer-ID: developer-123
X-Team-ID: team-456
X-Is-Admin: false
```
**Query Parameters:**
- `developerId` (optional): Filter by developer
- `startDate` (optional): ISO 8601 format
- `endDate` (optional): ISO 8601 format

**Response:**
```json
[
  {
    "id": "uuid-1",
    "developerId": "developer-123",
    "teamId": "team-456",
    "prompt": "How do I implement authentication?",
    "response": "You can use JWT tokens...",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

#### Register/Update User
```http
POST /api/users
Content-Type: application/json
```
**Request Body:**
```json
{
  "developerId": "developer-123",
  "teamId": "team-456",
  "isAdmin": false
}
```

#### Get User
```http
GET /api/users/{id}
```

---

## 🗺️ Next Steps & Roadmap

### Phase 1: Core Extension Development (Current)

- [x] Backend API structure
- [x] Basic storage layer
- [ ] **Implement prompt capture in extension**
  - Hook into Cursor AI API
  - Capture prompts and responses
  - Send to backend API
- [ ] **Create VS Code UI components**
  - Tree view for prompt history
  - Detail view for individual prompts
  - Search and filter UI
- [ ] **Extension settings**
  - Backend API URL configuration
  - Developer ID and Team ID setup
  - Authentication token management

### Phase 2: Enhanced Features

- [ ] **Database Integration**
  - Replace in-memory storage with PostgreSQL
  - Add database migrations
  - Implement connection pooling
- [ ] **Authentication & Security**
  - JWT token authentication
  - Secure API endpoints
  - User session management
- [ ] **Advanced UI**
  - Dashboard with statistics
  - Charts and graphs
  - Export functionality
- [ ] **Search & Filtering**
  - Full-text search
  - Advanced filters
  - Saved searches

### Phase 3: Analytics & Insights

- [ ] **Analytics Dashboard**
  - Usage statistics
  - Trend analysis
  - Developer activity reports
- [ ] **Prompt Analysis**
  - Most common prompts
  - Effectiveness metrics
  - Pattern recognition
- [ ] **Integration Enhancements**
  - Support for multiple AI tools
  - GitHub integration
  - Slack notifications

### Phase 4: Enterprise Features

- [ ] **Multi-tenant Support**
  - Organization management
  - Team hierarchies
  - Resource isolation
- [ ] **Compliance & Governance**
  - Data retention policies
  - Audit logging
  - Compliance reporting
- [ ] **Scalability**
  - Horizontal scaling
  - Caching layer
  - Load balancing

---

## 🔧 Development Guide

### Extension Development

1. **Watch mode for development**
   ```bash
   cd gologchat
   npm run watch
   ```

2. **Run tests**
   ```bash
   npm test
   ```

3. **Lint code**
   ```bash
   npm run lint
   ```

### Backend Development

1. **Run with hot reload** (requires air or similar)
   ```bash
   air
   ```

2. **Run tests**
   ```bash
   go test ./...
   ```

3. **Format code**
   ```bash
   go fmt ./...
   ```

---

## 📝 Configuration

### Extension Settings

Add to `package.json` `contributes.configuration`:

```json
{
  "gologchat.apiUrl": {
    "type": "string",
    "default": "http://localhost:8080",
    "description": "Backend API URL"
  },
  "gologchat.developerId": {
    "type": "string",
    "description": "Your Developer ID"
  },
  "gologchat.teamId": {
    "type": "string",
    "description": "Your Team ID"
  },
  "gologchat.enableLogging": {
    "type": "boolean",
    "default": true,
    "description": "Enable prompt logging"
  }
}
```

### Environment Variables

**Backend:**
- `PORT`: Server port (default: 8080)
- `DATABASE_URL`: Database connection string (future)
- `JWT_SECRET`: JWT secret key (future)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

---

## 📄 License

[Add your license here]

---

## 🐛 Known Issues

- In-memory storage is not persistent (data lost on restart)
- No authentication currently implemented
- Extension UI not yet implemented

---

## 📚 Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Go Documentation](https://go.dev/doc/)
- [Gorilla Mux](https://github.com/gorilla/mux)

---

## 💡 Use Cases

1. **Development Teams**: Track AI usage across team members
2. **Code Reviews**: Understand context of AI-generated code
3. **Training**: Learn effective prompt patterns
4. **Compliance**: Maintain audit trail of AI interactions
5. **Cost Management**: Monitor AI API usage and costs

---

## 🎯 Success Metrics

- Number of prompts logged per day
- Team adoption rate
- Average prompts per developer
- Most effective prompt patterns
- Time saved through AI assistance

---

**Ready to get started?** Follow the setup instructions above and begin tracking your AI prompts today!

