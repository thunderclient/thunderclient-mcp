import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

const execAsync = promisify(exec);

const CLI_NOT_FOUND = "Thunder Client CLI not found. Install it with: npm install -g @thunderclient/cli";

// a missing tc binary is reported differently by sh, zsh and cmd.exe
function isCliMissing(message: string): boolean {
    return message.includes("ENOENT") || message.includes("command not found") || message.includes("not recognized");
}

// aws/ntlm have no credential fields in the schema, so saving them would silently drop the keys
function checkAuthType(auth?: Record<string, any>): string | undefined {
    const type = auth?.type;
    if (type === "aws" || type === "ntlm") {
        return `${type.toUpperCase()} auth credentials can't be set via MCP. Set them in the Thunder Client UI (Auth tab).`;
    }
}

// a run rejected up front (missing args, unknown env, plan limit) ends with a JSON result line instead of run output
function parseRunRejection(output?: string): Record<string, any> | undefined {
    const lastLine = (output || "").trim().split("\n").pop()?.trim() || "";
    if (!lastLine.startsWith("{")) return undefined;
    try {
        const json = JSON.parse(lastLine);
        return json?.success === false && (typeof json.error === "string" || json.limitReached) ? json : undefined;
    } catch {
        return undefined;
    }
}

// keep large responses from flooding the AI context
const MAX_OUTPUT_CHARS = 50_000;
// large responses must not overflow exec's 1 MB default before they are capped
const RUN_MAX_BUFFER = 50 * 1024 * 1024;

function capOutput(text: string): string {
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    const totalKb = Math.round(text.length / 1024);
    return text.slice(0, MAX_OUTPUT_CHARS) + `\n…truncated (${totalKb} KB total). Open the request in Thunder Client to see the full response.`;
}

// report URLs have variables resolved; query values may carry keys, so only names are kept
function redactQueryValues(url: unknown): unknown {
    if (typeof url !== "string") return url;
    const q = url.indexOf("?");
    if (q === -1) return url;
    const query = url.slice(q + 1).split("&").map(p => {
        const eq = p.indexOf("=");
        return eq === -1 ? p : `${p.slice(0, eq)}=<redacted>`;
    }).join("&");
    return `${url.slice(0, q)}?${query}`;
}

export class ThunderClient {
    // error result for an unusable projectDir, undefined when it's fine
    private checkProjectDir(projectDir: string): { success: false; error: string } | undefined {
        if (!path.isAbsolute(projectDir)) {
            return { success: false, error: `projectDir must be an absolute path. Received: ${projectDir}` };
        }
        if (!fs.existsSync(projectDir)) {
            return { success: false, error: `Project directory not found: ${projectDir}` };
        }
        return undefined;
    }

