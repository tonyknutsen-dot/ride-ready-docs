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
import FloatingBugButton from "@/components/FloatingBugButton";
import TesterSessionTracker from "@/components/TesterSessionTracker";
import { AppLayout } from "@/components/AppLayout";
import { Loader2, FileText } from "lucide-react";

// Eager load critical pages
import ComingSoon from "./pages/ComingSoon";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load non-critical pages for better initial load
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
const Maintenance = lazy(() => import("./pages/Maintenance"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RideTypeRequests = lazy(() => import("./pages/admin/RideTypeRequests"));
const DocumentTypeRequests = lazy(() => import("./pages/admin/DocumentTypeRequests"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const SupportMessages = lazy(() => import("./pages/admin/SupportMessages"));
const SecurityDashboard = lazy(() => import("./pages/admin/SecurityDashboard"));
const BugReports = lazy(() => import("./pages/admin/BugReports"));
const CheckItemSubmissions = lazy(() => import("./pages/admin/CheckItemSubmissions"));
const RiskAssessments = lazy(() => import("./pages/RiskAssessments"));
const GlobalDocumentsPage = lazy(() => import("./pages/GlobalDocumentsPage"));
const Documents = lazy(() => import("./pages/Documents"));
const BatchSendDocuments = lazy(() => import("./pages/BatchSendDocuments"));
const Marketing = lazy(() => import("./pages/Marketing"));
const TesterInvite = lazy(() => import("./pages/TesterInvite"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const MyBugReports = lazy(() => import("./pages/MyBugReports"));

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
              <TesterSessionTracker />
              <GlobalEventBridge />
              <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<ComingSoon />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              <Route path="/tester-invite/:token" element={<TesterInvite />} />
              <Route 
                path="/overview" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Overview />
                      </AppLayout>
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
                      <AppLayout>
                        <Rides />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/rides/:id" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <RideDetailPage />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Calendar />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/billing"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <PlanBilling />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Settings />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/my-bug-reports"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <MyBugReports />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/risk-assessments"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <RiskAssessments />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/global-documents"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <GlobalDocumentsPage />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/send-documents"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <BatchSendDocuments />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/marketing"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <Marketing />
                      </AppLayout>
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
                        <AppLayout>
                          <Checks />
                        </AppLayout>
                      </FeatureGate>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Maintenance route - requires advanced plan */}
              <Route 
                path="/maintenance" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <FeatureGate requiredPlan="advanced" feature="Maintenance">
                        <AppLayout>
                          <Maintenance />
                        </AppLayout>
                      </FeatureGate>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* All Documents page */}
              <Route 
                path="/documents"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Documents />
                      </AppLayout>
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
                      <AppLayout>
                        <AdminDashboard />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/ride-requests" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <RideTypeRequests />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/document-requests" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <DocumentTypeRequests />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <UserManagement />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/support" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <SupportMessages />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/security" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <SecurityDashboard />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/bug-reports" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <BugReports />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/check-items" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <CheckItemSubmissions />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <MobileBottomNav />
              <FloatingBugButton />
              <CookieConsentBanner />
            </TesterProvider>
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
