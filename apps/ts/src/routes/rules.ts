import fs from "node:fs";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { config } from "../config.js";
import { loadLoanRules, reloadLoanRules } from "../loan/loadRules.js";
import { loanRulesSchema } from "../loan/rulesSchema.js";

export const rulesRoutes = new Hono();

rulesRoutes.get("/rules", (c) => {
  try {
    const rules = loadLoanRules();
    return c.json({
      path: config.loanRulesPath,
      rules,
    });
  } catch (err) {
    return c.json(
      {
        error: "Failed to load rules",
        detail: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

rulesRoutes.post("/rules/reload", (c) => {
  try {
    const rules = reloadLoanRules();
    return c.json({
      reloaded: true,
      version: rules.version,
      path: config.loanRulesPath,
    });
  } catch (err) {
    return c.json(
      {
        error: "Failed to reload rules",
        detail: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

rulesRoutes.put(
  "/rules",
  zValidator("json", loanRulesSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Invalid rules payload",
          detail: result.error.flatten(),
        },
        400
      );
    }
  }),
  (c) => {
    try {
      const rules = c.req.valid("json");
      fs.writeFileSync(
        config.loanRulesPath,
        `${JSON.stringify(rules, null, 2)}\n`,
        "utf8"
      );
      const loaded = reloadLoanRules();
      return c.json({
        saved: true,
        version: loaded.version,
        path: config.loanRulesPath,
        rules: loaded,
      });
    } catch (err) {
      return c.json(
        {
          error: "Failed to save rules",
          detail: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  }
);
