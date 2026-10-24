<p align="center">
  <img src="https://github.com/thunderclient/thunder-client-support/blob/21d62c97dcc8168dc678b165fe678fd12c2f476b/images/thunder-icon.png" width="120" height="120" />
</p>

# Thunder Client MCP Server

The Thunder Client MCP server lets AI assistants create, manage, and run API requests and collections directly in Thunder Client — without leaving your editor.

Compatible with **Claude Code**, **Codex**, **GitHub Copilot**, **Cursor**, **Windsurf**, and any MCP-compatible AI tool.

## Requirements

- Available on all plans, including the Free plan (with limits). View plans at [thunderclient.com/pricing](https://www.thunderclient.com/pricing).
- [Thunder Client VS Code extension](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client) must be installed.
- [Thunder Client CLI](https://docs.thunderclient.com/cli) **version 2.1.0 or later** must be installed and available in PATH: `npm install -g @thunderclient/cli` (check with `tc --version`)

## Installation

### Claude Code

Run this command in your terminal:

```bash
claude mcp add thunderclient -- npx -y thunderclient-mcp
```

### Codex

Run this command in your terminal:

```bash
codex mcp add thunderclient -- npx -y thunderclient-mcp
```

### GitHub Copilot CLI

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "thunderclient": {
      "command": "npx",
      "args": ["-y", "thunderclient-mcp"]
    }
  }
}
```

Or run the interactive installer inside the Copilot CLI:

```bash
/mcp add
```

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` for all projects):

```json
{
  "mcpServers": {
    "thunderclient": {
      "command": "npx",
      "args": ["-y", "thunderclient-mcp"]
    }
  }
}
```

### Windsurf

Add to `.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "thunderclient": {
      "command": "npx",
      "args": ["-y", "thunderclient-mcp"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your project, then enable the Thunder Client tools in Copilot Chat's Agent mode:

```json
{
  "servers": {
    "thunderclient": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thunderclient-mcp"]
    }
  }
}
```

### Local Development

```bash
git clone https://github.com/thunderclient/thunderclient-mcp
cd thunderclient-mcp
npm install
npm run build
```

Then replace `npx -y thunderclient-mcp` with `node /path/to/thunderclient-mcp/dist/index.js` in your config.

## Available Tools

| Tool | Description |
|------|-------------|
| `debugInfo` | Verify project setup, CLI version, collections, and environments |
| `getCollections` | Browse all collections, folders, and requests |
| `getDataById` | Get full details of any item by ID |
| `listEnvironments` | List environment names and active status |
| `createCollection` | Create a new collection, optionally with a folder |
| `createFolder` | Add a folder to a collection |
| `createRequest` | Create a request from a curl command |
| `updateRequest` | Update name, URL, method, headers, body, auth, tests, or scripts |
| `updateSettings` | Set baseUrl, shared auth, default headers, or run options |
| `runRequest` | Execute a single request |
| `runCollection` | Run a collection or folder and get the full test report |
| `deleteRequest` | Delete a request permanently |

## Example Prompts

### Set up a full API collection

```
Set up a Thunder Client collection for https://api.example.com in my project at /Users/john/my-project.
Create a base URL setting, bearer token auth using {{accessToken}}, and requests for:
- POST /auth/login (capture the token from the response)
- GET /users
- POST /users
- PUT /users/{id}
- DELETE /users/{id}
Add a status 200 test to each request, then run the collection.
```

### Extract APIs from your codebase

```
Look at the routes in src/routes/ and create a Thunder Client collection called "My API"
in my project at /Users/john/my-project. Group requests by resource into folders.
```

### Run and debug

```
Run the "Payments API" collection in my project at /Users/john/my-project
and show me which tests failed.
```

### Quick request

```
Create a POST request to https://api.example.com/users with JSON body
{"name":"John","email":"john@example.com"} and save it to the "Users" collection
in my project at /Users/john/my-project.
```

## Resources

The MCP server exposes two resources that provide guidance to the AI:

- **`tc://docs`** — Tool overview, URL conventions, token flow pattern, and scripting API reference
- **`tc://env-guide`** — How to handle environment variables and secrets safely

## Notes

- Environment variable **values** are never returned — only names and IDs are listed. Manage values in Thunder Client → Environments.
- Sensitive auth values (tokens, passwords, secrets) are masked in responses.
- Responses from requests you run, including the response body, are shared with your AI assistant. Avoid running requests whose responses contain secrets you don't want the assistant to see.
- AWS and NTLM credentials can't be set via MCP — set them in the Thunder Client UI.
- SSE, WebSocket, and gRPC requests must be created and run in the Thunder Client UI.
- `projectDir` must be an absolute path to your project root. The CLI resolves the Thunder Client data location automatically based on your settings.

## Troubleshooting

- **`tc` not found** — make sure `@thunderclient/cli` is installed globally (`npm install -g @thunderclient/cli`) and on your PATH
- **"No JSON output from CLI"** — your CLI is older than 2.1.0. Update it: `npm install -g @thunderclient/cli@latest`
- **No collections found** — run `debugInfo` to verify the project directory and data path
- **`{{varName}}` values aren't resolving** — set an active environment in Thunder Client → Environments

---

## Contributing

Issues and pull requests are welcome at [github.com/thunderclient/thunderclient-mcp](https://github.com/thunderclient/thunderclient-mcp).

## Audit

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/thunderclient-thunderclient-mcp-badge.png)](https://mseep.ai/app/thunderclient-thunderclient-mcp)
