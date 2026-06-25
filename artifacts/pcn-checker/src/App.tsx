import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import VehiclesPage from "@/pages/vehicles";
import PCNsPage from "@/pages/pcns";
import UploadPCNPage from "@/pages/upload-pcn";
import PCNDetailPage from "@/pages/pcn-detail";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { session, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !session) {
      setLocation("/auth");
    }
  }, [session, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return null; // Will redirect
  }

  return <Component {...rest} />;
}

function Router() {
  const { session, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Root redirect
  useEffect(() => {
    if (!isLoading && location === "/") {
      setLocation(session ? "/dashboard" : "/auth");
    }
  }, [location, session, isLoading, setLocation]);

  if (location === "/") return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      
      <Route path="/vehicles">
        {() => <ProtectedRoute component={VehiclesPage} />}
      </Route>

      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      
      <Route path="/pcns">
        {() => <ProtectedRoute component={PCNsPage} />}
      </Route>
      
      <Route path="/pcns/upload">
        {() => <ProtectedRoute component={UploadPCNPage} />}
      </Route>
      
      <Route path="/pcns/:id">
        {params => <ProtectedRoute component={PCNDetailPage} id={params.id} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
