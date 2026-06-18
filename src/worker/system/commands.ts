import { execFile } from "node:child_process";
import type { CommandResult, CommandRunOptions, CommandRunner } from "../types.js";

export class ProcessCommandRunner implements CommandRunner {
  run(command: string, args: string[], options: CommandRunOptions = {}): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd: options.cwd,
          timeout: options.timeoutMs,
          maxBuffer: 32 * 1024 * 1024,
          encoding: "utf8"
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new CommandExecutionError(command, args, stdout, stderr, error));
            return;
          }

          resolve({ stdout, stderr });
        }
      );
    });
  }
}

export class CommandExecutionError extends Error {
  constructor(
    readonly command: string,
    readonly args: readonly string[],
    readonly stdout: string,
    readonly stderr: string,
    cause: unknown
  ) {
    super(buildMessage(command, args, stderr, cause), { cause });
    this.name = "CommandExecutionError";
  }
}

function buildMessage(
  command: string,
  args: readonly string[],
  stderr: string,
  cause: unknown
): string {
  const causeMessage = cause instanceof Error ? cause.message : String(cause);
  const stderrMessage = stderr.trim();
  const suffix = stderrMessage ? `: ${stderrMessage}` : `: ${causeMessage}`;
  return `Command failed: ${command} ${args.join(" ")}${suffix}`;
}
