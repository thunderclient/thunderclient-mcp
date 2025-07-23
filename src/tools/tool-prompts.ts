// tool-prompts.ts
export const toolPrompts: Record<string, string> = {
  tc_curl: `
Use this tool to run a full curl command via Thunder Client CLI to create a request or collection or folder in collection in the Thunder Client VS Code extension.
Instructions:
- \`curlInput\` must be a valid curl command string that starts with \`curl \`.
- \`projectDir\` must be the **full absolute path** to the current project directory — do not use \`.\` or \`/\`.
- If \`folder\` is specified, you **must also provide** the \`collection\` field.
- if needed the collection in the thunder client u can read from the folder thunder-tests in the curret project

  `.trim(),

  tc_help: `
Use this tool to show help for the Thunder Client CLI.

- \`projectDir\` must be the **full absolute path** to the current project directory — do not use \`.\` or \`/\`.
- This is useful if the user wants to know available Thunder Client CLI commands.
  `.trim(),

  tc_debug: `
Use this tool to run the Thunder Client CLI in debug mode.

- \`projectDir\` must be the **full absolute path** to the current project directory — do not use \`.\` or \`/\`.
- This is helpful for diagnosing issues with the Thunder Client CLI.
  `.trim(),
};