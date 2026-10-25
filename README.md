<p align="center">
  <img src="https://github.com/thunderclient/thunder-client-support/blob/21d62c97dcc8168dc678b165fe678fd12c2f476b/images/thunder-icon.png" width="120" height="120" />
</p>

# Thunder Client MCP Server

The Thunder Client MCP server lets AI assistants create, manage, and run API requests and collections directly in Thunder Client — without leaving your editor.

Compatible with **Claude Code**, **Codex**, **GitHub Copilot**, **Cursor**, **Windsurf**, and any MCP-compatible AI tool.

## Documentation

For requirements, installation, and setup instructions, see the [Thunder Client MCP documentation](https://docs.thunderclient.com/mcp).

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
