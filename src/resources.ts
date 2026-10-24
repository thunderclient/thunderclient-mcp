import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const TC_DOCS = `# Thunder Client — Overview and Guidelines

## What is Thunder Client?

Thunder Client is a lightweight REST API client for VS Code. It supports HTTP requests,
collections, environments, scripting, and test assertions — all stored as local JSON files
in the project's thunder-tests folder.

## Working with Thunder Client via MCP

All read and write operations must go through the provided MCP tools. Do not read, write,
or edit thunder-tests files or any Thunder Client data files directly. If an operation is
not supported by the available tools, inform the user and direct them to the Thunder Client UI.

## Tool Overview

| Tool | Purpose |
|---|---|
| debugInfo | Verify project setup, CLI version, collections, and environments |
| listCollections | Browse collections, folders, and requests |
| getDetails | Retrieve full details of any item by ID |
| listEnvironments | List environment names and active status |
| createCollection | Create a new collection, optionally with a folder |
| createFolder | Add a folder to a collection |
| createRequest | Import a request from a curl command |
| updateRequest | Update name, URL, method, headers, body, auth, or tests |
| updateCollectionSettings | Set collection or folder options, baseUrl, or rename |
| runRequest | Execute a single request |
| runCollection | Run a collection or folder |
| deleteRequest | Delete a request from a collection or the Activity tab |

## URL and baseUrl Convention

Set baseUrl on the collection using updateCollectionSettings, then use only the path in request URLs.
Thunder Client prepends baseUrl automatically at runtime.

Correct:   url: "/users/{{userId}}"
Incorrect: url: "https://api.example.com/users/{{userId}}"
Incorrect: url: "{{baseUrl}}/users/{{userId}}"

After setting baseUrl, inform the user:
  "I have set the base URL to 'https://api.example.com' in the collection settings."

## Token Flow Pattern

Step 1 — Create a login request with a postReq script to capture the token:
  tc.setVar('accessToken', tc.response.json.token)
  Inform the user: "An active environment is required for tc.setVar to persist the token."

Step 2 — Run the login request via runRequest.
  The token is saved to the active environment as 'accessToken'.

Step 3 — Reference the token in subsequent requests:
  auth: { type: "bearer", bearer: "{{accessToken}}" }

## Scripting API Reference

Full reference: https://docs.thunderclient.com/scripting

**Variables**
tc.setVar(name, value, scope?)   — Save a value; scope: 'local' | 'global' | 'request' (default: active env)
tc.getVar(name)                  — Read a value from the active environment
tc.replaceVars(text)             — Resolve {{varName}} placeholders in a string

**Request object** (preReq and postReq — read/modify before send)
tc.request.url                   — Request URL string
tc.request.method                — HTTP method
tc.request.setHeader(name, val)  — Set a request header
tc.request.getHeader(name)       — Get a request header value
tc.request.setBody(body, type?)  — Set the request body
tc.request.url.getParam(name)    — Get a query parameter value
tc.request.url.setParam(name, v) — Set a query parameter value

**Response object** (postReq only)
tc.response.json                 — Parsed JSON body
tc.response.text                 — Raw body string
tc.response.status               — HTTP status code (number)
tc.response.time                 — Response time in ms
tc.response.size                 — Response size in bytes
tc.response.contentType          — Content-Type header value
tc.response.headers              — Response headers object
tc.response.cookies              — Response cookies
tc.response.getHeader(name)      — Get a specific response header
tc.response.getBinary()          — Get response as binary

**Assertions** (postReq)
tc.test(name, boolExpr)          — Write a named test assertion
expect / assert                  — Chai assertion globals

**Info** (read-only, both)
tc.info.environmentName, tc.info.requestName, tc.info.collectionName
tc.info.folderName, tc.info.currentIteration, tc.info.totalIterations

**Control / Utilities**
tc.delay(ms)                     — Pause execution
tc.runRequest(reqId)             — Run another request by ID
tc.retryRequest()                — Retry the current request
tc.skipRequest(reqId)            — Skip a request in a collection run
tc.getCookies(url?)              — Get cookies
tc.setCookie(url, name, value)   — Set a cookie
tc.readFile(path, encoding?)     — Read a file
tc.loadModule(name)              — Load a built-in npm module

**Built-in modules** (via tc.loadModule)
crypto-js, axios, uuid, chai, ajv, papaparse, fast-xml-parser, tough-cookie

**Globals**
btoa(str) / atob(str)            — Base64 encode / decode

## Official Documentation

- Getting Started: https://docs.thunderclient.com
- CLI Reference:   https://docs.thunderclient.com/cli
- Scripting API:   https://docs.thunderclient.com/scripting
- Environments:    https://docs.thunderclient.com/environments
- Tests:           https://docs.thunderclient.com/tests
- Auth:            https://docs.thunderclient.com/auth
`;

const TC_ENV_GUIDE = `# Thunder Client — Environments and Variables

## Environment Files

Thunder Client environment files may contain sensitive values such as tokens, passwords,
and API keys. The MCP server never reads or writes environment files. Only variable name
placeholders in the form {{varName}} are used in requests — the user manages actual values
in the Thunder Client UI.

## Using Variables in Requests

Use {{varName}} syntax wherever a dynamic value is needed — in URLs, headers, body, or auth fields.
Thunder Client substitutes the value from the active environment at runtime.

Whenever you set a {{varName}} placeholder, inform the user which variable needs to be defined:
  "I have used {{accessToken}} in this request. Please add 'accessToken' to your active
   Thunder Client environment."

## How tc.setVar Works

tc.setVar('accessToken', tc.response.json.token) saves a value to the active environment
after a request runs. The variable persists and can be referenced as {{accessToken}} in
subsequent requests. An active environment must exist for tc.setVar to have a target.

## Setting Up an Environment (guide for users)

1. Open Thunder Client → Environments panel
2. Click "New Environment" or select an existing one
3. Click the star icon to mark it as the active environment
4. Add the required variable name (the value can be empty initially)
5. Run the login or token request — the postReq script will populate the value automatically
6. {{varName}} will now resolve in all subsequent requests

## Unsupported Operations

If an operation is not supported by the available MCP tools, inform the user clearly and
direct them to perform it in the Thunder Client UI. Do not attempt to work around tool
limitations by editing files directly.
`;

const resources = [
    {
        uri: "tc://docs",
        name: "Thunder Client Documentation",
        description: "Thunder Client overview, tool reference, URL conventions, token flow pattern, and scripting API quick reference.",
        mimeType: "text/markdown",
    },
    {
        uri: "tc://env-guide",
        name: "Environment Variables Guide",
        description: "How to handle environment variables, tokens, and secrets in Thunder Client. Covers {{varName}} usage, tc.setVar behaviour, and user setup steps.",
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