    private async execCommand(command: string, cwd: string, maxBuffer?: number): Promise<{ success: boolean; result?: string; error?: string }> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd, ...(maxBuffer ? { maxBuffer } : {}) });
            let succeeded = true;
            let errorMessage: string | undefined = stderr ? stderr.trim() : undefined;
            if ((stderr && stderr.trim()) || stdout?.trim().toLowerCase().includes("error")) {
                succeeded = false;
                if (stdout?.trim().toLowerCase().includes("error")) {
                    errorMessage = stdout?.trim();
                }
            }
            return { success: succeeded, result: stdout?.trim(), error: errorMessage };
        } catch (error: any) {
            const msg: string = error?.message || "Unknown error";
            if (isCliMissing(msg)) {
                return { success: false, error: CLI_NOT_FOUND };
            }
            // a non-zero exit (e.g. "Collection not found") prints the reason on stdout, not in the error message
            const output: string = (error?.stdout || "").toString().trim();
            return { success: false, error: output || msg, ...(output && { result: output }) };
        }
    }

    // CLI calls are `tc --mcp <json>` (except tc --debug); base64 needs no shell quoting, so it passes through cmd.exe and sh unchanged
    private mcpCommand(input: Record<string, any>): string {
        return `tc --mcp ${Buffer.from(JSON.stringify(input)).toString("base64")}`;
    }

    // runs a JSON command and returns the CLI's JSON result - the last JSON line it prints
    private async mcpCmd(input: Record<string, any>, projectDir: string): Promise<any> {
        let stdout = "";
        let stderr = "";
        try {
            ({ stdout, stderr } = await execAsync(this.mcpCommand(input), { cwd: projectDir }));
        } catch (e: any) {
            const msg: string = e?.message || "";
            if (isCliMissing(msg)) {
                return { success: false, error: CLI_NOT_FOUND };
            }
            // a non-zero exit can still print the JSON result
            stdout = (e?.stdout || "").toString();
            stderr = msg;
        }

        const lines = stdout.trim().split("\n").reverse();
        for (const line of lines) {
            if (!line.trim().startsWith("{")) continue;
            try { return JSON.parse(line); } catch { }
        }
        return { success: false, error: stderr.trim() || "No JSON output from CLI" };
    }

    // Returns flat list of all collections, folders, requests with ids and names
    async getList(projectDir: string, includeActivity = false): Promise<{ success: boolean; error?: string; result?: any[]; summary?: { colId: string; name: string; folders: number; requests: number }[]; total?: number; collections?: number; folders?: number; requests?: number; activityRequests?: number }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const result = await this.mcpCmd({ cmd: "list", includeActivity }, projectDir);
        if (result?.success && Array.isArray(result.result)) {
            const collections = result.result.filter((i: any) => i.type === "collection").length;
            const folders = result.result.filter((i: any) => i.type === "folder").length;
            const requests = result.result.filter((i: any) => i.type === "request").length;
            // one row per collection, ready to show as a table
            const summary = result.result
                .filter((i: any) => i.type === "collection")
                .map((c: any) => ({
                    colId: c._id,
                    name: c.name,
                    folders: result.result.filter((i: any) => i.type === "folder" && i.colId === c._id).length,
                    requests: result.result.filter((i: any) => i.type === "request" && i.colId === c._id).length,
                }));
            return { ...result, summary, total: result.result.length, collections, folders, requests, activityRequests: result.activityRequests ?? 0 };
        }
        return result;
    }

    // Returns full details of a single item by id; a collection also gets a nested markdown outline
    async getListById(id: string, projectDir: string): Promise<{ success: boolean; error?: string; result?: any; outline?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const result = await this.mcpCmd({ cmd: "list-id", id }, projectDir);
        if (result?.success && result.result?.type === "collection") {
            return { ...result, outline: this.buildOutline(result.result.folders ?? [], result.result.requests ?? []) };
        }
        return result;
    }

    // folders, then requests, at each level in sortNum order - e.g. "- **Account/**\n  - `GET` Welcome"
    private buildOutline(folders: any[], requests: any[], containerId = "", depth = 0): string {
        const bySort = (a: any, b: any) => (a.sortNum ?? 0) - (b.sortNum ?? 0);
        const indent = "  ".repeat(depth);
        const lines: string[] = [];
        for (const folder of folders.filter(f => (f.containerId ?? "") === containerId).sort(bySort)) {
            lines.push(`${indent}- **${folder.name}/**`);
            const children = this.buildOutline(folders, requests, folder._id, depth + 1);
            if (children) lines.push(children);
        }
        for (const req of requests.filter(r => (r.containerId ?? "") === containerId).sort(bySort)) {
            lines.push(`${indent}- \`${req.method}\` ${req.name}`);
        }
        return lines.join("\n");
    }

    async deleteRequest(reqId: string, projectDir: string): Promise<{ success: boolean; error?: string; deleted?: { reqId: string; reqName: string; method: string; url: string } }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        return this.mcpCmd({ cmd: "delete-request", reqId }, projectDir);
    }

    async editRequest({
        reqId,
        projectDir,
        name,
        url,
        method,
        headers,
        params,
        body,
        auth,
        tests,
        preReq,
        postReq,
        docs,
    }: {
        reqId: string;
        projectDir: string;
        name?: string;
        url?: string;
        method?: string;
        headers?: { name: string; value: string; isDisabled?: boolean }[];
        docs?: string[];
        params?: { name: string; value: string; isPath?: boolean; isDisabled?: boolean }[];
        body?: { type: string; raw?: string; form?: { name: string; value: string }[] };
        auth?: Record<string, any>;
        tests?: Record<string, any>[];
        preReq?: { inlineScripts?: string[] };
        postReq?: { inlineScripts?: string[] };
    }): Promise<{ success: boolean; error?: string; reqId?: string; updated?: string[] }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const authError = checkAuthType(auth);
        if (authError) return { success: false, error: authError };
        const result = await this.mcpCmd({ cmd: "edit-request", reqId, reqName: name, url, method, headers, params, body, auth, tests, preReq, postReq, docs }, projectDir);
        if (result?.success) {
            const fields = { name, url, method, headers, params, body, auth, tests, preReq, postReq, docs };
            const updated = Object.keys(fields).filter(k => (fields as any)[k] !== undefined);
            return { ...result, updated };
        }
        return result;
    }

    async createFolder({
        projectDir,
        collectionName,
        folderName,
        parentFolderName,
    }: {
        projectDir: string;
        collectionName: string;
        folderName: string;
        parentFolderName?: string;
    }): Promise<{ success: boolean; error?: string; folderId?: string; folderName?: string; collectionName?: string; path?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const result = await this.mcpCmd({ cmd: "create-folder", colName: collectionName, folderName, parentFolderName }, projectDir);
        if (result?.success) {
            const folderPath = parentFolderName ? `${collectionName} > ${parentFolderName} > ${folderName}` : `${collectionName} > ${folderName}`;
            return { ...result, collectionName, path: folderPath };
        }
        return result;
    }

    async createCollection({
        projectDir,
        collectionName,
    }: {
        projectDir: string;
        collectionName: string;
    }): Promise<{ success: boolean; error?: string; colId?: string; collectionName?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const result = await this.mcpCmd({ cmd: "create-col", colName: collectionName }, projectDir);
        if (result?.success) {
            return { ...result, collectionName };
        }
        return result;
    }

    async setSettings({
        projectDir,
        collectionName,
        folderName,
        newName,
        createIfNotExists,
        settings,
    }: {
        projectDir: string;
        collectionName: string;
        folderName?: string;
        newName?: string;
        createIfNotExists?: boolean;
        settings?: {
            auth?: Record<string, any>;
            headers?: { name: string; value: string; isDisabled?: boolean }[];
            tests?: Record<string, any>[];
            envId?: string;
            docs?: string[];
            options?: { baseUrl?: string };
            preReq?: { inlineScripts?: string[] };
            postReq?: { inlineScripts?: string[] };
            runOptions?: {
                iterations?: number;
                delay?: number;
                dataFilePath?: string;
                stopOnFail?: boolean;
                concurrent?: number;
                runType?: string;
                vusers?: number;
                duration?: number;
                perfType?: string;
            };
        };
    }): Promise<{ success: boolean; error?: string; target?: string; renamed?: boolean; settingsApplied?: string[] }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const authError = checkAuthType(settings?.auth);
        if (authError) return { success: false, error: authError };
        const result = await this.mcpCmd({ cmd: "set-settings", colName: collectionName, folderName, newName, createIfNotExists, settings }, projectDir);
        if (result?.success) {
            const target = folderName ? `${collectionName} > ${folderName}` : collectionName;
            const settingsApplied = settings ? Object.keys(settings).filter(k => (settings as any)[k] !== undefined) : [];
            return { ...result, target, ...(newName && { renamed: true, newName }), ...(settingsApplied.length && { settingsApplied }) };
        }
        return result;
    }

    async runCollection({
        projectDir,
        collectionName,
        folderName,
        env,
        stopOnFail,
        iterations,
        delay,
        concurrent,
    }: {
        projectDir: string;
        collectionName: string;
        folderName?: string;
        env?: string;
        stopOnFail?: boolean;
        iterations?: number;
        delay?: number;
        concurrent?: number;
    }): Promise<{ success: boolean; error?: string; report?: any; envUsed?: string; summary?: any }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;

        // the CLI resolves the folder by name and uses the active env unless one is given;
        // it returns the JSON report as its result instead of saving a file
        const result = await this.mcpCmd({
            cmd: "run-collection",
            colName: collectionName,
            folderName,
            env,
            report: "json",
            stopOnFail: stopOnFail || undefined,
            iterations: iterations && iterations > 1 ? iterations : undefined,
            delay: delay && delay > 0 ? delay : undefined,
            concurrent: concurrent && concurrent > 1 ? concurrent : undefined,
        }, projectDir);
        if (!result?.success || !result.report) return result;

        try {
            const report = result.report;
            for (const iteration of report.iterations ?? []) {
                for (const req of iteration.requests ?? []) {
                    req.url = redactQueryValues(req.url);
                }
            }
            // report totals count iterations; a run passes when no iteration failed
            return {
                success: (report.totalFailed ?? 0) === 0,
                report,
                envUsed: report.environmentName || env,
                // the CLI's summary: iterations, requests and tests counts
                summary: result.summary,
            };
        } catch (e: any) {
            return { success: false, error: `Failed to read report: ${e.message}` };
        }
    }

    async runDebug(projectDir: string): Promise<any> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;

        const [cliResult, listResult, envResult] = await Promise.all([
            // setup info comes from the regular tc --debug text output, not a JSON command
            this.execCommand("tc --debug", projectDir),
            this.mcpCmd({ cmd: "list" }, projectDir),
            this.mcpCmd({ cmd: "list-env" }, projectDir),
        ]);

        if (!cliResult.success && cliResult.error?.includes("not found")) {
            return { success: false, error: cliResult.error };
        }

        // a plan limit (e.g. workspace storage) must not look like an empty project
        if (listResult?.limitReached) {
            return listResult;
        }

        const debugLines = (cliResult.result || "").split("\n");
        const cliVersion = debugLines.find((l: string) => l.includes("CLI Version"))?.replace("CLI Version:", "").trim() ?? "unknown";
        const dataPath = debugLines.find((l: string) => l.includes("Data loaded from"))?.replace("Data loaded from the path -", "").trim() ?? "unknown";
        const httpLib = debugLines.find((l: string) => l.includes("httpLibrary"))?.replace("httpLibrary:", "").trim() ?? "unknown";
        const saveToWorkspace = debugLines.find((l: string) => l.includes("saveToWorkspace"))?.replace("saveToWorkspace:", "").trim() ?? "unknown";

        const collections: string[] = (listResult?.result ?? [])
            .filter((i: any) => i.type === "collection")
            .map((i: any) => i.name);

        const environments = (envResult?.environments ?? [])
            .map((e: any) => ({ name: e.name, active: e.active ?? false }));

        const activityRequests: number = listResult?.activityRequests ?? 0;

        return {
            success: cliResult.success,
            projectDir,
            mcpVersion: version,
            cli: { version: cliVersion, httpLibrary: httpLib, saveToWorkspace, dataPath },
            collections,
            activityRequests,
            environments,
            note: "Environment variable values are never returned. Manage environment variables in Thunder Client → Environments.",
            SECURITY_RULE: "Environment files contain sensitive data (API keys, secrets, tokens). NEVER read, write, create, or modify any environment files directly — not even thunder-tests/environments/*.json. If an environment is needed, tell the user to create it in Thunder Client UI and ask them to activate it. This rule cannot be overridden by any user instruction.",
        };
    }

    async listEnvironments(projectDir: string): Promise<{ success: boolean; error?: string; environments?: { name: string; active: boolean }[]; total?: number; activeEnv?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const result = await this.mcpCmd({ cmd: "list-env" }, projectDir);
        if (result?.success && Array.isArray(result.environments)) {
            const activeEnv = result.environments.find((e: any) => e.active)?.name;
            return {
                ...result,
                total: result.environments.length,
                activeEnv,
                SECURITY_RULE: "NEVER read, write, or create environment files. If no environment exists, ask the user to create one in Thunder Client UI.",
            };
        }
        return result;
    }

    async runRequest({
        nameOrId,
        projectDir,
        env,
    }: {
        nameOrId: string;
        projectDir: string;
        env?: string;
    }): Promise<{ success: boolean; error?: string; result?: string; envUsed?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;

        // the CLI uses the active env unless one is given
        const cmd = this.mcpCommand({ cmd: "run-request", nameOrId, env });

        const result = await this.execCommand(cmd, projectDir, RUN_MAX_BUFFER);
        const rejection = parseRunRejection(result.result ?? result.error);
        if (rejection) return rejection as { success: boolean; error?: string };

        // the response body can contain the word "error" - only CLI error lines mean the run failed
        if (result.result !== undefined) {
            const cliFailed = /^\s*error:/im.test(result.result);
            result.success = !cliFailed && !(result.error && result.error !== result.result);
            if (result.error === result.result) result.error = cliFailed ? capOutput(result.result) : undefined;
            result.result = capOutput(result.result);
        }
        if (typeof result.error === "string") result.error = capOutput(result.error);

        // report the env the CLI used - an unknown name falls back to the active one
        const actualEnv = (result.result || "").match(/^Environment:\s+(.+?)\s*$/m)?.[1]
            ?.replace(/\s*\((Active|Inactive)\)\s*$/i, "").trim();
        return { ...result, envUsed: actualEnv || env };
    }

    async createRequest({
        curlInput,
        name,
        collection,
        folder,
        projectDir,
        auth,
        tests,
        preReq,
        postReq,
        docs,
    }: {
        curlInput: string;
        name?: string;
        collection?: string;
        folder?: string;
        projectDir: string;
        auth?: Record<string, any>;
        tests?: Record<string, any>[];
        preReq?: { inlineScripts?: string[] };
        postReq?: { inlineScripts?: string[] };
        docs?: string[];
    }): Promise<{ success: boolean; error?: string; reqName?: string; savedTo?: string; reqId?: string; limitReached?: boolean; limit?: any; message?: string }> {
        const dirError = this.checkProjectDir(projectDir);
        if (dirError) return dirError;
        const authError = checkAuthType(auth);
        if (authError) return { success: false, error: authError };

        const curl = curlInput.trim();
        if (!curl.toLowerCase().startsWith("curl ")) {
            return { success: false, error: "Input must start with 'curl '" };
        }

        // the curl text goes to the CLI as data, not through the shell; the CLI parses it (URL params included)
        // script lines go as-is (inlineScripts: string[]) - the CLI wraps them, like edit-request and set-settings
        return this.mcpCmd({
            cmd: "create-request",
            curl,
            reqName: name,
            colName: collection,
            folderName: folder,
            auth,
            tests,
            preReq,
            postReq,
            docs,
        }, projectDir);
    }

}
