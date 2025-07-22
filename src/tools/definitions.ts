import { z, ZodSchema } from "zod";
import { ThunderClient } from "../thunder-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToMCPInputSchema } from "../utils/schema-converter.js";

// ----------------------------
// ToolDefinition Interface
// ----------------------------
interface ToolDefinition<TSchema extends ZodSchema, TResult> {
  name: string;
  description: string;
  schema: TSchema;
  handler: (client: ThunderClient, args: z.infer<TSchema>) => Promise<TResult>;
}

// ----------------------------
// Factory: defineTool()
// ----------------------------
function defineTool<TSchema extends ZodSchema, TResult>(
  definition: ToolDefinition<TSchema, TResult>
): ToolDefinition<TSchema, TResult> {
  return definition;
}

// ----------------------------
// Tool Definitions
// ----------------------------
export const toolDefinitions = {

  thunder_help: defineTool({
  name: "tc_help",
  description: "Show Thunder Client CLI help using `tc --help` in the given project directory.",
  schema: z.object({
    projectDir: z.string().min(1, "projectDir is required"),
  }),
  handler: async (client, args) => {
    const projectDir = args.projectDir.trim() || "/";
    return client.thunder_help(projectDir);
  },
}),
thunder_debug: defineTool({
  name: "tc_debug",
  description: "Show Thunder Client CLI debug using `tc --debug` in the given project directory.",
  schema: z.object({
    projectDir: z.string().min(1, "projectDir is required"),
  }),
  handler: async (client, args) => {
    const projectDir = args.projectDir.trim() || "/";
    return client.thunder_debug(projectDir);
  },
}),

thunder_curl: defineTool({
  name: "tc_curl",
  description: "Run a full curl command via Thunder Client CLI. Supports saving the request to a collection or folder.",
  schema: z.object({
    curlInput: z
      .string()
      .min(5)
      .refine((val) => val.trim().toLowerCase().startsWith("curl "), {
        message: "Input must start with 'curl '",
      }),
    name: z.string().optional(),
    collection: z.string().optional(),
    folder: z.string().optional(),
    projectDir: z.string().min(1, "projectDir is required"),
  }),
  handler: async (client, args) => {
    const projectDir = args.projectDir.trim() || "/";
    return client.runCurl({ ...args, projectDir });
  },
}),
} as const;

// ----------------------------
// Exported MCP-Compatible Tools
// ----------------------------
export const tools: Tool[] = Object.values(toolDefinitions).map((def) => ({
  name: def.name,
  description: def.description,
  inputSchema: zodToMCPInputSchema(def.schema),
}));

// ----------------------------
// Tool Handlers (name => definition)
// ----------------------------
export const toolHandlers = Object.fromEntries(
  Object.values(toolDefinitions).map((def) => [def.name, def])
);

// ----------------------------
// Constant Export: Tool Names
// ----------------------------
export const toolNames = Object.fromEntries(
  Object.entries(toolDefinitions).map(([key, def]) => [key.toUpperCase(), def.name])
) as Record<string, string>;

// ----------------------------
// Type Helpers
// ----------------------------
export type ToolName =
  (typeof toolDefinitions)[keyof typeof toolDefinitions]["name"];

export type ToolArgs<T extends ToolName> = z.infer<
  (typeof toolDefinitions)[Extract<keyof typeof toolDefinitions, string>]["schema"]
>;