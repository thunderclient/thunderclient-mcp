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

## Documentation

For installation and setup instructions for each AI tool, see the [Thunder Client MCP documentation](https://docs.thunderclient.com/mcp).

## Available Tools

| Tool | Description |
|------|-------------|
| `debugInfo` | Verify project setup, CLI version, collections, and environments |
| `listCollections` | Browse all collections, folders, and requests |
| `getDetails` | Get full details of any item by ID |
| `listEnvironments` | List environment names and active status |
| `createCollection` | Create a new collection, optionally with a folder |
| `createFolder` | Add a folder to a collection |
| `createRequest` | Create a request from a curl command |
| `updateRequest` | Update name, URL, method, headers, body, auth, tests, or scripts |
| `updateCollectionSettings` | Set baseUrl, shared auth, default headers, or run options |
| `runRequest` | Execute a single request |
| `runCollection` | Run a collection or folder and get the full test report |
| `deleteRequest` | Delete a request permanently |

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

To build locally:

```bash
git clone https://github.com/thunderclient/thunderclient-mcp
cd thunderclient-mcp
npm install
npm run build
```

Then point your MCP config at `node /path/to/thunderclient-mcp/dist/index.js` instead of `npx -y thunderclient-mcp`.

## Audit

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/thunderclient-thunderclient-mcp-badge.png)](https://mseep.ai/app/thunderclient-thunderclient-mcp)
