# Thunder MCP

## How to Run

```bash
npm i
npm run build
```

- After building, a `dist` folder will be created.
- Copy the `index.js` path from the `dist` folder. This path will be used in the MCP server configuration.

---

## For Cline

1. Open Cline and go to the **MCP Server** section.
2. Click on **Installed**.
3. Click on **Configure the MCP Server**.
4. Add the following inside the `mcpServers` JSON:

```json
{
  "mcpServers": {
    "thunderclient": {
      "disabled": false,
      "timeout": 60,
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/thuderclient-mcp/dist/index.js"
      ],
      "autoApprove": [
        "tc help"
      ]
    }
  }
}
```

- Make sure to replace the path with the correct path to `index.js` from the `dist` folder.
- Once configured, you can use the `tc` command tools in MCP of Cline.

---

## In Continue.dev

1. Add an **MCP server**.
2. Switch to **Agent mode** instead of Chat.
3. Configure the YAML as below:

```yaml
name: Thunder Client MCP Server
version: 0.0.1
schema: v1
mcpServers:
  - name: Thunder Client MCP Server
    command: node
    args:
      - /path/thuderclient-mcp/dist/index.js
```

- Replace the path with your actual `index.js` location.

---

## In Copilot

1. Switch to **Agent mode** from Chat.
2. Click on the **Tools** icon.
3. Scroll down and click **+ Add more tools**, then select **+ Add MCP Server**.
4. Select **Stdio**.
5. Enter the correct path to `node` and the `path/dist/index.js` file, then save.

---

## Model Setup

1. In Copilot, go to **Models** beside Agent.
2. Click on **Manage Model**.
3. Set your **OpenAI API key**.
4. Select a model such as **gpt-4**.

---

## If the Agent Is Not Executing Commands Properly

- Use the **Attach Context** option.
- Attach required files and tools such as `tc_curl`.
- Provide the appropriate prompt to assist execution.