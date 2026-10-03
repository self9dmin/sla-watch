import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";

type TourStep = { target: string; path: string; title: string; body: string };

const STEPS: TourStep[] = [
  {
    target: '[data-tour="identify"]',
    path: "/",
    title: "1. Identify a case",
    body: "Coverage is the landing page. Confirm the SLA match, then open Incident cases to choose a Dynatrace Problem. A detected provider alone does not prove service coverage.",
  },
  {
    target: '[data-tour="evaluate"]',
    path: "/evidence",
    title: "2. Evaluate the evidence",
    body: "Evidence brings together customer impact and applicable provider terms. Performance and Provider terms are references. Save Needs evidence when requirements are missing; Evidence review complete requires a complete human review.",
  },
  {
    target: '[data-tour="finops"]',
    path: "/finops",
    title: "3. Automate the handoff",
    body: "After a complete human review, an operator can manually queue the local FinOps route. Automatic queueing starts off. The model recommends an internal next step; it does not decide credit eligibility or submit a claim.",
  },
];

export const ProductTour = ({ providerSlug, onComplete }: { providerSlug: string; onComplete: () => void }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const step = STEPS[index];

  useEffect(() => {
    void navigate(`${step.path}?provider=${encodeURIComponent(providerSlug)}`);
  }, [navigate, providerSlug, step.path]);

  const measure = useCallback(() => {
    setRect(
      document.querySelector(step.target)?.getBoundingClientRect() ?? null,
    );
  }, [step.target]);

  useLayoutEffect(measure, [location.pathname, measure]);
  useEffect(() => {
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [measure]);
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
