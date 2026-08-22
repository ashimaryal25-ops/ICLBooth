import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  getDescriptionSafetyError,
  unsafeDescriptionMessage,
} from "@/lib/description-safety";

const execFileAsync = promisify(execFile);

type SafetyCheckOutput = {
  safe: boolean;
  message: string | null;
  source: "detoxify" | "regex" | "regex-fallback";
  warning?: string;
};

export type DescriptionSafetyResult = {
  safe: boolean;
  message: string | null;
  source: SafetyCheckOutput["source"] | "typescript-regex";
  warning?: string;
};

function parseSafetyOutput(stdout: string): SafetyCheckOutput | null {
  const trimmed = stdout.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as SafetyCheckOutput;
  } catch {
    return null;
  }
}

function runTypescriptFallback(description: string): DescriptionSafetyResult {
  const error = getDescriptionSafetyError(description);

  return {
    safe: !error,
    message: error,
    source: "typescript-regex",
  };
}

export async function checkDescriptionSafety(
  description: string,
): Promise<DescriptionSafetyResult> {
  if (process.env.ENABLE_PYTHON_SAFETY !== "1") {
    return runTypescriptFallback(description);
  }

  const pythonCommand = process.env.PYTHON_COMMAND ?? "python";
  const safetyScriptPath = path.join(process.cwd(), "ml", "safety_check.py");

  try {
    const { stdout } = await execFileAsync(
      pythonCommand,
      [safetyScriptPath, "--text", description],
      {
        timeout: 20000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = parseSafetyOutput(stdout);

    if (!parsed) {
      return runTypescriptFallback(description);
    }

    return {
      safe: parsed.safe,
      message: parsed.message,
      source: parsed.source,
      warning: parsed.warning,
    };
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error
      ? String(error.stdout)
      : "";
    const parsed = parseSafetyOutput(stdout);

    if (parsed) {
      return {
        safe: parsed.safe,
        message: parsed.message ?? unsafeDescriptionMessage,
        source: parsed.source,
        warning: parsed.warning,
      };
    }

    return runTypescriptFallback(description);
  }
}
