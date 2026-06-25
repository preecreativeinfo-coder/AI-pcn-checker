import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import TollsPage from "@/pages/tolls";

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
  const reduceMotion = useReducedMotion();

  // Root redirect
  useEffect(() => {
    if (!isLoading && location === "/") {
      setLocation(session ? "/dashboard" : "/auth");
    }
  }, [location, session, isLoading, setLocation]);

  if (location === "/") return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Subtle slide-and-fade between routes. Respects reduced-motion.
  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 12 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -12 },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {/* Pass the captured location so the exiting view keeps rendering its
            old route during the transition. */}
        <Switch location={location}>
          <Route path="/auth" component={AuthPage} />

          <Route path="/dashboard">
            {() => <ProtectedRoute component={DashboardPage} />}
          </Route>

          <Route path="/vehicles">
            {() => <ProtectedRoute component={VehiclesPage} />}
          </Route>

          <Route path="/tolls">
            {() => <ProtectedRoute component={TollsPage} />}
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
      </motion.div>
    </AnimatePresence>
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
