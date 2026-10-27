import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export function zodToMCPInputSchema(schema: z.ZodSchema): Tool["inputSchema"] {
    try {
        // Zod v4 has toJSONSchema() built in — use it directly
        const jsonSchema = (schema as any).toJSONSchema?.() as any;

        if (jsonSchema && jsonSchema.type === "object") {
            return {
                type: "object",
                properties: jsonSchema.properties || {},
                required: Array.isArray(jsonSchema.required) ? jsonSchema.required : [],
                ...(jsonSchema.description && { description: jsonSchema.description }),
            } as Tool["inputSchema"];
        }

        // Fallback if schema is wrapped (e.g. ZodEffects from .refine())
        // Extract the inner schema's JSON and return it
        if (jsonSchema) {
            return jsonSchema as Tool["inputSchema"];
        }
    } catch (error) {
        console.warn("Failed to convert schema:", error);
    }

    return { type: "object", properties: {}, required: [] } as Tool["inputSchema"];
}
