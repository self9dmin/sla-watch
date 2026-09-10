import React, { useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";

const PROVIDER_PRESETS = [
  { slug: "aws", name: "Amazon Web Services", note: "Cloud infrastructure and managed services" },
  { slug: "azure", name: "Microsoft Azure", note: "Cloud infrastructure and managed services" },
  { slug: "gcp", name: "Google Cloud", note: "Cloud infrastructure and managed services" },
  { slug: "stripe", name: "Stripe", note: "Payments and financial infrastructure" },
];

type OnboardingWizardProps = {
  initialProvider: string;
  onComplete: (providerSlug: string) => Promise<void>;
  onSkip: () => Promise<void>;
};

const StepIndicator = ({ step }: { step: number }) => (
  <div className="onboarding-steps" aria-label={`Setup step ${step + 1} of 4`}>
    {["Welcome", "Provider", "Evidence", "Ready"].map((label, index) => (
      <div className={`onboarding-step ${index <= step ? "complete" : ""} ${index === step ? "active" : ""}`} key={label}>
        <span>{index < step ? "✓" : index + 1}</span>
        <small>{label}</small>
      </div>
    ))}
  </div>
);

export const OnboardingWizard = ({ initialProvider, onComplete, onSkip }: OnboardingWizardProps) => {
  const [step, setStep] = useState(0);
  const [providerSlug, setProviderSlug] = useState(initialProvider || "aws");
  const [saving, setSaving] = useState(false);

  const complete = async () => {
    setSaving(true);
    await onComplete(providerSlug.trim().toLowerCase());
  };

  const skip = async () => {
    setSaving(true);
    await onSkip();
  };

  return (
    <main className="onboarding-screen">
      <div className="onboarding-glow onboarding-glow-one" />
      <div className="onboarding-glow onboarding-glow-two" />
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-brand">
          <span className="sla-mark">SL</span>
          <span>SLA Watch</span>
        </div>
        <StepIndicator step={step} />

        {step === 0 ? (
          <div className="onboarding-hero">
            <div>
              <Text className="eyebrow">Initial setup</Text>
              <Heading level={1} id="onboarding-title">Review provider evidence for this environment.</Heading>
              <Paragraph>Select a provider contract and define the evidence boundary used by the watch. The watch separates service symptoms, provider identity, and contract eligibility.</Paragraph>
            </div>
            <div className="onboarding-proof-grid" aria-label="Checks performed by SLA Watch">
              <div><span className="proof-index">01</span><strong>Telemetry</strong><small>Is there enough live signal to investigate?</small></div>
              <div><span className="proof-index">02</span><strong>Identity</strong><small>Can we identify the provider boundary?</small></div>
              <div><span className="proof-index">03</span><strong>Contract</strong><small>Does the selected contract include the service?</small></div>
            </div>
            <div className="onboarding-footer-row">
              <span className="muted-copy">No changes are made to your tenant.</span>
              <Button variant="emphasized" onClick={() => setStep(1)}>Configure watch</Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onboarding-panel">
            <div className="onboarding-title-block">
              <Text className="eyebrow">Step 2 · Contract source</Text>
              <Heading level={2}>Select the provider contract.</Heading>
              <Paragraph>Select one provider contract. You can change it in Settings and review service targets in Provider directory.</Paragraph>
            </div>
            <div className="provider-preset-grid">
              {PROVIDER_PRESETS.map((provider) => (
                <button type="button" key={provider.slug} className={`provider-preset ${providerSlug === provider.slug ? "selected" : ""}`} onClick={() => setProviderSlug(provider.slug)}>
                  <span className="provider-preset-dot">{provider.slug.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{provider.name}</strong><small>{provider.note}</small></span>
                  <span className="provider-preset-check" aria-hidden="true">{providerSlug === provider.slug ? "Selected" : ""}</span>
                </button>
              ))}
            </div>
            <label className="field-label">Or enter a directory slug
              <input value={providerSlug} onChange={(event) => setProviderSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="for example, aws" autoComplete="off" />
            </label>
            <div className="onboarding-actions"><Button onClick={() => setStep(0)}>Back</Button><Button variant="emphasized" disabled={!providerSlug.trim()} onClick={() => setStep(2)}>Continue</Button></div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-panel">
            <div className="onboarding-title-block">
              <Text className="eyebrow">Step 3 · Evidence model</Text>
              <Heading level={2}>Provider attribution requires evidence.</Heading>
              <Paragraph>The watch evaluates provider attribution in stages. Review each stage before treating a service symptom as provider-related.</Paragraph>
            </div>
            <div className="evidence-ladder">
              <div className="evidence-ladder-row"><span className="evidence-state state-neutral">1</span><div><strong>Telemetry exists</strong><small>Problems, logs, spans, or service request signals are present.</small></div></div>
              <div className="evidence-ladder-row"><span className="evidence-state state-neutral">2</span><div><strong>Service is in scope</strong><small>The affected entity is visible in the tenant inventory.</small></div></div>
              <div className="evidence-ladder-row"><span className="evidence-state state-warning">3</span><div><strong>Provider boundary is known</strong><small>An explicit Dynatrace tag identifies which provider the service depends on.</small></div></div>
              <div className="evidence-ladder-row"><span className="evidence-state state-positive">4</span><div><strong>Contract record is available</strong><small>A matching contract supports review but does not establish provider fault or credit eligibility.</small></div></div>
            </div>
            <div className="onboarding-actions"><Button onClick={() => setStep(1)}>Back</Button><Button variant="emphasized" onClick={() => setStep(3)}>I understand</Button></div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onboarding-panel onboarding-ready">
            <div className="ready-check">✓</div>
            <Text className="eyebrow">Step 4 · Review</Text>
            <Heading level={2}>Watch configuration is complete.</Heading>
            <Paragraph>The watch will load the <strong>{providerSlug}</strong> contract, scan the last 24 hours of Dynatrace evidence, and report whether the next action is telemetry setup, provider identification, or contract review.</Paragraph>
            <div className="ready-summary"><span>Provider contract<strong>{providerSlug}</strong></span><span>Evidence window<strong>Last 24 hours</strong></span><span>First view<strong>SLA Watch</strong></span></div>
            <div className="onboarding-actions"><Button onClick={() => setStep(2)}>Back</Button><Button variant="emphasized" disabled={saving} onClick={() => void complete()}>{saving ? "Opening watch" : "Open SLA Watch"}</Button></div>
          </div>
        ) : null}

        <button type="button" className="onboarding-skip" disabled={saving} onClick={() => void skip()}>Skip setup</button>
      </section>
    </main>
  );
};
