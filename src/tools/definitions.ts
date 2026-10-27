import { z, ZodSchema } from "zod";
import { ThunderClient } from "../thunder-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToMCPInputSchema } from "../utils/schema-converter.js";

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

// Shared parameter descriptions
const projectDirDesc = "Absolute path to the project root directory. Example: '/Users/john/my-project'.";

const authSchema = z.object({
    type: z.enum(["none", "inherit", "basic", "bearer", "oauth2", "ntlm", "aws"])
        .describe("Authentication type. 'inherit' uses the parent collection's auth settings. 'aws' and 'ntlm' are rejected: their credentials must be set in the Thunder Client UI."),
    bearer: z.string().optional()
        .describe("Bearer token value. Required when type is 'bearer'. Supports environment variables e.g. '{{accessToken}}'."),
    basic: z.object({
        username: z.string().describe("Username. Supports environment variables e.g. '{{username}}'."),
        password: z.string().describe("Password. Supports environment variables e.g. '{{password}}'."),
    }).optional()
        .describe("Basic auth credentials. Required when type is 'basic'."),
    oauth2: z.object({
        grantType: z.enum(["client_credentials", "password", "authorization_code", "implicit"])
            .describe("OAuth2 grant type."),
        tokenUrl: z.string()
            .describe("Token endpoint URL. Example: 'https://auth.example.com/oauth/token'"),
        authUrl: z.string().optional()
            .describe("Authorization endpoint URL. Required for 'authorization_code' and 'implicit' grant types. Example: 'https://auth.example.com/oauth/authorize'"),
        clientId: z.string()
            .describe("Client ID. Supports environment variables e.g. '{{clientId}}'."),
        clientSecret: z.string()
            .describe("Client secret. Supports environment variables e.g. '{{clientSecret}}'."),
        username: z.string().optional()
            .describe("Resource owner username. Required for 'password' grant type."),
        password: z.string().optional()
            .describe("Resource owner password. Required for 'password' grant type."),
        scope: z.string().optional()
            .describe("Space-separated list of requested scopes. Example: 'read write'"),
        clientAuth: z.enum(["in-header", "in-body"]).optional()
            .describe("How to send client credentials. Defaults to 'in-header'."),
    }).optional()
        .describe("OAuth2 configuration. Required when type is 'oauth2'. Example: {grantType:'client_credentials',tokenUrl:'https://auth.example.com/token',clientId:'{{clientId}}',clientSecret:'{{clientSecret}}'}"),
});

const authExamples = "Examples — bearer: {type:'bearer',bearer:'{{accessToken}}'} | basic: {type:'basic',basic:{username:'{{user}}',password:'{{pass}}'}} | oauth2: {type:'oauth2',oauth2:{grantType:'client_credentials',tokenUrl:'https://auth.example.com/token',clientId:'{{clientId}}',clientSecret:'{{clientSecret}}'}} | inherit: {type:'inherit'}";

const testsSchema = z.array(z.object({
    type: z.enum(["res-code", "res-body", "res-time", "json-query", "Content-Type", "Content-Length", "custom-header", "set-env-var"])
        .describe("Assertion type. 'res-code'=HTTP status code, 'json-query'=JSON field check, 'res-body'=raw body text, 'res-time'=response time in ms, 'Content-Type'/'Content-Length'=response headers, 'custom-header'=any response header, 'set-env-var'=extract a value to an environment variable."),
    custom: z.string().optional()
        .describe("Path or key for the assertion target. Required for 'json-query', 'set-env-var', and 'custom-header'. JSON path examples: 'json.field', 'json.a.b.c' (nested), 'json[0].field' (array index), 'json[-1].field' (last item), 'json.items[*].id' (all items), 'json.items[name=thunder].id' (filter by field value), 'json[\"key.with.dots\"]' (quoted key). Use bracket notation for array indices — 'json[0].id' is correct, 'json.0.id' is not. For 'custom-header': the header name only, e.g. 'X-Request-Id'. In 'json-query' and 'set-env-var', read a response header with 'header.Content-Type' and a cookie with 'cookie.name'. For raw body: 'text'."),
    action: z.enum(["equal", "notequal", "contains", "notcontains", "istype", "isjson", "setto", "regex", ">", ">=", "<", "<="])
        .describe("Comparison operator. 'istype' checks the value type (string/number/array/object/boolean/null). 'setto' extracts a value and is used with 'set-env-var'. Numeric operators (>, >=, <, <=) apply to 'res-time'."),
    value: z.string().optional()
        .describe("Expected value. For 'res-code': '200'. For 'istype': string/number/array/object/boolean/null. For 'res-time': milliseconds e.g. '500'. For 'set-env-var': must be a {{varName}} placeholder e.g. '{{authToken}}'. For 'regex': the pattern string."),
}));

