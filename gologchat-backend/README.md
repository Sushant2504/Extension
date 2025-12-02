# GoLogChat Backend

Go backend server for the Team Prompt Tracker VS Code extension.

## Features

- REST API for storing and retrieving prompts
- Role-based access control (Team ID based)
- Admin role support
- Filtering by developer ID and date range
- In-memory storage (can be replaced with database)

## Running the Server

```bash
# Install dependencies
go mod tidy

# Run the server
go run main.go

# Or build and run
go build -o gologchat-backend
./gologchat-backend
```

The server will start on port 8080 by default. Set the `PORT` environment variable to change it.

## API Endpoints

### Health Check
- `GET /api/health` - Check if server is running

### Prompts
- `POST /api/prompts` - Save a new prompt
- `GET /api/prompts` - Get prompts (with filters via query params)

### Users
- `POST /api/users` - Register or update a user
- `GET /api/users/:id` - Get user information

## Configuration

The extension will connect to this backend. Make sure the API URL in the extension settings points to this server.

