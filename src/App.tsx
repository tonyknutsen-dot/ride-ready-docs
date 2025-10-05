import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ProfileGuard } from "@/components/ProfileGuard";
import { FeatureGate } from "@/components/FeatureGate";
import ScrollToTop from "@/components/ScrollToTop";
import MobileBottomNav from "@/components/MobileBottomNav";
import GlobalEventBridge from "@/components/GlobalEventBridge";
import { isDocs, isChecks } from "@/config/appFlavor";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Demo from "./pages/Demo";
import Overview from "./pages/Overview";
import Rides from "./pages/Rides";
import RideDetailPage from "./pages/RideDetailPage";
import Calendar from "./pages/Calendar";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import NotFound from "./pages/NotFound";
import PlanBilling from "./pages/PlanBilling";
import HowItWorks from "./pages/HowItWorks";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import HelpCenter from "./pages/HelpCenter";
import Security from "./pages/Security";
import Checks from "./pages/Checks";
import SetupAdmin from "./pages/SetupAdmin";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RideTypeRequests from "./pages/admin/RideTypeRequests";
import DocumentTypeRequests from "./pages/admin/DocumentTypeRequests";
import UserManagement from "./pages/admin/UserManagement";
import SupportMessages from "./pages/admin/SupportMessages";
import AppHeader from "./components/AppHeader";
import RiskAssessments from "./pages/RiskAssessments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AdminProvider>
            <GlobalEventBridge />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/demo" element={<Demo />} />
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
                path="/dashboard" 
                element={<Navigate to="/overview" replace />} 
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MobileBottomNav />
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
