import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { UserProfile } from "@/components/layout/user-profile";
import { useAuth } from "@/hooks/useAuth";
import "@/utils/auth-debug"; // Enable debug utilities
import Dashboard from "@/pages/dashboard";
import Tenants from "@/pages/tenants";
import Mappings from "@/pages/mappings";
import Workflows from "@/pages/workflows";
import Tokens from "@/pages/tokens";
import LiveTesting from "@/pages/live-testing";
import Webhooks from "@/pages/webhooks";
import Documents from "@/pages/documents";
import UserManagement from "@/pages/user-management";
import DocumentTest from "@/pages/document-test";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-end">
            <UserProfile />
          </div>
        </div>
        <div className="p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/tenants" component={Tenants} />
            <Route path="/mappings" component={Mappings} />
            <Route path="/workflows" component={Workflows} />
            <Route path="/tokens" component={Tokens} />
            <Route path="/webhooks" component={Webhooks} />
            <Route path="/documents" component={Documents} />
            <Route path="/users" component={UserManagement} />
            <Route path="/live-testing" component={LiveTesting} />
            <Route path="/document-test" component={DocumentTest} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
