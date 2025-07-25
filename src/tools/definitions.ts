import { z, ZodSchema } from "zod";
import { ThunderClient } from "../thunder-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToMCPInputSchema } from "../utils/schema-converter.js";
import { resolve } from "path";
import { execSync } from 'child_process';

interface ToolDefinition<TSchema extends ZodSchema, TResult> {
    name: string;
    description: string;
    keywords?: string[];
    schema: TSchema;
    handler: (client: ThunderClient, args: z.infer<TSchema>) => Promise<TResult>;
}

function defineTool<TSchema extends ZodSchema, TResult>(
    definition: ToolDefinition<TSchema, TResult>
): ToolDefinition<TSchema, TResult> {
    return definition;
}

// Helper function to resolve project directory
function resolveProjectDir(projectDir: string): string {
    if (projectDir === "." || projectDir === "./") {
        // Execute pwd command and get the current working directory
        const currentDir = execSync('pwd', { encoding: 'utf8' }).trim();
        return currentDir;
    }

    return resolve(projectDir);
}

export const toolDefinitions = {

    thunder_curl: defineTool({
        name: "tc_create",
        description: "Create API endpoints to Thunder Client, automatically creating collections and folders if they do not already exist.",
        keywords: ["thunder client", "thunder client mcp", "tc mcp", "thunder mcp", "thunderclient"],
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
                projectDir: z.string()
                    .min(1, "projectDir is required")
                    .describe("Get the full path to the project's directory (use process.cwd() and get it)."),
            })
            .refine(data => !(data.folder && !data.collection), {
                message: "If 'folder' is provided, you must also provide 'collection'.",
                path: ["collection"],
            }),
        handler: async (client, args) => client.runCurl({ ...args, projectDir: resolveProjectDir(args.projectDir.trim()) }),
    }),

    thunder_debug: defineTool({
        name: "tc_debug",
        description: "Runs the Thunder Client debug command and display the result.",
        keywords: ["thunder client", "thunder client mcp", "tc mcp", "thunder mcp", "thunderclient"],
        schema: z.object({
            projectDir: z.string()
                .min(1, "projectDir is required")
                .describe("Get the full path to the project's directory (use process.cwd() and get it)."),
        }),
        handler: async (client, args) => client.runDebug(resolveProjectDir(args.projectDir.trim())),
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

