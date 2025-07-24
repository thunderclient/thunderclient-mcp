# Thunder Client MCP

A Model Context Protocol (MCP) server that integrates Thunder Client functionality into various AI development environments including Cline, Continue.dev, and GitHub Copilot.

## Available Tools

This MCP server provides three powerful tools for managing Thunder Client operations:

### 1. `tc_help`
**Description:** Show Thunder Client CLI help using `tc --help` in the given project directory.
- **Usage:** Get comprehensive help documentation for Thunder Client CLI
- **Parameters:** 
  - `projectDir` (required): Path to your Thunder Client project directory

### 2. `tc_debug`
**Description:** Show Thunder Client CLI debug information using `tc --debug` in the given project directory.
- **Usage:** Troubleshoot and get detailed debug information from Thunder Client
- **Parameters:**
  - `projectDir` (required): Path to your Thunder Client project directory

### 3. `tc_create`
**Description:** Save endpoints or APIs to Thunder Client using tc-curl and automatically create collections and folders if needed.
- **Usage:** Convert curl commands into Thunder Client requests with automatic organization
- **Parameters:**
  - `curlInput` (required): A full curl command starting with 'curl'
  - `name` (required): A descriptive name for the request (minimum 2 characters)
  - `collection` (optional): Collection name to organize the request
  - `folder` (optional): Subfolder within the collection (requires collection to be specified)
  - `projectDir` (required): Path to your Thunder Client project directory

## Installation & Setup

### Prerequisites
```bash
npm i
npm run build
```
After building, a `dist` folder will be created. Copy the `index.js` path from the `dist` folder - this path will be used in your MCP server configuration.

---

## Model Configuration (For All Environments)

Regardless of which environment you're using (Cline, Continue.dev, or GitHub Copilot), you'll need to configure your AI model:

1. Navigate to your **Models** section (usually located beside Agent or in settings)
2. Click on **Manage Model** or **Model Settings**
3. Set your **OpenAI API key** or configure your preferred AI provider
4. Select an appropriate model such as **gpt-4**, **gpt-4-turbo**, or **claude-3.5-sonnet**
5. Save your configuration

**Note:** Model configuration steps may vary slightly between different environments, but the core requirements remain the same across all platforms.

---

## Configuration for Different Environments

### For Cline

1. Open Cline and navigate to the **MCP Server** section
2. Click on **Installed**
3. Click on **Configure the MCP Server**
4. Add the following configuration inside the `mcpServers` JSON:

```json
{
  "mcpServers": {
    "thunderclient": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/thunder-mcp/dist/index.js"
      ]
    }
  }
}
```

**Important:** Replace `/path/to/thunder-mcp/dist/index.js` with the actual path to your `index.js` file from the `dist` folder.

Once configured, you can use all `tc_*` command tools in Cline's MCP interface.

---

### For Continue.dev

1. Add a new **MCP server** to your configuration
2. Switch to **Agent mode** instead of Chat mode
3. Configure using the following YAML structure:

```yaml
name: Thunder Client MCP Server
version: 0.0.1
schema: v1
mcpServers:
  - name: Thunder Client MCP Server
    command: node
    args:
      - /path/to/thunder-mcp/dist/index.js
```

**Important:** Replace `/path/to/thunder-mcp/dist/index.js` with your actual `index.js` location.

---

### For GitHub Copilot

1. Switch to **Agent mode** from Chat mode
2. Click on the **Tools** icon in the interface
3. Scroll down and click **+ Add more tools**
4. Select **+ Add MCP Server**
5. Choose **Stdio** as the connection type
6. Enter the correct path to `node` and your `thunder-mcp/dist/index.js` file
7. Save the configuration

---

## Troubleshooting

### If the Agent Is Not Executing Commands Properly

1. **Use Attach Context:** Utilize the **Attach Context** option in your AI environment
2. **Attach Required Files:** Include relevant files and specifically attach the `tc_create` tool context
3. **Provide Clear Prompts:** Give detailed, specific prompts to assist with command execution

### Common Issues

- **Path Issues:** Ensure all file paths are absolute and correctly formatted for your operating system
- **Node.js Version:** Verify you're using a compatible Node.js version
- **Permissions:** Check that the MCP server has appropriate file system permissions
- **Project Directory:** Ensure the `projectDir` parameter points to a valid Thunder Client workspace

---

## Contributing

Feel free to contribute to this project by submitting issues or pull requests to improve functionality and compatibility with different AI development environments.