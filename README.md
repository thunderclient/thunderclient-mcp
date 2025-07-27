# Thunder Client MCP Server

The Thunder Client MCP server leverages AI to create requests and collections. It can be used in various AI development environments, including Cline, Continue.dev, and GitHub Copilot.

## Requirements

- A **Business** or **Enterprise** plan subscription is required to use the Thunder Client MCP Server.
- View Thunder Client pricing plans [here](https://www.thunderclient.com/pricing).

## Available Tools

This MCP server provides three powerful tools for managing Thunder Client operations:

### 1. `tc_create`

**Description:**  
Saves API endpoints to Thunder Client, automatically creating collections and folders if they do not already exist.

**Usage:**

- Use AI to analyze your current project and automatically generate API requests in Thunder Client, with the appropriate collection and folder created as needed.
- Add new requests to a specific collection in Thunder Client.
- Dynamically create a request using an AI-generated prompt.

### 2. `tc_debug`

**Description:** Show Thunder Client CLI debug information using `tc --debug` in the given project directory.

- **Usage:** Troubleshoot and get detailed debug information from Thunder Client



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
      "name": "Thunder Client MCP Server",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thunderclient-mcp"]
    }
  }
}
```

**Important:** Replace `thunderclient-mcp` with `/path/to/thunder-mcp/dist/index.js` with your actual `index.js` location in local Dev mode.

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
    command: npx
    args:
      - thunderclient-mcp
```

**Important:** Replace `thunderclient-mcp` with `/path/to/thunder-mcp/dist/index.js` with your actual `index.js` location in local Dev mode.

---

### For GitHub Copilot

1. Switch to **Agent mode** from Chat mode
2. Click on the **Tools** icon in the interface
3. Scroll down and click **+ Add more tools**
4. Select **+ Add MCP Server**
   ![alt text](https://raw.githubusercontent.com/thunderclient/thunderclient-mcp/refs/heads/main/public/copolit_add_mcp_server.png)
5. Choose **Stdio** as the connection type
6. Enter the command to run as `npx thunderclient-mcp`
7. Enter the mcp name `thunderclient-mcp-server-....`
8. Choose where to install MCP, select `Global` or `User`
9. Save the configuration

**Important:** Replace `npx thunderclient-mcp` with `node /path/to/thunder-mcp/dist/index.js` with your actual `index.js` location in local Dev mode.

# Example Prompts

This document contains simple example prompts for the `tc_create` tool to extract APIs from code files and save them to Thunder Client.

## Extract APIs from Code Files

### 1. Extract APIs from Current Project

```
"Get the endpoints from the current project and save them with collection name 'My API' using Thunder Client MCP."
```

### 2. Extract APIs from Files and Folders

```
"Get the endpoints from app/main.py and save them with collection name 'E-commerce API' and folder name 'Products' using Thunder Client MCP."
```

```
"Get the endpoints from the src/routes/ folder and save them with collection name 'Node API' using Thunder Client MCP."
```

### 3. Create Simple HTTP Requests

```
"Create a POST request to https://api.example.com/users with a JSON body and an Authorization header using Thunder Client MCP."
```

## Running Locally

```bash
npm i
npm run build
```

After building, a `dist` folder will be created. Copy the `index.js` path from the `dist` folder - this path will be used in your MCP server configuration.

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
