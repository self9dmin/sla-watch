import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useAppState,
  useSetAppState,
  useSetUserAppState,
  useUserAppState,
} from "@dynatrace-sdk/react-hooks";
import {
  DEFAULT_SLA_PREFERENCES,
  type SlaPreferences,
  type SlaThemePreference,
} from "../types";
import { createStateExpiration } from "../data/stateExpiration";
import { isEvidenceLookbackHours } from "../data/lookback";
import { normalizeProviderSlug, normalizeProviderSlugs, sortProviderSlugs } from "../data/providers";

const USER_STATE_KEY = "sla.user.v1";
const WORKSPACE_STATE_KEY = "sla.workspace.v1";
const LEGACY_STATE_KEY = "sla.preferences.v1";
const USER_LOCAL_KEY = "sla.user.v1.local";
const WORKSPACE_LOCAL_KEY = "sla.workspace.v1.local";
const LEGACY_LOCAL_KEY = "sla.preferences.v1.local";

type PreferencesPatch = Partial<SlaPreferences>;
type UserPreferencesState = Pick<SlaPreferences, "theme">;
type WorkspacePreferencesState = Pick<SlaPreferences, "providerSlugs" | "manualProviderSlugs" | "providerSlug" | "providerLabelKey" | "lookbackHours">;

const USER_FIELDS: ReadonlyArray<keyof UserPreferencesState> = ["theme"];
const WORKSPACE_FIELDS: ReadonlyArray<keyof WorkspacePreferencesState> = ["providerSlugs", "manualProviderSlugs", "providerSlug", "providerLabelKey", "lookbackHours"];

export interface SlaPreferencesContextValue {
  preferences: SlaPreferences;
  loading: boolean;
  saveError: string | null;
  updatePreferences: (patch: PreferencesPatch) => Promise<void>;
}

const PreferencesContext = createContext<SlaPreferencesContextValue | null>(null);

const isTheme = (value: unknown): value is SlaThemePreference =>
  value === "system" || value === "light" || value === "dark";

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const normalizePreferences = (value: unknown): SlaPreferences => {
  if (typeof value !== "object" || value === null) return DEFAULT_SLA_PREFERENCES;
  const item = value as Record<string, unknown>;
  const requestedActiveProvider = normalizeProviderSlug(item.providerSlug) ?? DEFAULT_SLA_PREFERENCES.providerSlug;
  const providerSlugs = normalizeProviderSlugs(item.providerSlugs, DEFAULT_SLA_PREFERENCES.providerSlugs);
  const manualProviderSlugs = sortProviderSlugs(
    normalizeProviderSlugs(item.manualProviderSlugs, []),
  );
  const monitoredProviders = providerSlugs.includes(requestedActiveProvider)
    ? providerSlugs
    : [...providerSlugs, requestedActiveProvider].slice(0, 12);
  return {
    theme: isTheme(item.theme) ? item.theme : DEFAULT_SLA_PREFERENCES.theme,
    providerSlugs: monitoredProviders,
    manualProviderSlugs,
    providerSlug: requestedActiveProvider,
    providerLabelKey: stringOr(item.providerLabelKey, DEFAULT_SLA_PREFERENCES.providerLabelKey),
    lookbackHours: isEvidenceLookbackHours(item.lookbackHours) ? item.lookbackHours : DEFAULT_SLA_PREFERENCES.lookbackHours,
  };
};

const parseState = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const mergePreferences = (...values: unknown[]): SlaPreferences => values.reduce<SlaPreferences>(
  (current, value) => normalizePreferences({ ...current, ...(typeof value === "object" && value !== null ? value : {}) }),
  DEFAULT_SLA_PREFERENCES,
);

const readLocalPreferences = (): SlaPreferences => {
  if (typeof window === "undefined") return DEFAULT_SLA_PREFERENCES;
  try {
    const legacy = parseState(window.localStorage.getItem(LEGACY_LOCAL_KEY));
    const user = parseState(window.localStorage.getItem(USER_LOCAL_KEY));
    const workspace = parseState(window.localStorage.getItem(WORKSPACE_LOCAL_KEY));
    return mergePreferences(legacy, user, workspace);
  } catch {
    return DEFAULT_SLA_PREFERENCES;
  }
};

