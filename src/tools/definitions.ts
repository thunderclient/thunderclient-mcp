import { z, ZodSchema } from "zod";
import { ThunderClient } from "../thunder-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToMCPInputSchema } from "../utils/schema-converter.js";

interface ToolDefinition<TSchema extends ZodSchema, TResult> {
  name: string;
  description: string;
  schema: TSchema;
  handler: (client: ThunderClient, args: z.infer<TSchema>) => Promise<TResult>;
}

function defineTool<TSchema extends ZodSchema, TResult>(
  definition: ToolDefinition<TSchema, TResult>
): ToolDefinition<TSchema, TResult> {
  return definition;
}

export const toolDefinitions = {
  thunder_help: defineTool({
    name: "tc_help",
    description: "Show Thunder Client CLI help using `tc --help` in the given project directory.",
    schema: z.object({
      projectDir: z.string().min(1, "projectDir is required"),
    }),
    handler: async (client, args) => client.thunder_help(args.projectDir.trim()),
  }),

  thunder_debug: defineTool({
    name: "tc_debug",
    description: "Show Thunder Client CLI debug using `tc --debug` in the given project directory.",
    schema: z.object({
      projectDir: z.string().min(1, "projectDir is required"),
    }),
    handler: async (client, args) => client.thunder_debug(args.projectDir.trim()),
  }),

  thunder_curl: defineTool({
    name: "tc_create",
    description: "Saves API endpoints to Thunder Client, automatically creating collections and folders if they do not already exist.",
    schema: z
      .object({
        curlInput: z
          .string()
          .min(5, { message: "curlInput must be at least 5 characters long" })
          .refine(val => val.trim().toLowerCase().startsWith("curl "), {
            message: "curlInput must start with 'curl '",
          }),
        name: z.string().min(2, { message: "Name must be at least 2 characters" }),
        collection: z.string().optional(),
        folder: z.string().optional(),
        projectDir: z.string().min(1, { message: "projectDir is required" }),
      })
      .refine(data => !(data.folder && !data.collection), {
        message: "If 'folder' is provided, you must also provide 'collection'.",
        path: ["collection"],
      }),
    handler: async (client, args) => client.runCurl({ ...args, projectDir: args.projectDir.trim() }),
  }),
} as const;

export const tools: Tool[] = Object.values(toolDefinitions).map(def => ({
  name: def.name,
  description: def.description.trim(),
  inputSchema: zodToMCPInputSchema(def.schema),
}));

export const toolHandlers = Object.fromEntries(
  Object.values(toolDefinitions).map(def => [def.name, def])
);

export const toolNames = Object.fromEntries(
  Object.entries(toolDefinitions).map(([key, def]) => [key.toUpperCase(), def.name])
) as Record<string, string>;

export type ToolName = (typeof toolDefinitions)[keyof typeof toolDefinitions]["name"];

export type ToolArgs<T extends ToolName> = z.infer<
  (typeof toolDefinitions)[Extract<keyof typeof toolDefinitions, string>]["schema"]
>;

