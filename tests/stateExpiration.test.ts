import { createStateExpiration } from "../ui/app/data/stateExpiration";

describe("createStateExpiration", () => {
  it("stays inside the 90-day app-state limit", () => {
    const now = Date.parse("2026-09-10T12:00:00.000Z");
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const expiration = Date.parse(createStateExpiration(now));

    expect(expiration - now).toBe(ninetyDays - 5 * 60 * 1000);
    expect(expiration - now).toBeLessThan(ninetyDays);
  });
});
