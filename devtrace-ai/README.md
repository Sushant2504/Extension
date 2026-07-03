# DevTrace AI VS Code Extension

Track and analyze AI prompts across your development team.

## Features
- Command palette action: `DevTrace AI: Log Prompt` (captures prompt + optional response, sends to backend).
- Uses your configured Developer ID and Organization ID for access control.
- Respects `enableLogging` toggle.

## Requirements
- Backend server running (default `http://localhost:8080`). Start it from `gologchat-backend` with `go run main.go`.

## Settings
All settings are under `DevTrace AI`:
- `devtraceai.developerId` (`string`): Your Developer ID.
- `devtraceai.orgId` (`string`): Your Organization ID.
- `devtraceai.enableLogging` (`boolean`, default `true`): Master toggle.
- `devtraceai.isAdmin` (`boolean`, default `false`): Marks requests as admin (use only if allowed).

## Usage
1. Configure settings in the sidebar Settings panel.
2. Run `DevTrace AI: Log Prompt` from the Command Palette.
3. Enter the prompt, optionally the response, and submit. A success/error toast will appear.

## Known Limitations (current build)
- Manual entry only (no automatic capture yet).
- Backend is in-memory; data resets on restart and has no authentication.

## Packaging / Publishing
- Build: `npm run compile`
- Package VSIX: `npx @vscode/vsce package`
- Install local VSIX: `code --install-extension devtrace-ai-0.1.0.vsix`
- Publishing to Marketplace requires a real `publisher` value and Azure DevOps Personal Access Token configured for `vsce`.
