import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

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
      const { stdout } = await execAsync(command, { cwd });
      return { success: true, result: stdout };
    } catch (error: any) {
      return {
        success: false,
        error: error?.stderr || error?.message || "Unknown error",
      };
    }
  }

  async thunder_help(projectDir: string) {
    const check = this.validateProjectDir(projectDir);
    if (!check.valid) return { success: false, error: check.error, projectDir };

    const result = await this.execCommand("tc --help", projectDir);
    return { ...result, projectDir };
  }

  async thunder_debug(projectDir: string) {
    const check = this.validateProjectDir(projectDir);
    if (!check.valid) return { success: false, error: check.error, projectDir };

    const result = await this.execCommand("tc --debug", projectDir);
    return { ...result, projectDir };
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
  }): Promise<{ success: boolean; error?: string }> {
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

    let cmd = `tc curl ${curlArgs} --ws .`;
    if (name) cmd += ` --name "${name}"`;
    if (collection) cmd += ` --col "${collection}"`;
    if (folder) cmd += ` --fol "${folder}"`;

    const result = await this.execCommand(cmd, projectDir);
    if (result.success) {
      return { success: true }; // ✅ Return only success: true
    } else {
      return { success: false, error: result.error };
    }
  }

}
