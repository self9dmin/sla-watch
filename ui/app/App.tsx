import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
    <ProgressCircle aria-label="Loading SLA Watch" />
    <div>
      <Heading level={3}>Loading your watch setup</Heading>
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
}) => (
  <div className="sla-app">
    <header className="sla-header">
      <Header theme={theme} onToggleTheme={onToggleTheme} onStartTour={onStartTour} />
    </header>
    <main className="sla-main">
      {saveError ? <div className="save-status" role="status">{saveError}</div> : null}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/evidence" element={<Dashboard initialSection="evidence" />} />
        <Route path="/directory" element={<Dashboard initialSection="directory" />} />
        <Route path="/review" element={<Dashboard initialSection="review" />} />
        <Route path="/changes" element={<ChangeLogPage />} />
        <Route path="/settings/:page?" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);

const AppContent = () => {
  const navigate = useNavigate();
  const systemTheme = useCurrentTheme() === "dark" ? "dark" : "light";
  const { preferences, loading, saveError, updatePreferences } = useSlaPreferences();
  const [tourOpen, setTourOpen] = useState(false);
  const theme: AppTheme = preferences.theme === "system" ? systemTheme : preferences.theme;

  useEffect(() => {
    if (!loading && preferences.onboardingComplete && !preferences.tourCompleted) setTourOpen(true);
  }, [loading, preferences.onboardingComplete, preferences.tourCompleted]);

  useEffect(() => {
    if (!preferences.onboardingComplete) setTourOpen(false);
  }, [preferences.onboardingComplete]);

  const completeOnboarding = async (providerSlug: string) => {
    await updatePreferences({ onboardingComplete: true, tourCompleted: false, providerSlug });
    await navigate("/");
  };

  const skipOnboarding = async () => {
    await updatePreferences({ onboardingComplete: true, tourCompleted: false });
    await navigate("/");
  };

  const content = loading ? (
    <LoadingScreen />
  ) : !preferences.onboardingComplete ? (
    <OnboardingWizard
      initialProvider={preferences.providerSlug}
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
