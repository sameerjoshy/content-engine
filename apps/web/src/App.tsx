import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login from './screens/Login';
import Profiles from './screens/Profiles';
import NewArticle from './screens/NewArticle';
import Workflow from './screens/Workflow';
import Draft from './screens/Draft';
import Studio from './screens/Studio';
import Radar from './screens/Radar';
import SeoAnalyzer from './screens/SeoAnalyzer';
import Qualifier from './screens/Qualifier';
import Diagnostic from './screens/Diagnostic';
import Listener from './screens/Listener';
import Sniper from './screens/Sniper';
import IcpClarifier from './screens/IcpClarifier';
import DealRoom from './screens/DealRoom';
import Hygiene from './screens/Hygiene';
import ForecastAnalyser from './screens/ForecastAnalyser';
import WinLoss from './screens/WinLoss';
import GoalIntegrity from './screens/GoalIntegrity';
import ChurnRadar from './screens/ChurnRadar';
import ExpansionRadar from './screens/ExpansionRadar';
import SignalsScout from './screens/SignalsScout';
import CompetitorIntel from './screens/CompetitorIntel';
import PlanningCycle from './screens/PlanningCycle';
import GoalDesigner from './screens/GoalDesigner';
import MarketResearch from './screens/MarketResearch';
import RoadmapAlign from './screens/RoadmapAlign';
import CampaignBuilder from './screens/CampaignBuilder';
import AccountPlanner from './screens/AccountPlanner';
import AbmPlaybook from './screens/AbmPlaybook';
import VideoOutreach from './screens/VideoOutreach';
import PricingStrategist from './screens/PricingStrategist';
import NegotiationCoach from './screens/NegotiationCoach';
import OnboardingCoach from './screens/OnboardingCoach';
import RenewalAnalyst from './screens/RenewalAnalyst';
import CrossSellScout from './screens/CrossSellScout';
import PipelineAuditor from './screens/PipelineAuditor';
import Attribution from './screens/Attribution';
import CompQuota from './screens/CompQuota';
import WorkflowBuilder from './screens/WorkflowBuilder';
import ChiefOfStaff from './screens/ChiefOfStaff';
import ResearchReview from './screens/ResearchReview';
import Privacy from './screens/Privacy';
import Terms from './screens/Terms';
import Engine from './screens/Engine';
import Lobby from './screens/Lobby';
import Space from './screens/Space';

const Showcase = lazy(() => import('./screens/Showcase'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);
  if (loading) return <div className="container" style={{ paddingTop: 48 }}><span className="spinner" /></div>;
  if (!user) return null;
  return <>{children}</>;
}

function AuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate('/');
  }, [user, loading, navigate]);
  if (loading) return <div className="container" style={{ paddingTop: 48 }}><span className="spinner" /></div>;
  return <Login />;
}

// Public homepage: logged-out visitors see the flashy Showcase (what we've
// built, the engine, the outcomes — no login wall); signed-in users land in
// the Lobby (one entrance that branches into outcome spaces).
function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ paddingTop: 48 }}><span className="spinner" /></div>;
  if (!user) {
    return (
      <Suspense fallback={<div className="container" style={{ paddingTop: 48 }}><span className="spinner" /></div>}>
        <Showcase />
      </Suspense>
    );
  }
  return (
    <Layout>
      <Lobby />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<AuthGate />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<HomeGate />} />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <Layout>
                  <Profiles />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/space/:id"
            element={
              <RequireAuth>
                <Layout>
                  <Space />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/engine"
            element={
              <RequireAuth>
                <Layout>
                  <Engine />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/studio"
            element={
              <RequireAuth>
                <Layout>
                  <Studio />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/radar"
            element={
              <RequireAuth>
                <Layout>
                  <Radar />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/seo"
            element={
              <RequireAuth>
                <Layout>
                  <SeoAnalyzer />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/qualify"
            element={
              <RequireAuth>
                <Layout>
                  <Qualifier />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/diagnostic"
            element={
              <RequireAuth>
                <Layout>
                  <Diagnostic />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/listen"
            element={
              <RequireAuth>
                <Layout>
                  <Listener />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/snipe"
            element={
              <RequireAuth>
                <Layout>
                  <Sniper />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/icp"
            element={
              <RequireAuth>
                <Layout>
                  <IcpClarifier />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/deal-room"
            element={
              <RequireAuth>
                <Layout>
                  <DealRoom />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/hygiene"
            element={
              <RequireAuth>
                <Layout>
                  <Hygiene />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/forecast"
            element={
              <RequireAuth>
                <Layout>
                  <ForecastAnalyser />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/win-loss"
            element={
              <RequireAuth>
                <Layout>
                  <WinLoss />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/goal-integrity"
            element={
              <RequireAuth>
                <Layout>
                  <GoalIntegrity />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/churn"
            element={
              <RequireAuth>
                <Layout>
                  <ChurnRadar />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/expansion"
            element={
              <RequireAuth>
                <Layout>
                  <ExpansionRadar />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/scout"
            element={
              <RequireAuth>
                <Layout>
                  <SignalsScout />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/competitor"
            element={
              <RequireAuth>
                <Layout>
                  <CompetitorIntel />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/planning"
            element={
              <RequireAuth>
                <Layout>
                  <PlanningCycle />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/goal-designer"
            element={
              <RequireAuth>
                <Layout>
                  <GoalDesigner />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/market"
            element={
              <RequireAuth>
                <Layout>
                  <MarketResearch />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/roadmap-align"
            element={
              <RequireAuth>
                <Layout>
                  <RoadmapAlign />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/campaign"
            element={
              <RequireAuth>
                <Layout>
                  <CampaignBuilder />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/account-planner"
            element={
              <RequireAuth>
                <Layout>
                  <AccountPlanner />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/abm"
            element={
              <RequireAuth>
                <Layout>
                  <AbmPlaybook />
                </Layout>
              </RequireAuth>
            }
          />          <Route
            path="/video-outreach"
            element={
              <RequireAuth>
                <Layout>
                  <VideoOutreach />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/pricing"
            element={
              <RequireAuth>
                <Layout>
                  <PricingStrategist />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/negotiation"
            element={
              <RequireAuth>
                <Layout>
                  <NegotiationCoach />
                </Layout>
              </RequireAuth>
            }
          />          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Layout>
                  <OnboardingCoach />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/renewal"
            element={
              <RequireAuth>
                <Layout>
                  <RenewalAnalyst />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/cross-sell"
            element={
              <RequireAuth>
                <Layout>
                  <CrossSellScout />
                </Layout>
              </RequireAuth>
            }
          />          <Route
            path="/pipeline-audit"
            element={
              <RequireAuth>
                <Layout>
                  <PipelineAuditor />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/attribution"
            element={
              <RequireAuth>
                <Layout>
                  <Attribution />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/comp-quota"
            element={
              <RequireAuth>
                <Layout>
                  <CompQuota />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/workflow"
            element={
              <RequireAuth>
                <Layout>
                  <WorkflowBuilder />
                </Layout>
              </RequireAuth>
            }
          />          <Route
            path="/command"
            element={
              <RequireAuth>
                <Layout>
                  <ChiefOfStaff />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <Layout>
                  <NewArticle />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/workflow/:id"
            element={
              <RequireAuth>
                <Layout>
                  <Workflow />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/research/:id"
            element={
              <RequireAuth>
                <Layout>
                  <ResearchReview />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/draft/:id"
            element={
              <RequireAuth>
                <Layout>
                  <Draft />
                </Layout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}