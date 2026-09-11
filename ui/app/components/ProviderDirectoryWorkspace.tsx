import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type {
  ContractOverrideRecord,
  ContractOverrideValue,
  ServiceRecord,
  SlaCreditPolicy,
  SlaProviderResponse,
  SmartscapeScopeEdge,
} from "../types";
import { getOverrideScopeNames } from "../data/contractOverrides";
import { useContractOverrides } from "../hooks/useContractOverrides";
import { ContractOverrideEditor } from "./ContractOverrideEditor";

type DirectoryTab = "terms" | "services" | "support" | "overrides";
type ServiceFilter = "all" | "eligible" | "reference";
type Tone = "neutral" | "warning" | "positive";

type ProviderDirectoryWorkspaceProps = {
  directory?: SlaProviderResponse;
  directoryLoading: boolean;
  directoryError?: Error;
  services: ServiceRecord[];
  topology: SmartscapeScopeEdge[];
  servicesLoading: boolean;
  serviceError?: Error;
};

const TABS: ReadonlyArray<{ id: DirectoryTab; label: string }> = [
  { id: "terms", label: "SLA terms" },
  { id: "services", label: "Services" },
  { id: "support", label: "Support" },
  { id: "overrides", label: "SLA overrides" },
];

const StatusPill = ({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) => <span className={`status-pill status-pill-${tone}`}>{children}</span>;
const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? "Not published" : `${value}%`;
const formatToken = (value: string | null | undefined): string =>
  value?.trim()
    ? value
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not published";
const cleanDirectoryNotes = (value?: string | null): string =>
  (value ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
const safeExternalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const ExternalLink = ({
  href,
  children,
}: {
  href?: string | null;
  children: React.ReactNode;
}) => {
  const safeHref = safeExternalUrl(href);
  return safeHref ? (
    <a
      className="directory-source-link"
      href={safeHref}
      target="_blank"
      rel="noreferrer"
    >
      {children} ↗
    </a>
  ) : null;
};

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const CreditPolicyDetails = ({
  policy,
  compact = false,
}: {
  policy?: SlaCreditPolicy | null;
  compact?: boolean;
}) => {
  if (!policy)
    return (
      <p className="directory-empty-copy">
        No separate credit policy is published.
      </p>
    );
  return (
    <div
      className={
        compact ? "credit-policy credit-policy-compact" : "credit-policy"
      }
    >
      <dl className="directory-mini-facts">
        <Fact label="Calculation" value={formatToken(policy.calculation)} />
        <Fact label="Remedy" value={formatToken(policy.remedy)} />
        <Fact
          label="Maximum credit"
          value={formatPercent(policy.maxCreditPercent)}
        />
        <Fact label="Credit unit" value={formatToken(policy.unit)} />
        <Fact
          label="Automatic"
          value={policy.automatic ? "Yes" : "No, claim required"}
        />
      </dl>
      {policy.creditTiers.length > 0 ? (
        <div
          className="directory-tier-list"
          role="table"
          aria-label="Published credit tiers"
        >
          <div className="directory-tier-row directory-tier-header" role="row">
            <span>Monthly uptime below</span>
            <span>Service credit</span>
          </div>
          {policy.creditTiers.map((tier) => (
            <div
              className="directory-tier-row"
              role="row"
              key={`${tier.below}-${tier.credit}`}
            >
              <span>{tier.below}%</span>
              <strong>{tier.credit}%</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="directory-empty-copy">No credit thresholds are listed.</p>
      )}
      {policy.note ? <p className="directory-note">{policy.note}</p> : null}
    </div>
  );
};

const overrideState = (
  override: ContractOverrideRecord,
  now = new Date(),
): { label: string; tone: Tone } => {
  const date = now.toISOString().slice(0, 10);
  if (!override.enabled) return { label: "Disabled", tone: "neutral" };
  if (override.effectiveFrom > date)
    return { label: "Scheduled", tone: "neutral" };
  if (override.effectiveTo && override.effectiveTo < date)
    return { label: "Expired", tone: "neutral" };
  return { label: "Active", tone: "positive" };
};

const overrideTerms = (override: ContractOverrideRecord): string =>
  [
    override.availabilityTarget !== null &&
    override.availabilityTarget !== undefined
      ? `${override.availabilityTarget}% availability`
      : null,
    override.filingDeadlineDays !== null &&
    override.filingDeadlineDays !== undefined
      ? `${override.filingDeadlineDays}d filing`
      : null,
    override.maxCreditPercent !== null &&
    override.maxCreditPercent !== undefined
      ? `${override.maxCreditPercent}% max credit`
      : null,
    override.claimMethod?.trim() ? override.claimMethod : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ") || "No operational value";

const overrideScopeSummary = (override: ContractOverrideRecord): string => {
  if (override.scopeKind === "provider") return "Provider-wide fallback";
  const names = getOverrideScopeNames(override);
  const kind =
    override.scopeKind === "service"
      ? "Services"
      : override.scopeKind === "host"
        ? "Hosts or runtimes"
        : "Locations";
  if (names.length === 0) return `${kind}: no target`;
  return `${kind}: ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}`;
};

export const ProviderDirectoryWorkspace = ({
  directory,
  directoryLoading,
  directoryError,
  services,
  topology,
  servicesLoading,
  serviceError,
}: ProviderDirectoryWorkspaceProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const initialTab: DirectoryTab =
    requestedTab === "published"
      ? "terms"
      : TABS.some((item) => item.id === requestedTab)
        ? (requestedTab as DirectoryTab)
        : "terms";
  const [tab, setTab] = useState<DirectoryTab>(initialTab);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractOverrideRecord | undefined>();
  const contractSettings = useContractOverrides();

  useEffect(() => {
    const nextTab = requestedTab === "published" ? "terms" : requestedTab;
    if (TABS.some((item) => item.id === nextTab))
      setTab(nextTab as DirectoryTab);
  }, [requestedTab]);

  const providerOverrides = useMemo(
    () =>
      directory
        ? contractSettings.overrides.filter(
            (override) => override.providerSlug === directory.provider.slug,
          )
        : [],
    [contractSettings.overrides, directory],
  );
  const visibleServices = useMemo(() => {
    if (!directory) return [];
    const query = serviceSearch.trim().toLowerCase();
    return directory.services.filter((service) => {
      if (serviceFilter === "eligible" && !service.eligible) return false;
      if (serviceFilter === "reference" && service.eligible) return false;
      if (!query) return true;
      return [
        service.name,
        service.id,
        service.category,
        service.description,
        service.uptimeScope,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [directory, serviceFilter, serviceSearch]);

  const openCreateSettings = (seed?: ContractOverrideValue) => {
    const params = new URLSearchParams();
    if (seed?.providerServiceId && seed.providerServiceId !== "*")
      params.set("providerServiceId", seed.providerServiceId);
    if (seed?.scopeKind && seed.scopeKind !== "provider")
      params.set("scopeKind", seed.scopeKind);
    if (seed?.scopeEntityId && seed.scopeEntityId !== "*")
      params.set("scopeEntityId", seed.scopeEntityId);
    void navigate(
      `/settings/sla-overrides${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  };

  const openEdit = (override: ContractOverrideRecord) => {
    setEditing(override);
    setEditorOpen(true);
  };

  const openCreateForProviderService = (
    service: SlaProviderResponse["services"][number],
  ) => {
    if (!directory) return;
    openCreateSettings({
      overrideKey: `${directory.provider.slug}|${service.id}|provider|*`,
      providerSlug: directory.provider.slug,
      providerServiceId: service.id,
      providerServiceName: service.name,
      scopeKind: "provider",
      scopeEntityId: "*",
      scopeEntityName: `${directory.provider.name} default`,
      scopeEntityIds: ["*"],
      scopeEntityNames: [`${directory.provider.name} default`],
      location: null,
      availabilityTarget: null,
      filingDeadlineDays: null,
      deadlineBasis: null,
      businessDays: false,
      maxCreditPercent: null,
      claimMethod: null,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      sourceReference: "",
      sourceUrl: null,
      notes: null,
      enabled: true,
    });
  };

  if (directoryLoading && !directory)
    return (
      <div className="directory-loading" role="status">
        <strong>Loading vendor terms</strong>
        <span>Reading the public record and tenant settings.</span>
      </div>
    );
  if (!directory)
    return (
      <div className="error-box">
        <strong>Directory unavailable.</strong>
        <span>
          {directoryError?.message ??
            "Check the environment External requests allowlist and retry."}
        </span>
      </div>
    );

  const provider = directory.provider;
  const providerPolicy = provider.defaultCreditPolicy;
  const providerMaxCredit =
    provider.maximumCredit?.value ??
    provider.maxCreditPercent ??
    providerPolicy?.maxCreditPercent;
  const claim = provider.claimProcess;
  const support = provider.support;
  const notes = cleanDirectoryNotes(provider.notes);
  const providerStatusTone: Tone =
    provider.needsReview || provider.helpWanted
      ? "warning"
      : provider.statusCode === "credit"
        ? "positive"
        : "neutral";

  return (
    <div className="directory-workspace">
      <div className="directory-heading">
        <div>
          <Heading level={2}>{provider.name} SLA record</Heading>
          <Paragraph>
            Public terms from sla.directory, service-level coverage, support
            options, and tenant-specific overrides.
          </Paragraph>
        </div>
        <div className="directory-heading-status">
          <StatusPill tone={providerStatusTone}>{provider.status}</StatusPill>
          <span>Verified {provider.lastVerified}</span>
        </div>
      </div>

      <div
        className="directory-tabs"
        role="tablist"
        aria-label="Directory views"
      >
        {TABS.map((item) => {
          const count =
            item.id === "services"
              ? directory.services.length
              : item.id === "overrides"
                ? providerOverrides.length
                : undefined;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`directory-panel-${item.id}`}
              className={
                tab === item.id ? "directory-tab active" : "directory-tab"
              }
              key={item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {count !== undefined ? <span>{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div
        className="directory-tab-panel"
        id={`directory-panel-${tab}`}
        role="tabpanel"
      >
        {tab === "terms" ? (
          <div className="directory-detail-view">
            <div className="published-summary">
              <div className="published-summary-copy">
                <div>
                  <strong>Public reference</strong>
                  <StatusPill tone="neutral">Read-only</StatusPill>
                </div>
                <p>
                  Use this as a comparison baseline. A private agreement or
                  service-specific term may take precedence.
                </p>
              </div>
              <div className="directory-toolbar-actions">
                <ExternalLink href={provider.slaUrl}>Official SLA</ExternalLink>
                <Button
                  size="condensed"
                  variant="emphasized"
                  disabled={!contractSettings.canWrite}
                  onClick={() => openCreateSettings()}
                >
                  Add SLA override
                </Button>
              </div>
            </div>
            <div className="directory-detail-scroll">
              <dl className="published-facts directory-primary-facts">
                <Fact
                  label="Availability"
                  value={formatPercent(provider.uptime)}
                />
                <Fact
                  label="Maximum credit"
                  value={
                    provider.maximumCredit?.label ??
                    formatPercent(providerMaxCredit)
                  }
                />
                <Fact
                  label="Filing window"
                  value={
                    claim?.deadlineDays
                      ? `${claim.deadlineDays} ${claim.businessDays ? "business" : "calendar"} days`
                      : "Not published"
                  }
                />
                <Fact
                  label="Minimum plan"
                  value={formatToken(provider.minPlanForSla)}
                />
                <Fact
                  label="Credits"
                  value={
                    provider.hasAutomaticCredits
                      ? "Automatic"
                      : "Claim required"
                  }
                />
                <Fact
                  label="Coverage scope"
                  value={formatToken(provider.scope)}
                />
              </dl>
              <div className="directory-detail-grid">
                <section
                  className="directory-detail-card"
                  aria-labelledby="credit-policy-heading"
                >
                  <span className="eyebrow">Financial remedy</span>
                  <h3 id="credit-policy-heading">Credit policy</h3>
                  <CreditPolicyDetails policy={providerPolicy} />
                </section>
                <section
                  className="directory-detail-card"
                  aria-labelledby="claim-process-heading"
                >
                  <div className="directory-card-heading">
                    <div>
                      <span className="eyebrow">Submission process</span>
                      <h3 id="claim-process-heading">How to file</h3>
                    </div>
                    <ExternalLink href={claim?.url}>
                      Open claim destination
                    </ExternalLink>
                  </div>
                  <dl className="directory-mini-facts">
                    <Fact label="Method" value={formatToken(claim?.method)} />
                    <Fact
                      label="Deadline basis"
                      value={formatToken(claim?.deadlineBasis)}
                    />
                    <Fact
                      label="Review time"
                      value={
                        claim?.reviewDays
                          ? `${claim.reviewDays} business days`
                          : "Not published"
                      }
                    />
                    <Fact
                      label="Credit applied"
                      value={formatToken(claim?.creditApplication)}
                    />
                  </dl>
                  <p className="directory-note">
                    Provider deadlines are references. Confirm the current
                    agreement and the date from which the provider counts the
                    filing window.
                  </p>
                </section>
                <section
                  className="directory-detail-card"
                  aria-labelledby="evidence-heading"
                >
                  <span className="eyebrow">Claim inputs</span>
                  <h3 id="evidence-heading">Required evidence</h3>
                  {claim?.requiredEvidence.length ? (
                    <ul className="directory-plain-list">
                      {claim.requiredEvidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="directory-empty-copy">
                      No evidence list is published.
                    </p>
                  )}
                </section>
                <section
                  className="directory-detail-card"
                  aria-labelledby="exclusions-heading"
                >
                  <span className="eyebrow">Provider terms</span>
                  <h3 id="exclusions-heading">Common exclusions</h3>
                  {provider.exclusions?.length ? (
                    <ul className="directory-plain-list">
                      {provider.exclusions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="directory-empty-copy">
                      No exclusions are listed.
                    </p>
                  )}
                </section>
                {provider.slaTiers?.length ? (
                  <section
                    className="directory-detail-card directory-detail-card-wide"
                    aria-labelledby="higher-tiers-heading"
                  >
                    <span className="eyebrow">Plan-specific commitments</span>
                    <h3 id="higher-tiers-heading">Higher SLA tiers</h3>
                    <div
                      className="directory-record-table"
                      role="table"
                      aria-label="Higher SLA tiers"
                    >
                      <div
                        className="directory-record-row directory-record-header"
                        role="row"
                      >
                        <span>Tier</span>
                        <span>Requirement</span>
                        <span>Availability</span>
                        <span>Max credit</span>
                        <span>Source</span>
                      </div>
                      {provider.slaTiers.map((tier) => (
                        <div
                          className="directory-record-row"
                          role="row"
                          key={`${tier.name}-${tier.uptimeCommitment}`}
                        >
                          <strong>{tier.name}</strong>
                          <span>{tier.requirement ?? "Not published"}</span>
                          <span>{formatPercent(tier.uptimeCommitment)}</span>
                          <span>{formatPercent(tier.maxCreditPercent)}</span>
                          <ExternalLink href={tier.sourceUrl}>
                            Official terms
                          </ExternalLink>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section
                  className="directory-detail-card directory-detail-card-wide"
                  aria-labelledby="record-details-heading"
                >
                  <div className="directory-card-heading">
                    <div>
                      <span className="eyebrow">Record provenance</span>
                      <h3 id="record-details-heading">
                        Vendor and source details
                      </h3>
                    </div>
                    <div className="directory-link-group">
                      <ExternalLink href={provider.website}>
                        Vendor website
                      </ExternalLink>
                      <ExternalLink href={provider.statusPage}>
                        Public status
                      </ExternalLink>
                    </div>
                  </div>
                  <dl className="directory-mini-facts directory-record-facts">
                    <Fact
                      label="Legal provider"
                      value={provider.vendor ?? provider.name}
                    />
                    <Fact
                      label="Category"
                      value={
                        provider.categorySlug
                          ? `${provider.category} · ${provider.categorySlug}`
                          : provider.category
                      }
                    />
                    <Fact label="Directory slug" value={provider.slug} />
                    <Fact
                      label="SLA status"
                      value={
                        provider.statusCode
                          ? `${provider.status} · ${provider.statusCode}`
                          : provider.status
                      }
                    />
                    <Fact
                      label="Credit cap model"
                      value={
                        provider.maximumCredit
                          ? `${formatToken(provider.maximumCredit.kind)} · ${formatToken(provider.maximumCredit.unit)}`
                          : "Not published"
                      }
                    />
                    <Fact
                      label="Record review"
                      value={
                        provider.needsReview
                          ? "Review requested"
                          : "No review flag"
                      }
                    />
                    <Fact
                      label="Contribution"
                      value={
                        provider.helpWanted ? "Help requested" : "No help flag"
                      }
                    />
                    <Fact
                      label="Last modified"
                      value={directory.lastModified ?? "Not published"}
                    />
                    <Fact
                      label="API schema"
                      value={directory.schemaVersion ?? "Not published"}
                    />
                  </dl>
                  {provider.tags?.length ? (
                    <div
                      className="directory-tag-list"
                      aria-label="Provider tags"
                    >
                      {provider.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  {notes ? (
                    <p className="directory-note directory-record-note">
                      {notes}
                    </p>
                  ) : null}
                  <p className="directory-provenance">
                    API generated {directory.generatedAt}. SLA Watch does not
                    alter this public record.
                  </p>
                </section>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "services" ? (
          <div className="directory-services-view">
            <div className="directory-services-toolbar">
              <div>
                <strong>Provider services</strong>
                <span>
                  {visibleServices.length} of {directory.services.length}{" "}
                  records
                </span>
              </div>
              <div className="directory-service-controls">
                <input
                  aria-label="Search provider services"
                  type="search"
                  value={serviceSearch}
                  onChange={(event) =>
                    setServiceSearch(event.currentTarget.value)
                  }
                  placeholder="Search services"
                />
                <select
                  aria-label="Service SLA filter"
                  value={serviceFilter}
                  onChange={(event) =>
                    setServiceFilter(event.currentTarget.value as ServiceFilter)
                  }
                >
                  <option value="all">All records</option>
                  <option value="eligible">SLA eligible</option>
                  <option value="reference">Reference only</option>
                </select>
              </div>
            </div>
            {serviceError ? (
              <div className="error-box compact-error">
                Dynatrace service inventory could not be loaded:{" "}
                {serviceError.message}
              </div>
            ) : null}
            <div
              className="directory-service-records"
              role="list"
              aria-label={`${provider.name} service SLA records`}
            >
              {visibleServices.map((service) => {
                const overrideCount = providerOverrides.filter(
                  (override) =>
                    override.providerServiceId === "*" ||
                    override.providerServiceId === service.id,
                ).length;
                return (
                  <details
                    className="directory-service-record"
                    role="listitem"
                    key={service.id}
                  >
                    <summary>
                      <span>
                        <strong>{service.name}</strong>
                        <small>{service.description ?? service.id}</small>
                      </span>
                      <span>
                        <small>Availability</small>
                        <strong>{formatPercent(service.uptime)}</strong>
                      </span>
                      <span>
                        <small>Scope</small>
                        <strong>{formatToken(service.uptimeScope)}</strong>
                      </span>
                      <StatusPill
                        tone={service.eligible ? "positive" : "neutral"}
                      >
                        {service.eligible ? "SLA eligible" : "Reference"}
                      </StatusPill>
                    </summary>
                    <div className="directory-service-detail">
                      <dl className="directory-mini-facts">
                        <Fact label="Service ID" value={service.id} />
                        <Fact
                          label="Category"
                          value={formatToken(service.category)}
                        />
                        <Fact
                          label="Last verified"
                          value={service.lastVerified ?? provider.lastVerified}
                        />
                        <Fact
                          label="Credit terms"
                          value={
                            service.creditPolicy
                              ? "Service-specific"
                              : "Provider default"
                          }
                        />
                      </dl>
                      <div className="directory-service-detail-grid">
                        <div>
                          <h4>Credit policy</h4>
                          <CreditPolicyDetails
                            policy={service.creditPolicy ?? providerPolicy}
                            compact
                          />
                        </div>
                        <div>
                          <h4>Service exclusions</h4>
                          {service.exclusions?.length ? (
                            <ul className="directory-plain-list">
                              {service.exclusions.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="directory-empty-copy">
                              No additional service exclusions are listed.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="directory-service-actions">
                        <ExternalLink href={service.slaUrl}>
                          Official service SLA
                        </ExternalLink>
                        <button
                          type="button"
                          className="inline-action table-action"
                          onClick={() => {
                            if (overrideCount > 0) setTab("overrides");
                            else openCreateForProviderService(service);
                          }}
                        >
                          {overrideCount > 0
                            ? `Review ${overrideCount} override${overrideCount === 1 ? "" : "s"}`
                            : "Add SLA override"}
                        </button>
                      </div>
                    </div>
                  </details>
                );
              })}
              {visibleServices.length === 0 ? (
                <div className="contract-empty">
                  <strong>No matching services</strong>
                  <span>Clear the search or change the SLA filter.</span>
                </div>
              ) : null}
            </div>
            {servicesLoading ? (
              <div className="directory-inline-status" role="status">
                Loading Dynatrace service inventory...
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "support" ? (
          <div className="directory-support-view">
            <div className="support-boundary">
              <strong>Separate from the availability SLA</strong>
              <span>
                Support response times are service targets or entitlements
                unless the provider explicitly attaches a remedy.
              </span>
              <StatusPill
                tone={support?.responseIsSla ? "positive" : "neutral"}
              >
                {support?.responseIsSla
                  ? "Contractual response SLA"
                  : "Not credit-backed"}
              </StatusPill>
            </div>
            {!support && !provider.supportTiers?.length ? (
              <div className="contract-empty">
                <strong>No support program data</strong>
                <span>
                  sla.directory does not currently publish support details for
                  this provider.
                </span>
              </div>
            ) : (
              <div className="directory-support-scroll">
                {support ? (
                  <>
                    <dl className="published-facts directory-support-facts">
                      <Fact
                        label="24×7 coverage"
                        value={support.has24x7 ? "Available" : "Not listed"}
                      />
                      <Fact
                        label="Fastest response"
                        value={support.fastestResponse ?? "Not published"}
                      />
                      <Fact
                        label="Designated contact"
                        value={formatToken(support.designatedContact)}
                      />
                      <Fact
                        label="Pricing model"
                        value={formatToken(support.pricing)}
                      />
                    </dl>
                    <section
                      className="directory-detail-card directory-support-summary"
                      aria-labelledby="support-capabilities-heading"
                    >
                      <div className="directory-card-heading">
                        <div>
                          <span className="eyebrow">Top-tier options</span>
                          <h3 id="support-capabilities-heading">
                            Published support capabilities
                          </h3>
                        </div>
                        <ExternalLink href={support.sourceUrl}>
                          Official support plans
                        </ExternalLink>
                      </div>
                      <div className="support-capabilities">
                        <span
                          className={
                            support.architectureReview
                              ? "available"
                              : "unavailable"
                          }
                        >
                          Architecture review
                        </span>
                        <span
                          className={
                            support.professionalServices
                              ? "available"
                              : "unavailable"
                          }
                        >
                          Professional services
                        </span>
                        <span
                          className={
                            support.successProgram ? "available" : "unavailable"
                          }
                        >
                          Success program
                        </span>
                        <span
                          className={
                            support.training ? "available" : "unavailable"
                          }
                        >
                          Training
                        </span>
                      </div>
                      {support.tiers.length ? (
                        <div
                          className="directory-tag-list"
                          aria-label="Named support plans"
                        >
                          {support.tiers.map((tier) => (
                            <span key={tier}>{tier}</span>
                          ))}
                        </div>
                      ) : null}
                      {support.note ? (
                        <p className="directory-note">{support.note}</p>
                      ) : null}
                    </section>
                  </>
                ) : null}
                {provider.supportTiers?.length ? (
                  <section
                    className="directory-detail-card directory-support-tier-card"
                    aria-labelledby="support-tiers-heading"
                  >
                    <span className="eyebrow">Plan comparison</span>
                    <h3 id="support-tiers-heading">Support tiers</h3>
                    <div
                      className="directory-record-table"
                      role="table"
                      aria-label="Published support tiers"
                    >
                      <div
                        className="directory-record-row directory-support-tier-row directory-record-header"
                        role="row"
                      >
                        <span>Plan</span>
                        <span>Price</span>
                        <span>SLA access</span>
                        <span>Response target</span>
                      </div>
                      {provider.supportTiers.map((tier) => (
                        <div
                          className="directory-record-row directory-support-tier-row"
                          role="row"
                          key={tier.slug}
                        >
                          <strong>{tier.name}</strong>
                          <span>{tier.price ?? "Not published"}</span>
                          <span>
                            {tier.slaEligible ? "Included" : "Not included"}
                          </span>
                          <span>{tier.responseTime ?? "Not published"}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {tab === "overrides" ? (
          <div className="contract-overrides-view">
            <div className="contract-overrides-toolbar">
              <div>
                <strong>Tenant SLA terms</strong>
                <span>
                  Shared in this environment. Public records remain unchanged.
                </span>
              </div>
              <Button
                size="condensed"
                variant="emphasized"
                disabled={
                  !contractSettings.canWrite || contractSettings.mutating
                }
                onClick={() => openCreateSettings()}
              >
                Add SLA override
              </Button>
            </div>
            {!contractSettings.canRead || contractSettings.error ? (
              <div className="error-box compact-error">
                Contract settings are unavailable for this user. Ask a Dynatrace
                administrator for app-settings read access.
              </div>
            ) : null}
            {!contractSettings.loading && !contractSettings.canWrite ? (
              <div className="settings-permission-note">
                You can review overrides, but your role cannot change them.
              </div>
            ) : null}
            <div className="contract-security-note">
              <strong>Data boundary</strong>
              <span>
                Store operational values and a reference only. All authenticated
                SLA Watch users can read these settings, so do not paste
                confidential contract text or credentials.
              </span>
            </div>
            {contractSettings.loading ? (
              <div className="directory-loading" role="status">
                <strong>Loading SLA overrides</strong>
                <span>Reading shared App Settings.</span>
              </div>
            ) : providerOverrides.length === 0 ? (
              <div className="contract-empty">
                <strong>No tenant overrides for {provider.name}</strong>
                <span>
                  Until an override is added, SLA Watch uses the public
                  directory record.
                </span>
                <Button
                  size="condensed"
                  disabled={!contractSettings.canWrite}
                  onClick={() => openCreateSettings()}
                >
                  Add the first SLA override
                </Button>
              </div>
            ) : (
              <div
                className="contract-override-list"
                role="list"
                aria-label={`${provider.name} SLA overrides`}
              >
                {providerOverrides.map((override) => {
                  const state = overrideState(override);
                  const sourceUrl = safeExternalUrl(override.sourceUrl);
                  return (
                    <article
                      className="contract-override-row"
                      role="listitem"
                      key={override.objectId}
                    >
                      <div className="contract-override-scope">
                        <strong>{override.providerServiceName}</strong>
                        <span>{overrideScopeSummary(override)}</span>
                      </div>
                      <div className="contract-override-terms">
                        <strong>{overrideTerms(override)}</strong>
                        <span>
                          Effective {override.effectiveFrom}
                          {override.effectiveTo
                            ? ` to ${override.effectiveTo}`
                            : ""}
                        </span>
                      </div>
                      <div className="contract-override-source">
                        <span>Source</span>
                        {sourceUrl ? (
                          <a href={sourceUrl} target="_blank" rel="noreferrer">
                            {override.sourceReference}
                          </a>
                        ) : (
                          <strong>{override.sourceReference}</strong>
                        )}
                      </div>
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      <Button
                        size="condensed"
                        disabled={!contractSettings.canWrite}
                        onClick={() => openEdit(override)}
                      >
                        Edit
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <ContractOverrideEditor
        show={editorOpen}
        provider={directory}
        services={services}
        topology={topology}
        overrides={providerOverrides}
        existing={editing}
        canWrite={contractSettings.canWrite}
        saving={contractSettings.mutating}
        onDismiss={() => {
          if (!contractSettings.mutating) {
            setEditorOpen(false);
            setEditing(undefined);
          }
        }}
        onSave={async (
          value: ContractOverrideValue,
          existing?: ContractOverrideRecord,
        ) => {
          if (existing) await contractSettings.updateOverride(existing, value);
          else await contractSettings.createOverride(value);
        }}
        onDelete={contractSettings.deleteOverride}
      />
    </div>
  );
};
