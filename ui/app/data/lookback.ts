import type { EvidenceLookbackHours } from "../types";

export const EVIDENCE_LOOKBACK_OPTIONS: ReadonlyArray<{ value: EvidenceLookbackHours; label: string }> = [
  { value: 24, label: "24 hours" },
  { value: 72, label: "72 hours" },
  { value: 168, label: "7 days" },
  { value: 360, label: "15 days" },
  { value: 720, label: "30 days" },
  { value: 1440, label: "60 days" },
  { value: 2160, label: "90 days" },
];

const EVIDENCE_LOOKBACK_VALUES = new Set<number>(EVIDENCE_LOOKBACK_OPTIONS.map(({ value }) => value));

export const isEvidenceLookbackHours = (value: unknown): value is EvidenceLookbackHours =>
  typeof value === "number" && EVIDENCE_LOOKBACK_VALUES.has(value);

export const formatEvidenceLookback = (hours: EvidenceLookbackHours): string =>
  EVIDENCE_LOOKBACK_OPTIONS.find(({ value }) => value === hours)?.label ?? `${hours} hours`;
