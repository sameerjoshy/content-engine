import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { isAgentPortal } from './brand';
import Layout from './components/Layout';
import Login from './screens/Login';

// Route-level code splitting — every screen loads on demand.
const Profiles = lazy(() => import('./screens/Profiles'));
const NewArticle = lazy(() => import('./screens/NewArticle'));
const Workflow = lazy(() => import('./screens/Workflow'));
const Draft = lazy(() => import('./screens/Draft'));
const Studio = lazy(() => import('./screens/Studio'));
const Radar = lazy(() => import('./screens/Radar'));
const SeoAnalyzer = lazy(() => import('./screens/SeoAnalyzer'));
const Qualifier = lazy(() => import('./screens/Qualifier'));
const Diagnostic = lazy(() => import('./screens/Diagnostic'));
const Listener = lazy(() => import('./screens/Listener'));
const Sniper = lazy(() => import('./screens/Sniper'));
const IcpClarifier = lazy(() => import('./screens/IcpClarifier'));
const DealRoom = lazy(() => import('./screens/DealRoom'));
const Hygiene = lazy(() => import('./screens/Hygiene'));
const ForecastAnalyser = lazy(() => import('./screens/ForecastAnalyser'));
const WinLoss = lazy(() => import('./screens/WinLoss'));
const GoalIntegrity = lazy(() => import('./screens/GoalIntegrity'));
const ChurnRadar = lazy(() => import('./screens/ChurnRadar'));
const ExpansionRadar = lazy(() => import('./screens/ExpansionRadar'));
const SignalsScout = lazy(() => import('./screens/SignalsScout'));
const CompetitorIntel = lazy(() => import('./screens/CompetitorIntel'));
const PlanningCycle = lazy(() => import('./screens/PlanningCycle'));
const GoalDesigner = lazy(() => import('./screens/GoalDesigner'));
const MarketResearch = lazy(() => import('./screens/MarketResearch'));
const RoadmapAlign = lazy(() => import('./screens/RoadmapAlign'));
const CampaignBuilder = lazy(() => import('./screens/CampaignBuilder'));
const AccountPlanner = lazy(() => import('./screens/AccountPlanner'));
const AbmPlaybook = lazy(() => import('./screens/AbmPlaybook'));
const VideoOutreach = lazy(() => import('./screens/VideoOutreach'));
const PricingStrategist = lazy(() => import('./screens/PricingStrategist'));
const NegotiationCoach = lazy(() => import('./screens/NegotiationCoach'));
const OnboardingCoach = lazy(() => import('./screens/OnboardingCoach'));
const RenewalAnalyst = lazy(() => import('./screens/RenewalAnalyst'));
const CrossSellScout = lazy(() => import('./screens/CrossSellScout'));
const PipelineAuditor = lazy(() => import('./screens/PipelineAuditor'));
const Attribution = lazy(() => import('./screens/Attribution'));
const CompQuota = lazy(() => import('./screens/CompQuota'));
const WorkflowBuilder = lazy(() => import('./screens/WorkflowBuilder'));
const ChiefOfStaff = lazy(() => import('./screens/ChiefOfStaff'));
const ResearchReview = lazy(() => import('./screens/ResearchReview'));
const Privacy = lazy(() => import('./screens/Privacy'));
const Terms = lazy(() => import('./screens/Terms'));
const Engine = lazy(() => import('./screens/Engine'));
const Lobby = lazy(() => import('./screens/Lobby'));
const Space = lazy(() => import('./screens/Space'));
const Showcase = lazy(() => import('./screens/Showcase'));
const ContentLanding = lazy(() => import('./screens/ContentLanding'));

const RouteFallback = <div className="container" style={{ paddingTop: 48 }}><span className="spinner" /></div>;

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
        {isAgentPortal ? <Showcase /> : <ContentLanding />}
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
        <Suspense fallback={RouteFallback}>
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}