import React, { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { TesterProvider } from "@/contexts/TesterContext";
import { StaffProvider } from "@/contexts/StaffContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ProfileGuard } from "@/components/ProfileGuard";
import { FeatureGate } from "@/components/FeatureGate";
import { StaffRoute } from "@/components/StaffRoute";
import ScrollToTop from "@/components/ScrollToTop";
import { LastRouteTracker } from "@/components/LastRouteTracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { AppLayout } from "@/components/AppLayout";
import { AuthenticatedAppShell } from "@/components/AuthenticatedAppShell";
import { PWAUpdateModal } from "@/components/PWAUpdateModal";
import { LockScreenProvider } from "@/components/LockScreenProvider";
import { OfflineSuspense } from "@/components/OfflineSuspense";
import { useLocation } from "react-router-dom";

/** Wrapper that passes current pathname to OfflineSuspense so it resets on navigation */
function LocationAwareOfflineSuspense({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <OfflineSuspense resetKey={pathname}>{children}</OfflineSuspense>;
}

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
const ChecksRegister = lazy(() => import("./pages/ChecksRegister"));
const ChecklistExecutionPage = lazy(() => import("./pages/ChecklistExecutionPage"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RideTypeRequests = lazy(() => import("./pages/admin/RideTypeRequests"));
const DocumentTypeRequests = lazy(() => import("./pages/admin/DocumentTypeRequests"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const SupportMessages = lazy(() => import("./pages/admin/SupportMessages"));
const SecurityDashboard = lazy(() => import("./pages/admin/SecurityDashboard"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const SupportAccessAdmin = lazy(() => import("./pages/admin/SupportAccessAdmin"));
const BugReports = lazy(() => import("./pages/admin/BugReports"));
const FeatureRequests = lazy(() => import("./pages/admin/FeatureRequests"));
const CheckItemSubmissions = lazy(() => import("./pages/admin/CheckItemSubmissions"));
const CheckLibrary = lazy(() => import("./pages/admin/CheckLibrary"));
const EquipmentTypeLibrary = lazy(() => import("./pages/admin/EquipmentTypeLibrary"));
const DocumentTypeLibrary = lazy(() => import("./pages/admin/DocumentTypeLibrary"));
const RiskItemSubmissions = lazy(() => import("./pages/admin/RiskItemSubmissions"));
const RiskLibrary = lazy(() => import("./pages/admin/RiskLibrary"));
const EarlyAccessSignups = lazy(() => import("./pages/admin/EarlyAccessSignups"));
const PaymentsDashboard = lazy(() => import("./pages/admin/PaymentsDashboard"));
const RiskAssessments = lazy(() => import("./pages/RiskAssessments"));
const GlobalDocumentsPage = lazy(() => import("./pages/GlobalDocumentsPage"));
const Documents = lazy(() => import("./pages/Documents"));
const BatchSendDocuments = lazy(() => import("./pages/BatchSendDocuments"));
const Marketing = lazy(() => import("./pages/Marketing"));
const TesterInvite = lazy(() => import("./pages/TesterInvite"));
const StaffInvite = lazy(() => import("./pages/StaffInvite"));
const Staff = lazy(() => import("./pages/Staff"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const MyBugReports = lazy(() => import("./pages/MyBugReports"));
const Install = lazy(() => import("./pages/Install"));
const DataIndependence = lazy(() => import("./pages/DataIndependence"));
const SharedDocuments = lazy(() => import("./pages/SharedDocuments"));
const WindLog = lazy(() => import("./pages/WindLog"));
const DefectRegister = lazy(() => import("./pages/DefectRegister"));
const DefectReport = lazy(() => import("./pages/DefectReport"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Compliance = lazy(() => import("./pages/Compliance"));
const DocumentViewerPage = lazy(() => import("./pages/DocumentViewerPage"));
const InspectionRecordPage = lazy(() => import("./pages/InspectionRecordPage"));
const Reports = lazy(() => import("./pages/Reports"));
const PressureReadings = lazy(() => import("./pages/PressureReadings"));
const PressureReadingsRegister = lazy(() => import("./pages/PressureReadingsRegister"));
const SupportRequests = lazy(() => import("./pages/SupportRequests"));

// PageLoader is now inside OfflineSuspense

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
      <PWAUpdateModal />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <LastRouteTracker />
          <AdminProvider>
            <TesterProvider>
              <StaffProvider>
              {/* Authenticated user components loaded lazily */}
              <AuthenticatedAppShell />
              <LockScreenProvider>
              <LocationAwareOfflineSuspense>
              <Routes>
              <Route path="/" element={<ComingSoon />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              <Route path="/staff-invite/:token" element={<StaffInvite />} />
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
              <Route path="/install" element={<Install />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/security" element={<Security />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/data-independence" element={<DataIndependence />} />
              <Route path="/dpa" element={<DataProcessingAgreement />} />
              <Route 
                path="/support-requests" 
                element={
                  <ProtectedRoute>
                    <SupportRequests />
                  </ProtectedRoute>
                } 
              />
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
                      <StaffRoute ownerOnly>
                        <AppLayout>
                          <PlanBilling />
                        </AppLayout>
                      </StaffRoute>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <StaffRoute ownerOnly>
                        <AppLayout>
                          <Settings />
                        </AppLayout>
                      </StaffRoute>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/staff"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <StaffRoute ownerOnly>
                        <AppLayout>
                          <Staff />
                        </AppLayout>
                      </StaffRoute>
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
              <Route 
                path="/wind-log"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <WindLog />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/defects"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <DefectRegister />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Defect Report route */}
              <Route 
                path="/defect-report"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <DefectReport />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Checks route */}
              <Route 
                path="/checks" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Checks />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Per-equipment Checks Register */}
              <Route 
                path="/checks/register" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <ChecksRegister />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Checklist Execution route */}
              <Route 
                path="/checks/:rideId/:frequency/execute" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <ChecklistExecutionPage />
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Maintenance route */}
              <Route 
                path="/maintenance" 
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Maintenance />
                      </AppLayout>
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
                path="/admin/audit-logs" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <AuditLogs />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/support-access" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <SupportAccessAdmin />
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
                path="/admin/feature-requests" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <FeatureRequests />
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
              <Route 
                path="/admin/check-library" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <CheckLibrary />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/equipment-type-library" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <EquipmentTypeLibrary />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/document-type-library" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <DocumentTypeLibrary />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/risk-library" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <RiskLibrary />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/risk-items" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <RiskItemSubmissions />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/early-access" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <EarlyAccessSignups />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/payments" 
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppLayout>
                        <PaymentsDashboard />
                      </AppLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                } 
              />
              {/* Public shared documents download page - no auth required */}
              <Route path="/shared/:token" element={<SharedDocuments />} />
              <Route 
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Notifications />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/compliance"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Compliance />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Reports */}
              <Route 
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Document Viewer - full page, no sidebar layout */}
              <Route 
                path="/documents/:documentId"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DocumentViewerPage />
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Inspection Record - full page view */}
              <Route 
                path="/inspection-record/:recordId"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <InspectionRecordPage />
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* Pressure Readings */}
              <Route 
                path="/pressure-readings"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <PressureReadings />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/pressure-readings/register"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <AppLayout>
                        <PressureReadingsRegister />
                      </AppLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              </LocationAwareOfflineSuspense>
              </LockScreenProvider>
              {/* Cookie consent shown globally (lightweight) */}
              <CookieConsentBanner />
              </StaffProvider>
            </TesterProvider>
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
