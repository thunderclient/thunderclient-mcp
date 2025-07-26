import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

const execAsync = promisify(exec);

// Support multiple data flags in curl
function normalizeCurlInputForWindows(curlInput: string): string {
    return curlInput.replace(
        /(-d|--data(?:-raw)?)\s+(['"])([\s\S]*?)\2/g,
        (_, flag: string, _quote: string, rawBody: string) => {
            const escapedBody = rawBody.replace(/"/g, '\\"');
            return `${flag} "${escapedBody}"`;
        }
    );
}

export class ThunderClient {
    private validateProjectDir(projectDir: string): { valid: boolean; error?: string } {
        if (!fs.existsSync(projectDir)) {
            return {
                valid: false,
                error: `Invalid project directory: ${projectDir}`,
            };
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
            return {
                success: false,
                error: error?.message || "Unknown error",
            };
        }
    }

    async runHelp(projectDir: string): Promise<{ success: boolean; error?: string, projectDir?: string, version: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error, projectDir, version };

        const result = await this.execCommand("tc --help", projectDir);
        return { ...result, projectDir, version };
    }

    async runDebug(projectDir: string): Promise<{ success: boolean; error?: string, projectDir?: string, version: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error, projectDir, version };

        const result = await this.execCommand("tc --debug", projectDir);
        return { ...result, projectDir, version, };
    }

    async runCurl({
        curlInput,
        name,
        collection,
        folder,
        projectDir,
    }: {
        curlInput: string;
        name?: string;
        collection?: string;
        folder?: string;
        projectDir: string;
    }): Promise<{ success: boolean; error?: string, projectDir?: string, version: string }> {
        const check = this.validateProjectDir(projectDir);
        if (!check.valid) return { success: false, error: check.error, version };

        const trimmedInput = curlInput.trim();
        if (!trimmedInput.toLowerCase().startsWith("curl ")) {
            return { success: false, error: "Input must start with 'curl '", version };
        }

        let curlArgs = trimmedInput.slice(5).trim();
        if (process.platform === "win32") {
            curlArgs = normalizeCurlInputForWindows(curlArgs);
        }

        let cmd = `tc curl ${curlArgs}`;
        if (name) cmd += ` --name "${name}"`;
        if (collection) cmd += ` --col "${collection}"`;
        if (folder) cmd += ` --fol "${folder}"`;
        cmd += ` --mcp`;

        const result = await this.execCommand(cmd, projectDir);
        if (result.success) {
            return { ...result, projectDir, version }; // ✅ Return only success: true
        } else {
            return { ...result, projectDir, version };
        }
    }

}
