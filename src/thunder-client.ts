import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

export class ThunderClient {
  /**
   * Show Thunder Client CLI help with debug output.
   * Requires a valid project directory to run in.
   */
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
  
  /**
   * Run a curl-style Thunder Client request with required projectDir.
   */
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

    const curlArgs = trimmed.slice(5).trim();

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