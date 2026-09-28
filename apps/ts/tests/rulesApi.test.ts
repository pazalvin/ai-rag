import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import { loadLoanRules } from "../src/loan/loadRules.ts";

describe("GET /api/rules", () => {
  it("returns the current configurable loan rules", async () => {
    const app = createApp();
    const res = await app.request("/api/rules");
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      rules: { version: string; incomeFloorMonthly: number };
    };
    const fileRules = loadLoanRules();
    assert.equal(body.rules.version, fileRules.version);
    assert.equal(body.rules.incomeFloorMonthly, fileRules.incomeFloorMonthly);
  });
});
