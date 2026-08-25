import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export interface CommandResult {
  command: string;
  args: string[];
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

function decode(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return (typeof value === "string" ? value : value.toString("utf8")).trim();
}

export function runCommand(command: string, args: string[], cwd: string): CommandResult {
  let result: SpawnSyncReturns<string | Buffer>;
  try {
    result = spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    });
  } catch (error) {
    return {
      command,
      args,
      status: null,
      stdout: "",
      stderr: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (result.error) {
    return {
      command,
      args,
      status: result.status,
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
      error: result.error.message,
    };
  }

  return {
    command,
    args,
    status: result.status,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

export function commandExists(command: string, cwd = process.cwd()): boolean {
  const probe = process.platform === "win32" ? ["where", [command]] : ["which", [command]];
  const result = runCommand(probe[0] as string, probe[1] as string[], cwd);
  return result.status === 0;
}
