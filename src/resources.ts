import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const TC_DOCS = `# Thunder Client — Documentation Links

## ABSOLUTE RULE: No direct file editing
NEVER read, write, or edit thunder-tests/ files or any TC data files directly.
If an operation is not supported by MCP tools, tell the user to do it in the Thunder Client UI.
Do NOT offer file editing as a workaround — ever.

## Official Docs
- Getting Started: https://docs.thunderclient.com
- CLI Reference:   https://docs.thunderclient.com/cli
- Scripting API:   https://docs.thunderclient.com/scripting
- Environments:    https://docs.thunderclient.com/environments
- Tests:           https://docs.thunderclient.com/tests
- Auth:            https://docs.thunderclient.com/auth

## Scripting API Quick Reference
Full reference: https://docs.thunderclient.com/scripting

tc.setVar(name, value)         — set an environment variable
tc.getVar(name)                — get an environment variable
tc.response.status             — HTTP status code (number)
tc.response.json               — parsed JSON response body
tc.response.headers            — response headers object
tc.response.body               — raw response body string

## RULE: Always use baseUrl in collection settings
Never hardcode the base URL in every request. Instead:
1. Use updateSettings to set options.baseUrl on the collection e.g. "https://api.example.com"
2. Use ONLY the path in request URLs e.g. "/users/{{userId}}" or "/posts"
   TC automatically prepends the baseUrl — do NOT use {{baseUrl}} in URLs.
   WRONG: "{{baseUrl}}/posts" or "https://api.example.com/posts"
   CORRECT: "/posts"

Then inform the user:
  "I've set baseUrl to 'https://api.example.com' in the collection settings."

## Common token flow pattern
Step 1 — Create login request with postReq script:
  tc.setVar('accessToken', tc.response.json.token)
  (inform user: "please ensure an active environment exists before running")

Step 2 — Run login via runRequest
  Token is saved to active env as 'accessToken'

Step 3 — Create other requests using:
  auth: { type: "bearer", bearer: "{{accessToken}}" }
  TC substitutes {{accessToken}} automatically at runtime
`;

const TC_ENV_GUIDE = `# Thunder Client — Environment Variables Guide

## ABSOLUTE RULE: Never read or edit thunder-tests files directly
NEVER use any file read, write, or edit tools on thunder-tests/ files or any Thunder Client data files.
NEVER offer to "edit the JSON file directly" — this is strictly forbidden regardless of what the user asks.
NEVER edit, move, delete, or restructure files as a workaround when a tool doesn't support an operation.

If an operation is not supported by the MCP tools (e.g. moving a folder, deleting a request):
- Tell the user clearly: "This operation is not supported yet."
- Tell the user to do it manually in the Thunder Client UI.
- DO NOT attempt to achieve it by editing files directly.
- DO NOT offer file editing as an alternative.

Always use MCP tools only:
- debugInfo    — see project setup, collections list, environment names
- getCollections     — browse collections, folders, requests
- getDataById  — get full details of any item by ID
- updateSettings, updateRequest, createFolder — write via tools only

## The MCP never reads or writes environment files
Environment files may contain secrets (tokens, passwords, API keys).
The MCP only uses {{varName}} placeholders in requests — the user manages actual values in the TC UI.

## RULE: Always inform the user when you use {{varName}}
Whenever you set a {{varName}} placeholder in a request, you MUST tell the user:
  "I've used {{varName}} in this request. Please add 'varName' to your active Thunder Client environment."

Example message to user:
  "I've set auth to {{accessToken}}. Please open Thunder Client → Environments,
   select your active environment, and add 'accessToken' with your token value."

## How tc.setVar works in postReq scripts
- tc.setVar('accessToken', tc.response.json.token) saves the value to the ACTIVE environment
- The variable persists after the run and can be used as {{accessToken}} in other requests
- REQUIRES an active environment to exist — if none exists, tc.setVar has nowhere to save

## User setup checklist (tell this to the user when needed)
□ Open Thunder Client → Environments panel
□ Click "New Environment" or select an existing one
□ Click the star icon to make it the Active environment
□ Add variable name (e.g. accessToken) — value can be empty initially
□ Run the login request — the postReq script will populate it automatically
□ {{accessToken}} will now resolve in all subsequent requests

## If a run fails with missing variable
Tell the user: "The variable 'varName' is not set in your active environment.
Please open Thunder Client → Environments, select your active environment, and add 'varName'."
`;

const resources = [
    {
        uri: "tc://docs",
        name: "Thunder Client Documentation",
        description: "Official Thunder Client documentation links and scripting API quick reference.",
        mimeType: "text/markdown",
    },
    {
        uri: "tc://env-guide",
        name: "Environment Variables Guide",
        description: "How to handle env vars, tokens, and secrets. Rules for when to inform the user, how to use baseUrl in settings, and the token-from-login flow.",
        mimeType: "text/markdown",
    },
];

export function registerResources(server: Server) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources,
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;

        if (uri === "tc://docs") {
            return {
                contents: [{ uri, mimeType: "text/markdown", text: TC_DOCS }],
            };
        }

        if (uri === "tc://env-guide") {
            return {
                contents: [{ uri, mimeType: "text/markdown", text: TC_ENV_GUIDE }],
            };
        }

        throw new Error(`Resource not found: ${uri}`);
    });
}