const testsExamples = "Examples — status: {type:'res-code',action:'equal',value:'200'} | JSON field: {type:'json-query',custom:'json.id',action:'istype',value:'number'} | array item: {type:'json-query',custom:'json[0].name',action:'equal',value:'John'} | response time: {type:'res-time',action:'<=',value:'2000'} | extract to env: {type:'set-env-var',custom:'json.token',action:'setto',value:'{{accessToken}}'} | response header: {type:'custom-header',custom:'X-Request-Id',action:'contains',value:'req-'}";

const preReqSchema = z.object({
    inlineScripts: z.array(z.string()).optional()
        .describe("JavaScript statements to execute before the request is sent. Each array item is one statement. Example: [\"tc.setVar('timestamp', Date.now().toString())\", \"tc.request.setHeader('X-Nonce', tc.getVar('nonce'))\"] — read tc://docs for the full scripting API reference."),
});

const postReqSchema = z.object({
    inlineScripts: z.array(z.string()).optional()
        .describe("JavaScript statements to execute after the response is received. Each array item is one statement. Use tc.response.json, tc.response.status, tc.response.headers to read the response. Use tc.setVar() to extract values. Use tc.test(name, bool) to write assertions. Example: [\"tc.test('ok', tc.response.status === 200)\", \"tc.setVar('userId', tc.response.json.id?.toString())\"] — read tc://docs for the full scripting API reference."),
});

const docsDesc = "Documentation for this item. Array of markdown strings. Use the field name 'docs' — not 'notes' or 'description'. Example: ['## Create User', 'Creates a new user account.', '**Returns:** the created user id']";

