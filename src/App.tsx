import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/common/app-sidebar";
import { ThemeProvider } from "@/components/common/theme-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/auth-page";
import Accounts from "@/pages/Accounts";
import Investments from "@/pages/Investments";
import RealEstate from "@/pages/RealEstate";
import RealEstateDetail from "@/pages/RealEstateDetail";
import Insurance from "@/pages/Insurance";
import InsuranceDetail from "@/pages/InsuranceDetail";
import Loans from "@/pages/Loans";
import Bonds from "@/pages/Bonds";
import Crypto from "@/pages/Crypto";
import Settings from "@/pages/Settings";
import OtherAssets from "@/pages/OtherAssets";
import Cashflow from "@/pages/Cashflow";
import Projection from "@/pages/Projection";
import AnnuityCalculator from "@/pages/AnnuityCalculator";
import EstateCalculator from "@/pages/EstateCalculator";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { CurrencyProvider } from "@/lib/currency";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { I18nProvider } from "@/i18n/I18nProvider";
import { UpdateNotification } from "@/components/update-notification";
import { AboutModal } from "@/components/common/AboutModal";
import { UpdateStatusBadge } from "@/components/common/UpdateStatusBadge";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/accounts" component={Accounts} />
      <ProtectedRoute path="/investments" component={Investments} />
      <ProtectedRoute path="/real-estate" component={RealEstate} />
      <ProtectedRoute path="/real-estate/:id" component={RealEstateDetail} />
      <ProtectedRoute path="/insurance" component={Insurance} />
      <ProtectedRoute path="/insurance/:id" component={InsuranceDetail} />
      <ProtectedRoute path="/loans" component={Loans} />
      <ProtectedRoute path="/bonds" component={Bonds} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/crypto" component={Crypto} />
      <ProtectedRoute path="/other-assets" component={OtherAssets} />
      <ProtectedRoute path="/reports/cashflow" component={Cashflow} />
      <ProtectedRoute path="/reports/projection" component={Projection} />
      <ProtectedRoute path="/calculators/annuity" component={AnnuityCalculator} />
      <ProtectedRoute path="/calculators/estate" component={EstateCalculator} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [location] = useLocation();

  if (location === "/auth") {
    return <AuthPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <UpdateStatusBadge />
            <AboutModal />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Router />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AuthProvider>
          <I18nProvider>
            <CurrencyProvider>
              <TooltipProvider>
                <ErrorBoundary>
                  <AppLayout />
                </ErrorBoundary>
                <Toaster />
                <UpdateNotification />
              </TooltipProvider>
            </CurrencyProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