const writeLocalState = (value: SlaPreferences): void => {
  if (typeof window === "undefined") return;
  try {
    const user: UserPreferencesState = {
      theme: value.theme,
    };
    const workspace: WorkspacePreferencesState = {
      providerSlugs: value.providerSlugs,
      manualProviderSlugs: value.manualProviderSlugs,
      providerSlug: value.providerSlug,
      providerLabelKey: value.providerLabelKey,
      lookbackHours: value.lookbackHours,
    };
    window.localStorage.setItem(USER_LOCAL_KEY, JSON.stringify(user));
    window.localStorage.setItem(WORKSPACE_LOCAL_KEY, JSON.stringify(workspace));
  } catch {
    // Local storage is only the offline fallback. Remote state remains authoritative when available.
  }
};

const hasField = (patch: PreferencesPatch, fields: ReadonlyArray<string>): boolean =>
  Object.keys(patch).some((key) => fields.includes(key));

export const SlaPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const remoteUserState = useUserAppState({ key: USER_STATE_KEY });
  const remoteWorkspaceState = useAppState({ key: WORKSPACE_STATE_KEY });
  const legacyRemoteState = useUserAppState({ key: LEGACY_STATE_KEY });
  const setUserState = useSetUserAppState();
  const setWorkspaceState = useSetAppState();
  const [preferences, setPreferences] = useState<SlaPreferences>(() => readLocalPreferences());
  const preferencesRef = useRef(preferences);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (remoteUserState.isLoading || remoteWorkspaceState.isLoading || legacyRemoteState.isLoading) return;

    const nextPreferences = mergePreferences(
      readLocalPreferences(),
      parseState(legacyRemoteState.data?.value),
      parseState(remoteUserState.data?.value),
      parseState(remoteWorkspaceState.data?.value),
    );
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    writeLocalState(nextPreferences);
    setHydrated(true);

    if (remoteUserState.error || remoteWorkspaceState.error) {
      setSaveError("Shared workspace state is unavailable. Changes are saved in this browser until app-state access is restored.");
    }
  }, [legacyRemoteState.data?.value, legacyRemoteState.isLoading, remoteUserState.data?.value, remoteUserState.error, remoteUserState.isLoading, remoteWorkspaceState.data?.value, remoteWorkspaceState.error, remoteWorkspaceState.isLoading]);

  const updatePreferences = useCallback(async (patch: PreferencesPatch) => {
    const nextPreferences = normalizePreferences({ ...preferencesRef.current, ...patch });
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    writeLocalState(nextPreferences);
    setSaveError(null);

    const userChanged = hasField(patch, USER_FIELDS);
    const workspaceChanged = hasField(patch, WORKSPACE_FIELDS);

    try {
      await Promise.all([
        userChanged
          ? setUserState.execute({
              key: USER_STATE_KEY,
              body: {
                value: JSON.stringify({
                  theme: nextPreferences.theme,
                }),
                validUntilTime: createStateExpiration(),
              },
            })
          : Promise.resolve(),
        workspaceChanged
          ? setWorkspaceState.execute({
              key: WORKSPACE_STATE_KEY,
              body: {
                value: JSON.stringify({
                  providerSlugs: nextPreferences.providerSlugs,
                  manualProviderSlugs: nextPreferences.manualProviderSlugs,
                  providerSlug: nextPreferences.providerSlug,
                  providerLabelKey: nextPreferences.providerLabelKey,
                  lookbackHours: nextPreferences.lookbackHours,
                }),
                validUntilTime: createStateExpiration(),
              },
            })
          : Promise.resolve(),
      ]);
    } catch (error: unknown) {
      console.error("Failed to persist SLA Review state:", error);
      setSaveError("Saved in this browser. Shared app state is unavailable right now.");
    }
  }, [setUserState, setWorkspaceState]);

  const value = useMemo<SlaPreferencesContextValue>(() => ({
    preferences,
    loading: !hydrated,
    saveError,
    updatePreferences,
  }), [hydrated, preferences, saveError, updatePreferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function useSlaPreferences(): SlaPreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useSlaPreferences must be used within SlaPreferencesProvider");
  return context;
}
