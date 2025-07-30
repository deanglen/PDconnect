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
import Documents from "@/pages/documents";
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
      <Route path="/documents" component={Documents} />
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
          <main className="flex-1 overflow-auto">
            <div className="bg-white border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-end">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    AD
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Admin User</p>
                    <p className="text-xs text-gray-500">admin@company.com</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <Router />
            </div>
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
