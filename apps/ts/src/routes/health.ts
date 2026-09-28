import { Hono } from "hono";
import { config } from "../config.js";
import { countChunks } from "../rag/retriever.js";

export const healthRoutes = new Hono();

healthRoutes.get("/health", async (c) => {
  const indexedChunks = await countChunks();
  return c.json({
    status: "ok",
    llmModel: config.llmModel,
    embedModel: config.embedModel,
    indexedChunks,
  });
});
