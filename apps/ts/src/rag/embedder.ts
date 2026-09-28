import axios from "axios";
import { config } from "../config.js";

type EmbeddingResponse = {
  embedding?: number[];
};

/**
 * Create an embedding vector via Ollama /api/embeddings.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const { data } = await axios.post<EmbeddingResponse>(
      `${config.ollamaBaseUrl}/api/embeddings`,
      {
        model: config.embedModel,
        prompt: text,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!data.embedding?.length) {
      throw new Error("Embedding response missing embedding array");
    }

    if (data.embedding.length !== config.embeddingDimensions) {
      throw new Error(
        `Expected ${config.embeddingDimensions}-dim embedding, got ${data.embedding.length}`
      );
    }

    return data.embedding;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body =
        typeof err.response?.data === "string"
          ? err.response.data
          : JSON.stringify(err.response?.data ?? err.message);
      throw new Error(
        `Embedding failed (${err.response?.status ?? "network"}): ${body}`
      );
    }
    throw err;
  }
}
