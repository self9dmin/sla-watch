import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Header } from "./components/Header";
import { ProductTour } from "./components/ProductTour";
import { SlaPreferencesProvider, useSlaPreferences } from "./context/SlaPreferencesContext";
import { ChangeLogPage } from "./pages/ChangeLogPage";
import { Dashboard } from "./pages/Dashboard";
import { OnboardingWizard } from "./pages/OnboardingWizard";
import { SettingsPage } from "./pages/SettingsPage";
import "./theme.css";

type AppTheme = "light" | "dark";

const LoadingScreen = () => (
  <div className="sla-loading-screen">
    <ProgressCircle aria-label="Loading SLA Review" />
    <div>
      <Heading level={3}>Loading your monitor setup</Heading>
      <Paragraph>Restoring provider, theme, and workflow preferences.</Paragraph>
    </div>
  </div>
);

const AppShell = ({
  theme,
  onToggleTheme,
  onStartTour,
  saveError,
}: {
  theme: AppTheme;
  onToggleTheme: () => void;
  onStartTour: () => void;
  saveError: string | null;
}) => {
  const location = useLocation();
  const compactWatch = location.pathname === "/" || location.pathname === "/setup" || location.pathname === "/incidents" || location.pathname === "/provider-notices" || location.pathname === "/directory";
  return (
    <div className="sla-app">
      <header className="sla-header">
        <Header theme={theme} onToggleTheme={onToggleTheme} onStartTour={onStartTour} />
      </header>
      <main className={`sla-main${compactWatch ? " sla-main-watch" : ""}`}>
        {saveError ? <div className="save-status" role="status">{saveError}</div> : null}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<Dashboard initialSection="setup" />} />
          <Route path="/incidents" element={<Dashboard initialSection="incidents" />} />
          <Route path="/provider-notices" element={<Dashboard initialSection="provider-notices" />} />
          <Route path="/evidence" element={<Navigate to="/setup" replace />} />
          <Route path="/review" element={<Navigate to="/incidents" replace />} />
          <Route path="/directory" element={<Dashboard initialSection="directory" />} />
          <Route path="/changes" element={<ChangeLogPage />} />
          <Route path="/settings/:page?" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const AppContent = () => {
  const navigate = useNavigate();
  const systemTheme = useCurrentTheme() === "dark" ? "dark" : "light";
  const { preferences, loading, saveError, updatePreferences } = useSlaPreferences();
  const [tourOpen, setTourOpen] = useState(false);
  const theme: AppTheme = preferences.theme === "system" ? systemTheme : preferences.theme;

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-app-theme");
    root.setAttribute("data-app-theme", theme);
    return () => {
      if (previousTheme) root.setAttribute("data-app-theme", previousTheme);
      else root.removeAttribute("data-app-theme");
    };
  }, [theme]);

  useEffect(() => {
    if (!loading && preferences.onboardingComplete && !preferences.tourCompleted) setTourOpen(true);
  }, [loading, preferences.onboardingComplete, preferences.tourCompleted]);

  useEffect(() => {
    if (!preferences.onboardingComplete) setTourOpen(false);
  }, [preferences.onboardingComplete]);

  const completeOnboarding = async (providerSlugs: string[], providerSlug: string, destination: "/setup" | "/settings/provider-connections") => {
    await updatePreferences({ onboardingComplete: true, tourCompleted: true, providerSlugs, providerSlug });
    await navigate(destination);
  };

  const skipOnboarding = async () => {
    await updatePreferences({ onboardingComplete: true, tourCompleted: true });
    await navigate("/");
  };

  const content = loading ? (
    <LoadingScreen />
  ) : !preferences.onboardingComplete ? (
    <OnboardingWizard
      initialProvider={preferences.providerSlug}
      initialProviders={preferences.providerSlugs}
      onComplete={completeOnboarding}
      onSkip={skipOnboarding}
    />
  ) : (
    <AppShell
      theme={theme}
      onToggleTheme={() => {
        void updatePreferences({ theme: theme === "dark" ? "light" : "dark" });
      }}
      onStartTour={() => setTourOpen(true)}
      saveError={saveError}
    />
  );

  return (
    <div className="sla-theme-root" data-app-theme={theme}>
      {content}
      {tourOpen ? (
        <ProductTour
          onComplete={() => {
            setTourOpen(false);
            void updatePreferences({ tourCompleted: true });
          }}
        />
      ) : null}
    </div>
  );
};

export const App = () => (
  <SlaPreferencesProvider>
    <AppContent />
  </SlaPreferencesProvider>
);
