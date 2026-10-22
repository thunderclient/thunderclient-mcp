import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

const execAsync = promisify(exec);

// aws/ntlm have no credential fields in the schema, so saving them would silently drop the keys
function checkAuthType(auth?: Record<string, any>): string | undefined {
    const type = auth?.type;
    if (type === "aws" || type === "ntlm") {
        return `${type.toUpperCase()} auth credentials can't be set via MCP. Set them in the Thunder Client UI (Auth tab).`;
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
    private validateProjectDir(projectDir: string): { valid: boolean; error?: string } {
        if (!path.isAbsolute(projectDir)) {
            return { valid: false, error: `projectDir must be an absolute path. Received: ${projectDir}` };
        }
        if (!fs.existsSync(projectDir)) {
            return { valid: false, error: `Project directory not found: ${projectDir}` };
        }
        return { valid: true };
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
            if (msg.includes("ENOENT") || msg.includes("command not found") || msg.includes("not recognized")) {
                return { success: false, error: "Thunder Client CLI not found. Install it with: npm install -g @thunderclient/cli" };
            }
            // a non-zero exit (e.g. "Collection not found") prints the reason on stdout, not in the error message
            const output: string = (error?.stdout || "").toString().trim();
            return { success: false, error: output || msg, ...(output && { result: output }) };
        }
    }

    // every CLI call is `tc --mcp <json>`; base64 needs no shell quoting, so it passes through cmd.exe and sh unchanged
    private mcpCommand(input: Record<string, any>): string {
        return `tc --mcp ${Buffer.from(JSON.stringify(input)).toString("base64")}`;
    }

    private async mcpCmd(input: Record<string, any>, projectDir: string): Promise<any> {
        const { stdout, stderr } = await execAsync(this.mcpCommand(input), { cwd: projectDir }).catch(e => {
            const msg: string = e.message || "";
            if (msg.includes("ENOENT") || msg.includes("command not found") || msg.includes("not recognized")) {
                return { stdout: "", stderr: "Thunder Client CLI not found. Install it with: npm install -g @thunderclient/cli" };
            }
            return { stdout: "", stderr: msg };
        });
        const lines = stdout.trim().split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
            try { return JSON.parse(lines[i]); } catch { }
        }
        return { success: false, error: stderr || "No JSON output from CLI" };
    }

    // Returns flat list of all collections, folders, requests with ids and names
    async getList(projectDir: string, includeActivity = false): Promise<{ success: boolean; error?: string; result?: any[]; total?: number; collections?: number; folders?: number; requests?: number; activityRequests?: number }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const result = await this.mcpCmd({ cmd: "list", includeActivity }, projectDir);
        if (result?.success && Array.isArray(result.result)) {
            const collections = result.result.filter((i: any) => i.type === "collection").length;
            const folders = result.result.filter((i: any) => i.type === "folder").length;
            const requests = result.result.filter((i: any) => i.type === "request").length;
            return { ...result, total: result.result.length, collections, folders, requests, activityRequests: result.activityRequests ?? 0 };
        }
        return result;
    }

    // Returns full details of a single item by id
    async getListById(id: string, projectDir: string): Promise<{ success: boolean; error?: string; result?: any }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        return this.mcpCmd({ cmd: "list-id", id }, projectDir);
    }

    async deleteRequest(requestId: string, projectDir: string): Promise<{ success: boolean; error?: string; deleted?: { requestId: string; name: string; method: string; url: string } }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        return this.mcpCmd({ cmd: "delete-request", requestId }, projectDir);
    }

    async editRequest({
        requestId,
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
        requestId: string;
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
    }): Promise<{ success: boolean; error?: string; requestId?: string; updated?: string[] }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const authError = checkAuthType(auth);
        if (authError) return { success: false, error: authError };
        const result = await this.mcpCmd({ cmd: "edit-request", requestId, name, url, method, headers, params, body, auth, tests, preReq, postReq, docs }, projectDir);
        if (result?.success) {
            // scripts dropped by the CLI must not appear as updated
            const scriptsDropped = typeof result.warning === "string" && result.warning.includes("scripting");
            const updated = [name && "name", url && "url", method && "method", headers && "headers", params && "params", body && "body", auth && "auth", tests && "tests", !scriptsDropped && preReq && "preReq", !scriptsDropped && postReq && "postReq", docs && "docs"].filter(Boolean) as string[];
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
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
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
    }): Promise<{ success: boolean; error?: string; collectionId?: string; collectionName?: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const result = await this.mcpCmd({ cmd: "create-col", name: collectionName }, projectDir);
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
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const authError = checkAuthType(settings?.auth);
        if (authError) return { success: false, error: authError };
        const result = await this.mcpCmd({ cmd: "set-settings", collectionName, folderName, newName, createIfNotExists, settings }, projectDir);
        if (result?.success) {
            const target = folderName ? `${collectionName} > ${folderName}` : collectionName;
            // scripts dropped by the CLI must not appear as applied
            const scriptsDropped = typeof result.warning === "string" && result.warning.includes("scripting");
            const settingsApplied = settings
                ? Object.keys(settings).filter(k => (settings as any)[k] !== undefined
                    && !(scriptsDropped && (k === "preReq" || k === "postReq")))
                : [];
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
    }): Promise<{ success: boolean; error?: string; report?: any; envUsed?: string; summary?: { total: number; passed: number; failed: number } }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };

        // the CLI resolves the folder by name and uses the active env unless one is given
        const cmd = this.mcpCommand({
            cmd: "run-collection",
            collectionName,
            folderName,
            env,
            report: "json",
            stopOnFail: stopOnFail || undefined,
            iterations: iterations && iterations > 1 ? iterations : undefined,
            delay: delay && delay > 0 ? delay : undefined,
            concurrent: concurrent && concurrent > 1 ? concurrent : undefined,
        });

        const reportsDir = path.join(projectDir, "thunder-reports");
        const beforeFiles = fs.existsSync(reportsDir)
            ? new Set(fs.readdirSync(reportsDir))
            : new Set<string>();

        const cmdResult = await this.execCommand(cmd, projectDir);

        if (!cmdResult.success && cmdResult.error?.includes("not found")) {
            return { success: false, error: cmdResult.error };
        }

        if (!fs.existsSync(reportsDir)) {
            return {
                success: false,
                error: `Run failed — no report generated. Verify that the collection name is correct and that an active environment exists if requests use {{varName}} placeholders. CLI output: ${cmdResult.result || cmdResult.error || "no output"}`,
            };
        }

        const newFiles = fs.readdirSync(reportsDir)
            .filter(f => f.endsWith(".json") && !beforeFiles.has(f))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(reportsDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);


        // only a report from THIS run is valid - never fall back to an older file
        const reportFile = newFiles[0];
        if (!reportFile) {
            return { success: false, error: `Run produced no report. Verify the collection name is correct. CLI output: ${cmdResult.result || cmdResult.error || "no output"}` };
        }

        try {
            const report = JSON.parse(fs.readFileSync(path.join(reportsDir, reportFile.name), "utf-8"));
            for (const iteration of report.iterations ?? []) {
                for (const req of iteration.requests ?? []) {
                    req.url = redactQueryValues(req.url);
                }
            }
            const failed = report.totalFailed ?? 0;
            const passed = report.totalPassed ?? 0;
            const total = report.totalRequests ?? (passed + failed);
            return {
                success: failed === 0,
                report,
                envUsed: report.environmentName || env,
                summary: { total, passed, failed },
            };
        } catch (e: any) {
            return { success: false, error: `Failed to read report: ${e.message}` };
        }
    }

    async runDebug(projectDir: string): Promise<any> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };

        const [cliResult, listResult, envResult] = await Promise.all([
            this.execCommand(this.mcpCommand({ cmd: "debug" }), projectDir),
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
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
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
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };

        // the CLI uses the active env unless one is given
        const cmd = this.mcpCommand({ cmd: "run-request", nameOrId, env });

        const result = await this.execCommand(cmd, projectDir, RUN_MAX_BUFFER);
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

    async runCurl({
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
        preReq?: Record<string, any>;
        postReq?: Record<string, any>;
        docs?: string[];
    }): Promise<{ success: boolean; error?: string; requestName?: string; savedTo?: string; requestId?: string; limitReached?: boolean; limit?: any; message?: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const authError = checkAuthType(auth);
        if (authError) return { success: false, error: authError };

        const trimmedInput = curlInput.trim();
        if (!trimmedInput.toLowerCase().startsWith("curl ")) {
            return { success: false, error: "Input must start with 'curl '" };
        }

        const curlArgs = trimmedInput.slice(5).trim();

        const reqData: Record<string, any> = {};
        if (auth) reqData.auth = auth;
        if (tests) reqData.tests = tests;
        if (preReq) reqData.preReq = { inlineScripts: preReq.inlineScripts?.length ? [{ script: preReq.inlineScripts }] : [] };
        if (postReq) reqData.postReq = { inlineScripts: postReq.inlineScripts?.length ? [{ script: postReq.inlineScripts }] : [] };
        if (docs) reqData.docs = docs;

        // extract query params from the curl URL so the params table is populated in the UI
        const urlMatch = curlArgs.match(/^'?([^'\s]+)'?/);
        if (urlMatch) {
            const qIndex = urlMatch[1].indexOf("?");
            if (qIndex !== -1) {
                const qs = urlMatch[1].slice(qIndex + 1);
                const tryDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
                const params = qs.split("&").filter(p => p).map(p => {
                    const eq = p.indexOf("=");
                    return eq === -1
                        ? { name: tryDecode(p), value: "" }
                        : { name: tryDecode(p.slice(0, eq)), value: tryDecode(p.slice(eq + 1)) };
                });
                if (params.length > 0) reqData.params = params;
            }
        }
        // the curl text goes to the CLI as data, not through the shell; the CLI replies with JSON
        return this.mcpCmd({
            cmd: "create-request",
            curl: trimmedInput,
            name,
            collectionName: collection,
            folderName: folder,
            ...reqData,
        }, projectDir);
    }

}
