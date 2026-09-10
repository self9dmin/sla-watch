import { EVIDENCE_LOOKBACK_OPTIONS, formatEvidenceLookback, isEvidenceLookbackHours } from "../ui/app/data/lookback";

describe("evidence lookback", () => {
  it("offers short incident windows and longer historical review windows", () => {
    expect(EVIDENCE_LOOKBACK_OPTIONS).toEqual([
      { value: 24, label: "24 hours" },
      { value: 72, label: "72 hours" },
      { value: 168, label: "7 days" },
      { value: 360, label: "15 days" },
      { value: 720, label: "30 days" },
      { value: 1440, label: "60 days" },
      { value: 2160, label: "90 days" },
    ]);
  });

  it("formats longer windows in days", () => {
    expect(formatEvidenceLookback(72)).toBe("72 hours");
    expect(formatEvidenceLookback(720)).toBe("30 days");
  });

  it("rejects arbitrary persisted values", () => {
    expect(isEvidenceLookbackHours(2160)).toBe(true);
    expect(isEvidenceLookbackHours(48)).toBe(false);
    expect(isEvidenceLookbackHours("720")).toBe(false);
  });
});
