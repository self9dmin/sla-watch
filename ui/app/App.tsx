import React, { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Header } from "./components/Header";
import { ProductTour } from "./components/ProductTour";
import { safeWorkspaceReturnPath } from "./data/reviewRoutes";
import { SlaPreferencesProvider, useSlaPreferences } from "./context/SlaPreferencesContext";
import { ChangeLogPage } from "./pages/ChangeLogPage";
import { Dashboard } from "./pages/Dashboard";
import { SettingsPage } from "./pages/SettingsPage";
import "./theme.css";

type AppTheme = "light" | "dark";

const LoadingScreen = () => (
  <div className="sla-loading-screen">
    <ProgressCircle aria-label="Loading SLA Review" />
    <div>
      <Heading level={3}>Loading provider coverage</Heading>
      <Paragraph>Restoring provider, theme, and workflow preferences.</Paragraph>
    </div>
  </div>
);

const LegacyCoverageRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} replace />;
};

const LegacyIncidentRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/evidence${location.search}`} replace />;
};

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
  const compactWatch = location.pathname === "/" || location.pathname === "/setup" || location.pathname === "/performance" || location.pathname === "/incidents" || location.pathname === "/provider-notices" || location.pathname === "/evidence" || location.pathname === "/directory";
  const singleScrollReview = location.pathname === "/evidence" && new URLSearchParams(location.search).get("view") !== "provider-reports";
  return (
    <div className="sla-app">
      <header className="sla-header">
        <Header theme={theme} onToggleTheme={onToggleTheme} onStartTour={onStartTour} />
      </header>
      <main className={`sla-main${compactWatch ? " sla-main-watch" : ""}${singleScrollReview ? " sla-main-evidence" : ""}`}>
        {saveError ? <div className="save-status" role="status">{saveError}</div> : null}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<LegacyCoverageRedirect />} />
          <Route path="/performance" element={<Dashboard initialSection="performance" />} />
          <Route path="/incidents" element={<LegacyIncidentRedirect />} />
          <Route path="/provider-notices" element={<Navigate to="/evidence?view=provider-reports" replace />} />
          <Route path="/evidence" element={<Dashboard initialSection="evidence" />} />
          <Route path="/finops" element={<Dashboard initialSection="finops" />} />
          <Route path="/review" element={<LegacyIncidentRedirect />} />
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
  const location = useLocation();
  const navigate = useNavigate();
  const systemTheme = useCurrentTheme() === "dark" ? "dark" : "light";
  const { preferences, loading, saveError, updatePreferences } = useSlaPreferences();
  const [tourOpen, setTourOpen] = useState(false);
  const tourReturnPath = useRef("/");
  const theme: AppTheme = preferences.theme === "system" ? systemTheme : preferences.theme;

  const startTour = () => {
    tourReturnPath.current = `${location.pathname}${location.search}`;
    setTourOpen(true);
  };

  const closeTour = () => {
    setTourOpen(false);
    void navigate(tourReturnPath.current);
  };

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
    const search = new URLSearchParams(location.search);
    if (search.get("walkthrough") !== "1") return;
    const requestedReturn = search.get("tourReturn");
    search.delete("walkthrough");
    search.delete("tourReturn");
    tourReturnPath.current = requestedReturn
      ? safeWorkspaceReturnPath(requestedReturn, "/")
      : `${location.pathname}${search.toString() ? `?${search.toString()}` : ""}`;
    setTourOpen(true);
    void navigate({
      pathname: location.pathname,
      search: search.toString() ? `?${search.toString()}` : "",
    }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const content = loading ? (
    <LoadingScreen />
  ) : (
    <AppShell
      theme={theme}
      onToggleTheme={() => {
        void updatePreferences({ theme: theme === "dark" ? "light" : "dark" });
      }}
      onStartTour={startTour}
      saveError={saveError}
    />
  );

  return (
    <div className="sla-theme-root" data-app-theme={theme}>
      {content}
      {tourOpen ? (
        <ProductTour providerSlug={preferences.providerSlug} onComplete={closeTour} />
      ) : null}
    </div>
  );
};

export const App = () => (
  <SlaPreferencesProvider>
    <AppContent />
  </SlaPreferencesProvider>
);
