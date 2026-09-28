import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const rawText = String(text ?? "").trim();
  if (!rawText) {
    throw new Error("No extractable text in PDF");
  }
  return rawText;
}
