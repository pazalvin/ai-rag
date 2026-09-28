import { Hono } from "hono";
import { healthRoutes } from "./routes/health.js";
import { loanRoutes } from "./routes/loan.js";
import { rulesRoutes } from "./routes/rules.js";

export function createApp() {
  const app = new Hono();

  app.route("/api", healthRoutes);
  app.route("/api", loanRoutes);
  app.route("/api", rulesRoutes);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api")) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ error: "Not found" }, 404);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error", detail: err.message }, 500);
  });

  return app;
}
