import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { Button } from "@dynatrace/strato-components/buttons";

type TourStep = { target: string; title: string; body: string };

const STEPS: TourStep[] = [
  {
    target: '[data-tour="coverage"]',
    title: "Start with what Dynatrace found",
    body: "Coverage opens automatically with detected providers and topology. Review only ambiguous SLA matches. Provider presence alone does not assign every service.",
  },
  {
    target: '[data-tour="performance"]',
    title: "Check customer performance",
    body: "Performance evaluates customer objectives from Dynatrace request telemetry. Provider reports remain separate supporting evidence.",
  },
  {
    target: '[data-tour="incidents"]',
    title: "Triage review cases",
    body: "Incidents narrows Dynatrace Problems into defensible review cases. Open Problems when you need the full investigation.",
  },
  {
    target: '[data-tour="evidence"]',
    title: "Make the review decision",
    body: "Evidence brings together impact, SLA matches, applicable terms, and optional provider reports. Mark the case ready, keep it open for evidence, or exclude it. Nothing is sent. The SRE review stops here.",
  },
  {
    target: '[data-tour="directory"]',
    title: "Check provider terms",
    body: "Directory is the reference for published terms, service coverage, support options, filing instructions, and any environment-owned custom terms.",
  },
];

export const ProductTour = ({ onComplete }: { onComplete: () => void }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];

  const measure = useCallback(() => {
    setRect(
      document.querySelector(step.target)?.getBoundingClientRect() ?? null,
    );
  }, [step.target]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const next = () => {
    if (index === STEPS.length - 1) onComplete();
    else setIndex((current) => current + 1);
  };

  const panelWidth = Math.min(340, window.innerWidth - 32);
  const top = rect
    ? Math.min(window.innerHeight - 220, Math.max(16, rect.bottom + 14))
    : window.innerHeight / 2 - 100;
  const left = rect
    ? Math.max(
        16,
        Math.min(
          window.innerWidth - panelWidth - 16,
          rect.right > window.innerWidth - panelWidth - 24
            ? rect.right - panelWidth
            : rect.left,
        ),
      )
    : Math.max(16, (window.innerWidth - panelWidth) / 2);

  return (
    <div
      className="product-tour"
      role="dialog"
      aria-label="Quick tour"
    >
      {rect ? (
        <>
          <div
            className="tour-mask tour-mask-top"
            style={{ height: Math.max(0, rect.top - 8) }}
          />
          <div
            className="tour-mask tour-mask-bottom"
            style={{ top: rect.bottom + 8 }}
          />
          <div
            className="tour-mask"
            style={{
              top: rect.top - 8,
              left: 0,
              width: Math.max(0, rect.left - 8),
              height: rect.height + 16,
            }}
          />
          <div
            className="tour-mask"
            style={{
              top: rect.top - 8,
              left: rect.right + 8,
              right: 0,
              height: rect.height + 16,
            }}
          />
          <div
            className="tour-focus"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        </>
      ) : (
        <div className="tour-mask tour-mask-full" />
      )}
      <div className="tour-panel" style={{ top, left, width: panelWidth }}>
        <div className="eyebrow">
          Quick tour · {index + 1}/{STEPS.length}
        </div>
        <button
          type="button"
          className="tour-close"
          onClick={onComplete}
          aria-label="Close quick tour"
        >
          Close
        </button>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <Button onClick={onComplete}>Skip</Button>
          <Button variant="emphasized" onClick={next}>
            {index === STEPS.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
};