export const toolDefinitions = {

    thunder_debug: defineTool({
        name: "debugInfo",
        description: "Returns Thunder Client setup info: CLI version, data path, collection names, and environment names. Run this first before any other tool. Environment variable values are never returned. If no environment exists, ask the user to create one in Thunder Client UI — never create or write environment files directly.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
        }),
        handler: async (client, args) => client.runDebug(args.projectDir!),
    }),

    thunder_list: defineTool({
        name: "listCollections",
        description: "Returns a flat list of all collections, folders, and requests with their _id, name, type, method, and parent info. Use this to discover existing items and obtain IDs before calling other tools. Also returns 'summary', one row per collection as {colId, name, folders, requests}. When the user asks to see or list collections, show 'summary' as a table with the columns #, Collection, Collection ID, Folders, Requests. Set includeActivity to true only when the user explicitly asks to see Activity tab requests.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            includeActivity: z.boolean().optional()
                .describe("When true, includes Activity tab requests in the result with type 'activity'. These are recently run requests with colId 'history' that have not been saved to a named collection. To save one, use the Thunder Client UI — right-click the request in the Activity tab and choose 'Add to Collection'. Default: false."),
        }),
        handler: async (client, args) => client.getList(args.projectDir!, args.includeActivity ?? false),
    }),

    thunder_list_by_id: defineTool({
        name: "getDetails",
        description: "Returns full details of a single collection, folder, or request by its _id. For a request: returns url, method, headers, params, body, auth, tests, and scripts. Sensitive auth values are masked. For a collection, also returns 'outline': a nested markdown list of its folders and requests. When showing a collection to the user, print only the collection name, its _id and 'outline' exactly as given. Do not show collection settings, folder settings or request URLs, headers, bodies or tests unless the user asks for them. Use listCollections first to obtain the _id. Do not use this to read environment files — environment variable values are never returned.",
        schema: z.object({
            id: z.string().min(1, "id is required")
                .describe("The _id of the collection, folder, or request to retrieve. Obtain from listCollections. Example: 'e63218fb-9f0b-4619-ab3a-bd68d21b4d57'"),
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
        }),
        handler: async (client, args) => client.getListById(args.id, args.projectDir!),
    }),

    thunder_list_environments: defineTool({
        name: "listEnvironments",
        description: "Returns all Thunder Client environments in the project, including which one is currently active. Environment variable values are never returned — only names and IDs are listed. Use this to verify an active environment exists before running requests that use {{varName}} placeholders. If no environment exists, ask the user to create one in Thunder Client UI — never create or write environment files directly.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
        }),
        handler: async (client, args) => client.listEnvironments(args.projectDir!),
    }),

    thunder_create_collection: defineTool({
        name: "createCollection",
        description: "Creates a new collection in Thunder Client, and optionally a folder inside it. If the collection already exists, returns success without error. After creation, use updateCollectionSettings to configure baseUrl, shared auth, or default headers.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            collection: z.string().min(1, "collection is required")
                .describe("Name of the collection to create. Example: 'Payments API'"),
            folder: z.string().optional()
                .describe("Name of a top-level folder to create inside the collection. Omit to create the collection only. Example: 'Auth'"),
        }),
        handler: async (client, args) => {
            const projectDir = args.projectDir!;
            const colResult = await client.createCollection({ projectDir, collectionName: args.collection });
            if (!colResult.success && !(colResult.error || "").includes("already exists")) {
                return colResult;
            }
            if (args.folder) {
                return client.createFolder({ projectDir, collectionName: args.collection, folderName: args.folder });
            }
            return colResult.success ? colResult : { success: true, message: `Collection '${args.collection}' already exists.` };
        },
    }),

    thunder_create_folder: defineTool({
        name: "createFolder",
        description: "Creates a folder inside an existing Thunder Client collection. Supports one level of nesting — provide parentFolderName to create a subfolder inside an existing top-level folder. Use listCollections to confirm collection and parent folder names before calling.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            collectionName: z.string().min(1, "collectionName is required")
                .describe("Name of the collection to create the folder in. Must match an existing collection name (case-insensitive)."),
            folderName: z.string().min(1, "folderName is required")
                .describe("Name of the new folder. Example: 'Users'"),
            parentFolderName: z.string().optional()
                .describe("Name of an existing top-level folder to nest the new folder inside. Omit to create a top-level folder. Example: 'Users' to create 'Users > Admin'."),
        }),
        handler: async (client, args) => client.createFolder({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_curl: defineTool({
        name: "createRequest",
        description: "Creates a new API request in Thunder Client from a curl command string. Use this for new requests only — to modify an existing request, use updateRequest instead. The curl string is parsed to extract URL, method, headers, and body. Optionally saves into a collection and folder. If no collection is provided, the request is saved to Activity only.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            curlInput: z.string().min(1, "curlInput is required")
                .describe("A valid curl command string. Must start with 'curl '. Include query parameters directly in the URL — e.g. 'curl https://api.example.com/posts?postId=1&limit=5'. Example: \"curl https://api.example.com/users -X POST -H 'Content-Type: application/json' -d '{\\\"name\\\":\\\"John\\\"}'\""),
            name: z.string().min(1, "name is required")
                .describe("Display name for the request. Example: 'Create User'"),
            collection: z.string().optional()
                .describe("Name of the collection to save the request into. If omitted, the request is saved to Activity only."),
            folder: z.string().optional()
                .describe("Name of the folder within the collection to save the request into. Requires collection to be set."),
            auth: authSchema.optional()
                .describe("Authentication configuration. Omit if the Authorization header is already present in the curl command. " + authExamples),
            tests: testsSchema.optional()
                .describe("Test assertions to run after the response. " + testsExamples),
            preReq: preReqSchema.optional()
                .describe("Pre-request script. Runs before the request is sent."),
            postReq: postReqSchema.optional()
                .describe("Post-request script. Runs after the response is received. Use tc.setVar() here to extract values to environment variables."),
            docs: z.array(z.string()).optional()
                .describe(docsDesc),
        }),
        handler: async (client, args) => client.createRequest({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_edit_request: defineTool({
        name: "updateRequest",
        description: "Updates an existing Thunder Client request by its ID. Only the fields provided are modified — omitted fields retain their current values. To rename only, provide reqId and name. Moving a request to a different collection or folder is not supported — use Thunder Client UI for that.",
        schema: z.object({
            reqId: z.string().min(1, "reqId is required")
                .describe("The _id of the request to update. Obtain from listCollections. Example: 'e63218fb-9f0b-4619-ab3a-bd68d21b4d57'"),
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            name: z.string().optional()
                .describe("New display name for the request. Example: 'Create User'"),
            url: z.string().optional()
                .describe("Request URL. If the collection has a baseUrl set in settings, provide the path only e.g. '/users/{{userId}}'. Otherwise provide the full URL. Do not use '{{baseUrl}}' as a prefix — Thunder Client prepends the baseUrl automatically."),
            method: z.string().optional()
                .describe("HTTP method. Accepted values: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS."),
            headers: z.array(z.object({
                name: z.string().describe("Header name. Example: 'Content-Type'"),
                value: z.string().describe("Header value. Example: 'application/json'"),
                isDisabled: z.boolean().optional().describe("When true, the header is saved but not sent."),
            })).optional()
                .describe("Request headers. Replaces all existing headers — include every header that should be present. Example: [{name:'Content-Type',value:'application/json'},{name:'X-Api-Key',value:'{{apiKey}}'}]"),
            params: z.array(z.object({
                name: z.string().describe("Parameter name."),
                value: z.string().describe("Parameter value. Supports environment variables e.g. '{{userId}}'."),
                isPath: z.boolean().optional().describe("When true, treated as a path parameter. The URL must use {name} token syntax, e.g. url '/users/{id}' with param name 'id'. When false or omitted, treated as a query parameter."),
                isDisabled: z.boolean().optional().describe("When true, the parameter is saved but not sent."),
            })).optional()
                .describe("Query or path parameters. Replaces all existing parameters. Example: [{name:'page',value:'1'},{name:'limit',value:'10'}]"),
            body: z.object({
                type: z.enum(["none", "json", "text", "xml", "formdata", "formencoded", "graphql", "binary"])
                    .describe("Body content type. 'json'=JSON payload (use raw field), 'text'=plain text (use raw field), 'xml'=XML (use raw field), 'graphql'=GraphQL query (use raw field), 'formencoded'=URL-encoded form (use form field), 'formdata'=multipart form (use form field), 'none'=no body, 'binary'=binary file (not supported via MCP)."),
                raw: z.string().optional()
                    .describe("Raw body string. Used for json, text, xml, and graphql body types. Supports environment variables. Example for JSON: '{\"name\":\"John\",\"age\":30}'. Example for GraphQL: '{\"query\":\"{ users { id name } }\"}'."),
                form: z.array(z.object({
                    name: z.string(),
                    value: z.string(),
                })).optional()
                    .describe("Form fields. Used for formdata and formencoded body types. Example: [{name:'username',value:'{{username}}'},{name:'password',value:'{{password}}'}]"),
            }).optional()
                .describe("Request body. Examples — JSON: {type:'json',raw:'{\"title\":\"Hello\"}'} | form: {type:'formencoded',form:[{name:'email',value:'{{email}}'}]} | GraphQL: {type:'graphql',raw:'{\"query\":\"{ me { id } }\"}'}"),
            auth: authSchema.optional()
                .describe("Authentication configuration. Replaces the existing auth setting. " + authExamples),
            tests: testsSchema.optional()
                .describe("Test assertions. Replaces all existing tests. " + testsExamples),
            preReq: preReqSchema.optional()
                .describe("Pre-request script. Replaces the existing pre-request script."),
            postReq: postReqSchema.optional()
                .describe("Post-request script. Replaces the existing post-request script."),
            docs: z.array(z.string()).optional()
                .describe(docsDesc),
        }),
        handler: async (client, args) => client.editRequest({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_set_settings: defineTool({
        name: "updateCollectionSettings",
        description: "Sets or updates settings on a Thunder Client collection or folder. Settings are inherited by all requests inside — use this to configure shared auth, default headers, base URL, and run options. Only the fields provided are updated; existing settings are preserved. Pass createIfNotExists to auto-create the collection if it does not exist. Pass newName to rename the collection or folder — can be combined with settings changes or used alone.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            collectionName: z.string().min(1, "collectionName is required")
                .describe("Name of the collection to update. Must match an existing collection name."),
            folderName: z.string().optional()
                .describe("Name of the folder to update settings on. Omit to apply settings at the collection level."),
            newName: z.string().optional()
                .describe("Renames the collection or folder. When folderName is provided, renames that folder; otherwise renames the collection. Can be used alone or combined with settings changes."),
            createIfNotExists: z.boolean().optional()
                .describe("When true, creates the collection if it does not already exist. Default: false."),
            settings: z.object({
                auth: authSchema.optional()
                    .describe("Default authentication inherited by all requests in this collection or folder that have auth type 'inherit'. " + authExamples),
                headers: z.array(z.object({
                    name: z.string(),
                    value: z.string(),
                    isDisabled: z.boolean().optional(),
                })).optional()
                    .describe("Default headers added to every request. Example: [{name:'X-Api-Key',value:'{{apiKey}}'}]"),
                tests: testsSchema.optional()
                    .describe("Default tests applied to every request in this collection or folder. " + testsExamples),
                envId: z.string().optional()
                    .describe("ID of the environment to associate with this collection."),
                docs: z.array(z.string()).optional()
                    .describe("Documentation for this collection or folder. Array of markdown strings."),
                options: z.object({
                    baseUrl: z.string().optional()
                        .describe("Base URL prepended to all request URLs in this collection. Example: 'https://api.example.com'. Once set, request URLs should be paths only e.g. '/users'."),
                }).optional()
                    .describe("Collection-level options."),
                preReq: preReqSchema.optional()
                    .describe("Pre-request script applied before every request in this collection or folder."),
                postReq: postReqSchema.optional()
                    .describe("Post-request script applied after every request in this collection or folder."),
                runOptions: z.object({
                    iterations: z.number().optional()
                        .describe("Number of times to repeat the collection run. Default: 1."),
                    delay: z.number().optional()
                        .describe("Delay in milliseconds between requests. Default: 0."),
                    dataFilePath: z.string().optional()
                        .describe("Relative path to a CSV data file for parameterised runs. Example: 'data/users.csv'"),
                    stopOnFail: z.boolean().optional()
                        .describe("When true, stops the run after the first failed request."),
                    concurrent: z.number().optional()
                        .describe("Number of requests to run concurrently. Default: 1 (sequential)."),
                    runType: z.string().optional()
                        .describe("Run mode. Use 'performance' for load testing."),
                    vusers: z.number().optional()
                        .describe("Number of virtual users for performance runs."),
                    duration: z.number().optional()
                        .describe("Duration in minutes for performance runs."),
                    perfType: z.string().optional()
                        .describe("Performance run type e.g. 'fixed'."),
                }).optional()
                    .describe("Default run options for the collection runner. Example: {iterations:3,delay:500,stopOnFail:true}"),
            }).optional()
                .describe("Settings to apply. Omit entirely when using only newName to rename."),
        }),
        handler: async (client, args) => client.setSettings({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_run: defineTool({
        name: "runRequest",
        description: "Executes a single Thunder Client request by name or ID and returns the response. Automatically uses the active environment — omit env unless a specific override is needed. Returns the raw CLI output including status code, response body, and test results.",
        schema: z.object({
            nameOrId: z.string().min(1, "nameOrId is required")
                .describe("Name or _id of the request to execute. Obtain from listCollections."),
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            env: z.string().optional()
                .describe("Environment name to use for this run. Omit to use the active environment automatically. Example: 'staging'"),
        }),
        handler: async (client, args) => client.runRequest({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_run_collection: defineTool({
        name: "runCollection",
        description: "Runs all requests in a Thunder Client collection (or a specific folder) and returns the full test report. Automatically uses the active environment. Returns per-request pass/fail results, test assertion details, response times, and a summary with total / passed / failed / skipped counts for iterations and requests, plus test assertion counts. When showing the result, always end with a section headed '**Summary Report**' containing a markdown table with columns 'Name', 'Total', 'Passed', 'Failed', 'Skipped' and exactly two rows: 'Total Iterations' from summary.iterations and 'Total Requests' from summary.requests.",
        schema: z.object({
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
            collectionName: z.string().min(1, "collectionName is required")
                .describe("Name of the collection to run. Obtain the exact name from listCollections."),
            folderName: z.string().optional()
                .describe("Name of a folder within the collection to run. Omit to run all requests in the collection."),
            env: z.string().optional()
                .describe("Environment name to use for this run. Omit to use the active environment automatically."),
            stopOnFail: z.boolean().optional()
                .describe("When true, stops the run after the first failed request. Default: false."),
            iterations: z.number().int().min(1).optional()
                .describe("Number of times to repeat the full collection run. Default: 1."),
            delay: z.number().int().min(0).optional()
                .describe("Delay in milliseconds between requests. Default: 0."),
            concurrent: z.number().int().min(1).optional()
                .describe("Number of requests to run concurrently. Default: 1 (sequential)."),
            report: z.array(z.enum(["html", "json", "xml", "nunit", "csv"])).optional()
                .describe("Report file formats to save in the project's thunder-reports folder. Omit to save no report files — the run result is returned either way. Example: ['html']"),
        }),
        handler: async (client, args) => client.runCollection({ ...args, projectDir: args.projectDir! }),
    }),

    thunder_delete_request: defineTool({
        name: "deleteRequest",
        description: "Permanently deletes a Thunder Client request by its ID. This action cannot be undone. Returns the deleted request's name, method, and URL on success. Use listCollections to obtain the request ID before calling.",
        schema: z.object({
            reqId: z.string().min(1, "reqId is required")
                .describe("The _id of the request to delete. Obtain from listCollections. Example: 'e63218fb-9f0b-4619-ab3a-bd68d21b4d57'"),
            projectDir: z.string().min(1, "projectDir is required")
                .describe(projectDirDesc),
        }),
        handler: async (client, args) => client.deleteRequest(args.reqId, args.projectDir!),
    }),

} as const;

// Tool annotations — signals to the MCP client how to handle each tool
// readOnlyHint: true   — never writes data
// destructiveHint: true — action cannot be undone; client should prompt for confirmation
// idempotentHint: true  — safe to retry; same result if called multiple times
const toolAnnotations: Record<string, { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; title?: string }> = {
    debugInfo:                { readOnlyHint: true,  destructiveHint: false, idempotentHint: true,  title: "Debug Info" },
    listCollections:          { readOnlyHint: true,  destructiveHint: false, idempotentHint: true,  title: "List Collections" },
    getDetails:               { readOnlyHint: true,  destructiveHint: false, idempotentHint: true,  title: "Get Details" },
    listEnvironments:         { readOnlyHint: true,  destructiveHint: false, idempotentHint: true,  title: "List Environments" },
    createCollection:         { readOnlyHint: false, destructiveHint: false, idempotentHint: false, title: "Create Collection" },
    createFolder:             { readOnlyHint: false, destructiveHint: false, idempotentHint: false, title: "Create Folder" },
    createRequest:            { readOnlyHint: false, destructiveHint: false, idempotentHint: false, title: "Create Request" },
    updateRequest:            { readOnlyHint: false, destructiveHint: false, idempotentHint: true,  title: "Update Request" },
    updateCollectionSettings: { readOnlyHint: false, destructiveHint: false, idempotentHint: true,  title: "Update Collection Settings" },
    runRequest:               { readOnlyHint: false, destructiveHint: false, idempotentHint: false, title: "Run Request" },
    runCollection:            { readOnlyHint: false, destructiveHint: false, idempotentHint: false, title: "Run Collection" },
    deleteRequest:            { readOnlyHint: false, destructiveHint: true,  idempotentHint: false, title: "Delete Request" },
};

export const tools: Tool[] = Object.values(toolDefinitions).map(def => ({
    name: def.name,
    description: def.description.trim(),
    inputSchema: zodToMCPInputSchema(def.schema),
    ...(toolAnnotations[def.name] && { annotations: toolAnnotations[def.name] }),
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
