import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Tenants from "@/pages/tenants";
import Mappings from "@/pages/mappings";
import Workflows from "@/pages/workflows";
import Tokens from "@/pages/tokens";
import Webhooks from "@/pages/webhooks";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/tenants" component={Tenants} />
      <Route path="/mappings" component={Mappings} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/tokens" component={Tokens} />
      <Route path="/webhooks" component={Webhooks} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
