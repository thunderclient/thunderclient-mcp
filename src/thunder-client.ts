import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

const execAsync = promisify(exec);

// Support multiple data flags in curl
function normalizeCurlInputForWindows(curlInput: string): string {
    return curlInput.replace(
        /(-d|--data(?:-raw)?)\s+(['"])([\s\S]*?)\2/g,
        (_, flag: string, _quote: string, rawBody: string) => {
            const escapedBody = rawBody
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"');
            return `${flag} "${escapedBody}"`;
        }
    );
}

export class ThunderClient {
    private validateProjectDir(projectDir: string): { valid: boolean; error?: string } {
        if (!fs.existsSync(projectDir)) {
            return { valid: false, error: `Invalid project directory: ${projectDir}` };
        }
        return { valid: true };
    }

    private async execCommand(command: string, cwd: string): Promise<{ success: boolean; result?: string; error?: string }> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd });
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
            return { success: false, error: error?.message || "Unknown error" };
        }
    }

    private async mcpCmd(input: Record<string, any>, projectDir: string): Promise<any> {
        const json = JSON.stringify(input).replace(/'/g, "'\\''");
        const { stdout, stderr } = await execAsync(`tc --mcp-cmd '${json}'`, { cwd: projectDir }).catch(e => ({ stdout: "", stderr: e.message }));
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
        const result = await this.mcpCmd({ cmd: "edit-request", requestId, name, url, method, headers, params, body, auth, tests, preReq, postReq, docs }, projectDir);
        if (result?.success) {
            // Report which fields were actually updated
            const updated = [name && "name", url && "url", method && "method", headers && "headers", params && "params", body && "body", auth && "auth", tests && "tests", preReq && "preReq", postReq && "postReq", docs && "docs"].filter(Boolean) as string[];
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
        const result = await this.mcpCmd({ cmd: "set-settings", collectionName, folderName, newName, createIfNotExists, settings }, projectDir);
        if (result?.success) {
            const target = folderName ? `${collectionName} > ${folderName}` : collectionName;
            const settingsApplied = settings ? Object.keys(settings).filter(k => (settings as any)[k] !== undefined) : [];
            return { ...result, target, ...(newName && { renamed: true, newName }), ...(settingsApplied.length && { settingsApplied }) };
        }
        return result;
    }

    private async getActiveEnvName(projectDir: string): Promise<string | undefined> {
        const result = await this.mcpCmd({ cmd: "list-env" }, projectDir);
        if (!result?.environments) return undefined;
        return result.environments.find((e: any) => e.active)?.name;
    }

    async runCollection({
        projectDir,
        collectionName,
        folderName,
        env,
        stopOnFail,
        skip,
        iterations,
        delay,
        concurrent,
    }: {
        projectDir: string;
        collectionName: string;
        folderName?: string;
        env?: string;
        stopOnFail?: boolean;
        skip?: string[];
        iterations?: number;
        delay?: number;
        concurrent?: number;
    }): Promise<{ success: boolean; error?: string; report?: any; envUsed?: string; summary?: { total: number; passed: number; failed: number } }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };

        const resolvedEnv = env || await this.getActiveEnvName(projectDir);

        let cmd = `tc --col "${collectionName}" --report "json"`;
        if (folderName) cmd += ` --fol "${folderName}"`;
        if (resolvedEnv) cmd += ` --env "${resolvedEnv}"`;
        if (stopOnFail) cmd += ` --stop-on-fail`;
        if (skip && skip.length > 0) cmd += ` --skip "${skip.join(",")}"`;
        if (iterations && iterations > 1) cmd += ` --iterations ${iterations}`;
        if (delay && delay > 0) cmd += ` --delay ${delay}`;
        if (concurrent && concurrent > 1) cmd += ` --concurrent ${concurrent}`;
        cmd += ` --mcp`;

        const reportsDir = path.join(projectDir, "thunder-reports");
        const beforeFiles = fs.existsSync(reportsDir)
            ? new Set(fs.readdirSync(reportsDir))
            : new Set<string>();

        const cmdResult = await this.execCommand(cmd, projectDir);

        if (!fs.existsSync(reportsDir)) {
            return {
                success: false,
                error: `Run failed — no report generated. CLI output: ${cmdResult.result || cmdResult.error || "no output"}. Check: (1) collection name is correct, (2) active environment exists in TC UI if requests use {{varName}}.`,
            };
        }

        const newFiles = fs.readdirSync(reportsDir)
            .filter(f => f.endsWith(".json") && !beforeFiles.has(f))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(reportsDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);

        const allFiles = fs.readdirSync(reportsDir)
            .filter(f => f.endsWith(".json"))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(reportsDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);

        const reportFile = newFiles[0] || allFiles[0];
        if (!reportFile) {
            return { success: false, error: `Run completed but no report file found. CLI output: ${cmdResult.result || cmdResult.error || "no output"}` };
        }

        try {
            const report = JSON.parse(fs.readFileSync(path.join(reportsDir, reportFile.name), "utf-8"));
            const failed = report.totalFailed ?? 0;
            const passed = report.totalPassed ?? 0;
            const total = report.totalRequests ?? (passed + failed);
            return {
                success: failed === 0,
                report,
                envUsed: resolvedEnv,
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
            this.execCommand("tc --debug", projectDir),
            this.mcpCmd({ cmd: "list" }, projectDir),
            this.mcpCmd({ cmd: "list-env" }, projectDir),
        ]);

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
            note: "Environment variable values are never shown. Add variables in Thunder Client → Environments.",
        };
    }

    async listEnvironments(projectDir: string): Promise<{ success: boolean; error?: string; environments?: { name: string; active: boolean }[]; total?: number; activeEnv?: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };
        const result = await this.mcpCmd({ cmd: "list-env" }, projectDir);
        if (result?.success && Array.isArray(result.environments)) {
            const activeEnv = result.environments.find((e: any) => e.active)?.name;
            return { ...result, total: result.environments.length, activeEnv };
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

        const resolvedEnv = env || await this.getActiveEnvName(projectDir);
        let cmd = `tc "${nameOrId}"`;
        if (resolvedEnv) cmd += ` --env "${resolvedEnv}"`;

        const result = await this.execCommand(cmd, projectDir);
        return { ...result, envUsed: resolvedEnv };
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
    }): Promise<{ success: boolean; error?: string; requestName?: string; savedTo?: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error };

        const trimmedInput = curlInput.trim();
        if (!trimmedInput.toLowerCase().startsWith("curl ")) {
            return { success: false, error: "Input must start with 'curl '" };
        }

        let curlArgs = trimmedInput.slice(5).trim();
        if (process.platform === "win32") {
            curlArgs = normalizeCurlInputForWindows(curlArgs);
        }

        let cmd = `tc curl ${curlArgs}`;
        if (name) cmd += ` --name "${name}"`;
        if (collection) cmd += ` --col "${collection}"`;
        if (folder) cmd += ` --fol "${folder}"`;

        const reqData: Record<string, any> = {};
        if (auth) reqData.auth = auth;
        if (tests) reqData.tests = tests;
        if (preReq) reqData.preReq = { inlineScripts: preReq.inlineScripts?.length ? [{ script: preReq.inlineScripts }] : [] };
        if (postReq) reqData.postReq = { inlineScripts: postReq.inlineScripts?.length ? [{ script: postReq.inlineScripts }] : [] };
        if (docs) reqData.docs = docs;
        if (Object.keys(reqData).length > 0) {
            cmd += ` --req-data '${JSON.stringify(reqData).replace(/'/g, "'\\''")}'`;
        }

        cmd += ` --mcp`;

        const result = await this.execCommand(cmd, projectDir);
        if (result.success) {
            const savedTo = folder ? `${collection} > ${folder}` : collection || "Activity";
            return { success: true, requestName: name, savedTo };
        }
        return result;
    }

}
