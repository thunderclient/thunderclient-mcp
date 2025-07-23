import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

export class ThunderClient {
  async thunder_help(projectDir: string): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    projectDir: string;
  }> {
    if (!fs.existsSync(projectDir)) {
      return {
        success: false,
        error: `Invalid project directory: ${projectDir}`,
        projectDir,
      };
    }

    try {
      const { stdout } = await execAsync("tc --help", { cwd: projectDir });
      return { success: true, result: stdout, projectDir };
    } catch (error: any) {
      return {
        success: false,
        error: error.stderr || error.message || "Unknown error",
        projectDir,
      };
    }
  }
  
  async thunder_debug(projectDir: string): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    projectDir: string;
  }> {
    if (!fs.existsSync(projectDir)) {
      return {
        success: false,
        error: `Invalid project directory: ${projectDir}`,
        projectDir,
      };
    }

    try {
      const { stdout } = await execAsync("tc --debug", { cwd: projectDir });
      return { success: true, result: stdout, projectDir };
    } catch (error: any) {
      return {
        success: false,
        error: error.stderr || error.message || "Unknown error",
        projectDir,
      };
    }
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
  }): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    projectDir: string;
  }> {
    if (!fs.existsSync(projectDir)) {
      return {
        success: false,
        error: `Invalid project directory: ${projectDir}`,
        projectDir,
      };
    }

    const trimmed = curlInput.trim();
    if (!trimmed.toLowerCase().startsWith("curl ")) {
      return {
        success: false,
        error: "Input must start with 'curl '",
        projectDir,
      };
    }

    let curlArgs = trimmed.slice(5).trim();

    // ✅ Fix for Windows escaping in -d or --data
    if (process.platform === "win32") {
      curlArgs = curlArgs.replace(
        /(-d|--data)\s+(['"])([\s\S]*?)\2/,
        (_, flag: string, _quote: string, body: string) => {
          try {
            const jsonBody = JSON.stringify(JSON.parse(body)); // Validates & escapes
            return `${flag} "${jsonBody}"`;
          } catch {
            // Fallback: escape double quotes
            const escapedBody = body.replace(/"/g, '\\"');
            return `${flag} "${escapedBody}"`;
          }
        }
      );
    }

    let cmd = `tc curl ${curlArgs} --ws .`;
    if (name) cmd += ` --name "${name}"`;
    if (collection) cmd += ` --col "${collection}"`;
    if (folder) cmd += ` --fol "${folder}"`;

    try {
      const { stdout } = await execAsync(cmd, { cwd: projectDir });
      return { success: true, result: stdout, projectDir };
    } catch (error: any) {
      return {
        success: false,
        error: error.stderr || error.message || "Unknown error",
        projectDir,
      };
    }
  }
}
