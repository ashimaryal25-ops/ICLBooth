import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { LocalCardTrait } from "@/lib/local-card-copy";

const execFileAsync = promisify(execFile);

const classifierTraitSchema = z.object({
  trait: z.string().min(2),
  score: z.number().int().min(60).max(99),
});

const classifierOutputSchema = z.object({
  safe: z.boolean(),
  traits: z.array(classifierTraitSchema).length(3),
});

export async function classifyCardTraits(
  selfDescription: string,
): Promise<LocalCardTrait[] | null> {
  const pythonCommand = process.env.PYTHON_COMMAND ?? "python";
  const classifierScriptPath = path.join(process.cwd(), "ml", "predict_traits.py");

  try {
    const { stdout } = await execFileAsync(
      pythonCommand,
      [classifierScriptPath, "--text", selfDescription, "--json"],
      {
        timeout: 20000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = classifierOutputSchema.safeParse(JSON.parse(stdout.trim()));

    if (!parsed.success || !parsed.data.safe) {
      return null;
    }

    return parsed.data.traits.map((trait) => ({
      name: trait.trait,
      score: trait.score,
    }));
  } catch {
    return null;
  }
}
