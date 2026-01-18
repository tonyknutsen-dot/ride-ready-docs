import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { TesterProvider } from "@/contexts/TesterContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ProfileGuard } from "@/components/ProfileGuard";
import { FeatureGate } from "@/components/FeatureGate";
import ScrollToTop from "@/components/ScrollToTop";
import MobileBottomNav from "@/components/MobileBottomNav";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import GlobalEventBridge from "@/components/GlobalEventBridge";
import TestModeBanner from "@/components/TestModeBanner";
import { Loader2, FileText } from "lucide-react";

// Eager load critical pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load non-critical pages for better initial load
const Demo = lazy(() => import("./pages/Demo"));
const Overview = lazy(() => import("./pages/Overview"));
const Rides = lazy(() => import("./pages/Rides"));
const RideDetailPage = lazy(() => import("./pages/RideDetailPage"));
const Calendar = lazy(() => import("./pages/Calendar"));
const ProfileSetupPage = lazy(() => import("./pages/ProfileSetupPage"));
const PlanBilling = lazy(() => import("./pages/PlanBilling"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Security = lazy(() => import("./pages/Security"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const DataProcessingAgreement = lazy(() => import("./pages/DataProcessingAgreement"));
const Checks = lazy(() => import("./pages/Checks"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RideTypeRequests = lazy(() => import("./pages/admin/RideTypeRequests"));
const DocumentTypeRequests = lazy(() => import("./pages/admin/DocumentTypeRequests"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const SupportMessages = lazy(() => import("./pages/admin/SupportMessages"));
const SecurityDashboard = lazy(() => import("./pages/admin/SecurityDashboard"));
const AppHeader = lazy(() => import("./components/AppHeader"));
const RiskAssessments = lazy(() => import("./pages/RiskAssessments"));
const GlobalDocumentsPage = lazy(() => import("./pages/GlobalDocumentsPage"));
const BatchSendDocuments = lazy(() => import("./pages/BatchSendDocuments"));
const Marketing = lazy(() => import("./pages/Marketing"));
const TesterInvite = lazy(() => import("./pages/TesterInvite"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <FileText className="mx-auto h-12 w-12 text-primary" />
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  </div>
);

// Optimized QueryClient with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Cache for 30 minutes
      retry: 1, // Only retry once on failure
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on remount if data is fresh
      refetchOnReconnect: false, // Don't refetch on reconnect
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AdminProvider>
            <TesterProvider>
              <TestModeBanner />
              <GlobalEventBridge />
              <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/tester-invite/:token" element={<TesterInvite />} />
              <Route 
                path="/overview" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <Overview />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/security" element={<Security />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/dpa" element={<DataProcessingAgreement />} />
              <Route 
                path="/profile-setup" 
                element={
                  <ProtectedRoute>
                    <ProfileSetupPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/setup-admin" 
                element={
                  <ProtectedRoute>
                    <SetupAdmin />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/rides" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <Rides />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/rides/:id" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <RideDetailPage />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <Calendar />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/billing"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <PlanBilling />
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <Settings />
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/risk-assessments"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <RiskAssessments />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/global-documents"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <GlobalDocumentsPage />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/send-documents"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <>
                        <AppHeader />
                        <BatchSendDocuments />
                      </>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/marketing"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <Marketing />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              {/* Checks route - requires advanced plan */}
              <Route 
                path="/checks" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <FeatureGate requiredPlan="advanced" feature="Operations & Maintenance">
                        <Checks />
                      </FeatureGate>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Admin routes - separate from main app */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/ride-requests" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <RideTypeRequests />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/document-requests" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <DocumentTypeRequests />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <UserManagement />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/support" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <SupportMessages />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/security" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <SecurityDashboard />
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <MobileBottomNav />
              <CookieConsentBanner />
            </TesterProvider>
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
