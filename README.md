<p align="center">
  <img src="https://github.com/thunderclient/thunder-client-support/blob/21d62c97dcc8168dc678b165fe678fd12c2f476b/images/thunder-icon.png" width="120" height="120" />
</p>

# Thunder Client MCP Server

The Thunder Client MCP server lets AI assistants create, manage, and run API requests and collections directly in Thunder Client — without leaving your editor.

Compatible with **Claude Code**, **Codex**, **GitHub Copilot**, **Cursor**, **Windsurf**, and any MCP-compatible AI tool.

## Documentation

For requirements, installation, and setup instructions, see the [Thunder Client MCP documentation](https://docs.thunderclient.com/mcp).

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
