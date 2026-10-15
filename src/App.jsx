import { useState } from 'react';
import { DashboardProvider } from './context/DashboardContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import SentimentPage from './pages/SentimentPage.jsx';
import TopPostsPage from './pages/TopPostsPage.jsx';
import DataManagementPage from './pages/DataManagementPage.jsx';

/**
 * App shell: sidebar + header + page router (state-based, no router
 * dependency needed for a 5-page dashboard).
 */
export default function App() {
  const [page, setPage] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  // Optional focus hint for the Analytics page (set by clickable KPI cards).
  const [analyticsFocus, setAnalyticsFocus] = useState(null);

  const navigate = (next, focus = null) => {
    setPage(next);
    // { value, n } — the nonce gives every navigation a fresh identity so
    // clicking the same KPI card twice still re-focuses the section.
    setAnalyticsFocus(next === 'analytics' && focus ? { value: focus, n: Date.now() } : null);
    setMobileOpen(false);
    // When a focus target exists the Analytics page scrolls to its section,
    // so skip the scroll-to-top to avoid two fighting smooth scrolls.
    if (!(next === 'analytics' && focus)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPage = () => {
    switch (page) {
      case 'analytics':
        return <AnalyticsPage focus={analyticsFocus} />;
      case 'sentiment':
        return <SentimentPage />;
      case 'top':
        return <TopPostsPage />;
      case 'data':
        return <DataManagementPage />;
      case 'overview':
      default:
        return <OverviewPage onNavigate={navigate} />;
    }
  };

  return (
    <DashboardProvider>
      <div className="app-bg flex min-h-screen">
        <Sidebar
          page={page}
          onNavigate={navigate}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onToggleSidebar={() => setMobileOpen((v) => !v)} />

          <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{renderPage()}</main>

          <footer className="border-t border-slate-800/80 px-4 py-3 text-[11px] text-slate-500 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                © 2026 SocialPulse Analytics · College mini-project · Subject: Social Media Analysis &amp; Analytics
              </span>
              <span>All records are demo, user-imported, or simulated — never live platform data.</span>
            </div>
          </footer>
        </div>
      </div>
    </DashboardProvider>
  );
}
