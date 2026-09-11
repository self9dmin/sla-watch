import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";

type TourStep = { target: string; title: string; body: string };

const STEPS: TourStep[] = [
  {
    target: '[data-tour="watch"]',
    title: "Review the monitor",
    body: "Overview shows the current provider-attribution state and the next defensible action for this environment.",
  },
  {
    target: '[data-tour="setup"]',
    title: "Complete provider setup",
    body: "Setup opens on the Smartscape scope map. Confirm the provider service for each exact runtime relationship, then use Service tags only when other Dynatrace workflows should reuse the boundary.",
  },
  {
    target: '[data-tour="provider-notices"]',
    title: "Keep provider notices separate",
    body: "Provider notices shows optional AWS account, Azure subscription, Google Cloud project, or OCI tenancy events. Configure these sources under Settings. Public feeds are labeled separately.",
  },
  {
    target: '[data-tour="provider"]',
    title: "Review provider records",
    body: "Directory contains contract records and targets. Switch between monitored providers, then compare the active record with tenant evidence.",
  },
  {
    target: '[data-tour="incidents"]',
    title: "Review observed incidents",
    body: "Incidents presents a Problem queue and one focused review. It compares observed dates with provider terms without making an eligibility or credit decision.",
  },
  {
    target: '[data-tour="settings"]',
    title: "Configure the workspace",
    body: "Settings controls monitored providers, optional provider incident connections, SLA overrides, the tag key, and the lookback window. Provider connections can be added for more than one account scope.",
  },
];

export const ProductTour = ({ onComplete }: { onComplete: () => void }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];

  const measure = useCallback(() => {
    setRect(document.querySelector(step.target)?.getBoundingClientRect() ?? null);
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
  const top = rect ? Math.min(window.innerHeight - 220, Math.max(16, rect.bottom + 14)) : window.innerHeight / 2 - 100;
  const left = rect
    ? Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rect.right > window.innerWidth - panelWidth - 24 ? rect.right - panelWidth : rect.left))
    : Math.max(16, (window.innerWidth - panelWidth) / 2);

  return (
    <div className="product-tour" role="dialog" aria-label="SLA Watch walkthrough">
      {rect ? (
        <>
          <div className="tour-mask tour-mask-top" style={{ height: Math.max(0, rect.top - 8) }} />
          <div className="tour-mask tour-mask-bottom" style={{ top: rect.bottom + 8 }} />
          <div className="tour-mask" style={{ top: rect.top - 8, left: 0, width: Math.max(0, rect.left - 8), height: rect.height + 16 }} />
          <div className="tour-mask" style={{ top: rect.top - 8, left: rect.right + 8, right: 0, height: rect.height + 16 }} />
          <div className="tour-focus" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
        </>
      ) : <div className="tour-mask tour-mask-full" />}
      <div className="tour-panel" style={{ top, left, width: panelWidth }}>
        <div className="eyebrow">SLA Watch walkthrough · {index + 1}/{STEPS.length}</div>
        <button type="button" className="tour-close" onClick={onComplete} aria-label="Close walkthrough">Close</button>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <Button onClick={onComplete}>Skip</Button>
          <Button variant="emphasized" onClick={next}>{index === STEPS.length - 1 ? "Finish" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
};
