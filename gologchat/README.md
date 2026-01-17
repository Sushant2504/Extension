# GoLogChat VS Code Extension

Log AI prompts/responses from VS Code to the GoLogChat backend.

## Features
- Command palette action: `GoLogChat: Log Prompt` (captures prompt + optional response, sends to backend).
- Uses your configured Developer ID and Team ID for access control.
- Respects `enableLogging` toggle.

## Requirements
- Backend server running (default `http://localhost:8080`). Start it from `gologchat-backend` with `go run main.go`.

## Settings
All settings are under `GoLogChat`:
- `gologchat.apiUrl` (`string`, default `http://localhost:8080`): Backend base URL.
- `gologchat.developerId` (`string`): Your Developer ID.
- `gologchat.teamId` (`string`): Your Team ID.
- `gologchat.enableLogging` (`boolean`, default `true`): Master toggle.
- `gologchat.isAdmin` (`boolean`, default `false`): Marks requests as admin (use only if allowed).

## Usage
1. Configure settings (`Cmd+,` then search “GoLogChat”) for API URL, Developer ID, Team ID.
2. Run `GoLogChat: Log Prompt` from the Command Palette.
3. Enter the prompt, optionally the response, and submit. A success/error toast will appear.

## Known Limitations (current build)
- Manual entry only (no automatic capture yet).
- Backend is in-memory; data resets on restart and has no authentication.

## Packaging / Publishing
- Build: `npm run compile`
- Package VSIX: `npx @vscode/vsce package`
- Install local VSIX: `code --install-extension gologchat-0.0.2.vsix`
- Publishing to Marketplace requires a real `publisher` value and Azure DevOps Personal Access Token configured for `vsce`.

