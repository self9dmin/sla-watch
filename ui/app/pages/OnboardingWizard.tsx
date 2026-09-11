import React, { useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { CONNECTED_PROVIDER_OPTIONS } from "../data/providerConnections";
import { providerDisplayName } from "../data/providers";

const AppMark = () => (
  <svg className="sla-brand-logo" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#11323a" />
    <path
      d="M16 20h32M16 32h20M16 44h32"
      stroke="#70e1d2"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <circle cx="45" cy="32" r="7" fill="#f8c761" />
  </svg>
);

const PROVIDER_PRESETS = [
  {
    slug: "aws",
    name: "Amazon Web Services",
    note: "Cloud infrastructure and managed services",
  },
  {
    slug: "azure",
    name: "Microsoft Azure",
    note: "Cloud infrastructure and managed services",
  },
  {
    slug: "gcp",
    name: "Google Cloud",
    note: "Cloud infrastructure and managed services",
  },
  {
    slug: "oci",
    name: "Oracle Cloud Infrastructure",
    note: "Cloud infrastructure and managed services",
  },
];

type OnboardingDestination = "/" | "/settings/provider-connections";

type OnboardingWizardProps = {
  initialProvider: string;
  initialProviders: string[];
  onComplete: (
    providerSlugs: string[],
    providerSlug: string,
    destination: OnboardingDestination,
  ) => Promise<void>;
  onSkip: () => Promise<void>;
};

const StepIndicator = ({ step }: { step: number }) => (
  <div className="onboarding-steps" aria-label={`Onboarding step ${step + 1} of 5`}>
    {["Start", "Providers", "Connections", "Evidence", "Next"].map(
      (label, index) => (
        <div
          className={`onboarding-step ${index <= step ? "complete" : ""} ${index === step ? "active" : ""}`}
          key={label}
        >
          <span>{index < step ? "✓" : index + 1}</span>
          <small>{label}</small>
        </div>
      ),
    )}
  </div>
);

export const OnboardingWizard = ({
  initialProvider,
  initialProviders,
  onComplete,
  onSkip,
}: OnboardingWizardProps) => {
  const [step, setStep] = useState(0);
  const [providerSlug, setProviderSlug] = useState(initialProvider || "aws");
  const [providerSlugs, setProviderSlugs] = useState(
    initialProviders.length > 0 ? initialProviders : [initialProvider || "aws"],
  );
  const [saving, setSaving] = useState(false);
  const connectionOptions = CONNECTED_PROVIDER_OPTIONS.filter((provider) =>
    providerSlugs.includes(provider.slug),
  );

  const complete = async (destination: OnboardingDestination) => {
    setSaving(true);
    await onComplete(
      providerSlugs,
      providerSlug.trim().toLowerCase(),
      destination,
    );
  };

  const toggleProvider = (slug: string) => {
    setProviderSlugs((current) => {
      if (current.includes(slug)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== slug);
        if (providerSlug === slug) setProviderSlug(next[0]);
        return next;
      }
      setProviderSlug(slug);
      return [...current, slug];
    });
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
          <AppMark />
          <span>SLA Review</span>
        </div>
        <StepIndicator step={step} />

        {step === 0 ? (
          <div className="onboarding-hero">
            <div>
              <Heading level={1} id="onboarding-title">
                Set up provider review.
              </Heading>
              <Paragraph>
                Select providers, confirm their service scope, and compare
                incidents with published or custom terms.
              </Paragraph>
            </div>
            <div
              className="onboarding-proof-grid"
              aria-label="Onboarding summary"
            >
              <div>
                <strong>Published terms</strong>
                <small>No sla.directory credential is required.</small>
              </div>
              <div>
                <strong>Dynatrace evidence</strong>
                <small>
                  Telemetry and Smartscape remain the tenant evidence source.
                </small>
              </div>
              <div>
                <strong>Provider evidence</strong>
                <small>
                  Cloud incident connections are optional and read-only.
                </small>
              </div>
            </div>
            <div className="onboarding-footer-row">
              <span className="muted-copy">
                Onboarding saves provider choices only. It does not change cloud
                resources, telemetry, tags, or SLAs.
              </span>
              <Button variant="emphasized" onClick={() => setStep(1)}>
                Start setup
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onboarding-panel">
            <div className="onboarding-title-block">
              <Heading level={2}>
                Choose the cloud providers to monitor.
              </Heading>
              <Paragraph>
                Select every hyperscaler used by this environment. The most
                recently selected provider opens first. Other sla.directory
                providers can be added later from Provider configuration.
              </Paragraph>
            </div>
            <div className="provider-preset-grid">
              {PROVIDER_PRESETS.map((provider) => (
                <button
                  type="button"
                  key={provider.slug}
                  className={`provider-preset ${providerSlugs.includes(provider.slug) ? "selected" : ""}`}
                  onClick={() => toggleProvider(provider.slug)}
                  aria-pressed={providerSlugs.includes(provider.slug)}
                >
                  <span className="provider-preset-dot">
                    {provider.slug.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{provider.name}</strong>
                    <small>{provider.note}</small>
                  </span>
                  <span className="provider-preset-check" aria-hidden="true">
                    {providerSlugs.includes(provider.slug) ? "Selected" : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="onboarding-selected-providers">
              <span>Opens first</span>
              <strong>{providerDisplayName(providerSlug)}</strong>
              <small>
                {providerSlugs.length} provider
                {providerSlugs.length === 1 ? "" : "s"} monitored
              </small>
            </div>
            <div className="onboarding-actions">
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button
                variant="emphasized"
                disabled={providerSlugs.length === 0}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-panel">
            <div className="onboarding-title-block">
              <Heading level={2}>
                Add provider incident sources now or later.
              </Heading>
              <Paragraph>
                Each connection reads notices for one account, subscription,
                project, or tenancy. Create the provider credential in Dynatrace
                Credential Vault, then enter only its record ID under Provider
                connections.
              </Paragraph>
            </div>
            {connectionOptions.length > 0 ? (
              <div
                className="onboarding-connection-list"
                aria-label="Available provider incident connections"
              >
                {connectionOptions.map((provider) => (
                  <div
                    className="onboarding-connection-row"
                    key={provider.slug}
                  >
                    <span className="provider-preset-dot">
                      {provider.slug.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>{provider.sourceName}</strong>
                      <small>
                        {provider.scopeSummary}. Add more than one{" "}
                        {provider.scopeNoun} when required.
                      </small>
                    </span>
                    <small>{provider.fallbackSummary}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="onboarding-connection-empty">
                <strong>
                  No account-specific adapter applies to the current selection.
                </strong>
                <span>
                  You can continue with published terms and Dynatrace evidence.
                </span>
              </div>
            )}
            <div className="onboarding-connection-boundary">
              <strong>Credential boundary</strong>
              <span>
                The app stores the provider scope and Credential Vault record
                ID. It cannot create, display, rotate, or delete provider
                credentials.
              </span>
            </div>
            <div className="onboarding-actions">
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button variant="emphasized" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onboarding-panel">
            <div className="onboarding-title-block">
              <Heading level={2}>
                Provider attribution requires evidence.
              </Heading>
              <Paragraph>
                The app evaluates provider attribution in stages. Review
                each stage before treating a service symptom as
                provider-related.
              </Paragraph>
            </div>
            <div className="evidence-ladder">
              <div className="evidence-ladder-row">
                <span className="evidence-state state-neutral">1</span>
                <div>
                  <strong>Telemetry exists</strong>
                  <small>
                    Problems, logs, spans, or service request signals are
                    present.
                  </small>
                </div>
              </div>
              <div className="evidence-ladder-row">
                <span className="evidence-state state-neutral">2</span>
                <div>
                  <strong>Service is in scope</strong>
                  <small>
                    The affected entity is visible in the tenant inventory.
                  </small>
                </div>
              </div>
              <div className="evidence-ladder-row">
                <span className="evidence-state state-warning">3</span>
                <div>
                  <strong>Provider scope is confirmed</strong>
                  <small>
                    A confirmed Smartscape mapping or explicit Dynatrace tag
                    identifies which provider the service depends on.
                  </small>
                </div>
              </div>
              <div className="evidence-ladder-row">
                <span className="evidence-state state-positive">4</span>
                <div>
                  <strong>Contract record is available</strong>
                  <small>
                    A matching contract supports review but does not establish
                    provider fault or credit eligibility.
                  </small>
                </div>
              </div>
            </div>
            <div className="onboarding-actions">
              <Button onClick={() => setStep(2)}>Back</Button>
              <Button variant="emphasized" onClick={() => setStep(4)}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="onboarding-panel onboarding-ready">
            <div className="ready-check">✓</div>
            <Heading level={2}>Choose the next setup task.</Heading>
            <Paragraph>
              Start in Coverage to confirm which provider terms apply to each
              Dynatrace service. Provider incident connections are optional and
              can be configured now or later.
            </Paragraph>
            <div className="ready-summary">
              <span>
                Providers monitored
                <strong>
                  {providerSlugs.map(providerDisplayName).join(", ")}
                </strong>
              </span>
              <span>
                Opens with<strong>{providerDisplayName(providerSlug)}</strong>
              </span>
              <span>
                Incident connections
                <strong>
                  {connectionOptions.length} available to configure
                </strong>
              </span>
            </div>
            <div className="onboarding-actions">
              <Button onClick={() => setStep(3)}>Back</Button>
              {connectionOptions.length > 0 ? (
                <Button
                  disabled={saving}
                  onClick={() =>
                    void complete("/settings/provider-connections")
                  }
                >
                  {saving ? "Saving setup" : "Configure provider connections"}
                </Button>
              ) : null}
              <Button
                variant="emphasized"
                disabled={saving}
                onClick={() => void complete("/")}
              >
                {saving ? "Saving setup" : "Open Coverage"}
              </Button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="onboarding-skip"
          disabled={saving}
          onClick={() => void skip()}
        >
          Finish later and open Coverage
        </button>
      </section>
    </main>
  );
};
