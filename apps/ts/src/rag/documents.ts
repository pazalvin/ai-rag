import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const GUIDELINE_EXTENSIONS = ["md", "txt", "pdf"] as const;
type GuidelineExtension = (typeof GUIDELINE_EXTENSIONS)[number];

/**
 * Keep files whose extension is in the given list (case-insensitive).
 */
function hasExtension<E extends string>(
  fileName: string,
  extensions: readonly E[]
): boolean {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  return (extensions as readonly string[]).includes(ext);
}

/**
 * Load plain text from a guideline file (.md, .txt, or .pdf).
 */
export async function loadGuidelineText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".md" || ext === ".txt") {
    return fs.readFileSync(filePath, "utf8");
  }

  if (ext === ".pdf") {
    const bytes = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const normalized = String(text ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!normalized) {
      throw new Error(`No extractable text in PDF: ${path.basename(filePath)}`);
    }

    return normalized;
  }

  throw new Error(`Unsupported guideline format: ${ext}`);
}

export function listGuidelineFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => hasExtension<GuidelineExtension>(f, GUIDELINE_EXTENSIONS))
    .sort();
}
