#!/usr/bin/env node
import { ThunderClient } from "./thunder-client.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolHandlers, tools } from "./tools/definitions.js";

const thunderClient = new ThunderClient();

const server = new Server(
  {
    name: "thunderclient-mcp",
    version: "1.0.0",
    title: "Thunder Client MCP",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const toolDefinition = toolHandlers[name];
    if (!toolDefinition) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    const validatedArgs = toolDefinition.schema.parse(args);
    const result = await toolDefinition.handler(thunderClient, validatedArgs as any);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      content: [
        {
          type: "text",
          text: `Error calling tool ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`Thunder Client MCP server is running...`);
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});