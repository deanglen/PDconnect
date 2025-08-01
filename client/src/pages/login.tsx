import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { setStoredApiKey } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Key, Shield, ArrowRight, CheckCircle, Users, Building, Workflow } from "lucide-react";

export default function Login() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Test the API key by trying to fetch user profile
      const response = await fetch("/api/users/me", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        // API key is valid, store it and redirect
        setStoredApiKey(apiKey);
        toast({
          title: "Login successful",
          description: `Welcome back, ${user.firstName} ${user.lastName}`,
        });
        navigate("/");
        window.location.reload(); // Refresh to update auth state
      } else {
        setError("Invalid API key. Please check your credentials and try again.");
      }
    } catch (err) {
      setError("Connection error. Please check your network and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLoginWithDemo = async () => {
    setApiKey("user_1753977596251_ockbkuys03");
    // Auto-submit with demo credentials
    setTimeout(() => {
      document.getElementById('login-form')?.dispatchEvent(new Event('submit', { bubbles: true }));
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Integration Manager</h1>
                <p className="text-gray-600">SugarCRM ↔ PandaDoc Middleware</p>
              </div>
            </div>
            <p className="text-lg text-gray-700">
              Streamline your document workflows with intelligent automation and seamless integration.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Multi-Tenant Architecture</h3>
                <p className="text-gray-600">Isolated configurations for each client with secure tenant management.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Dynamic Field Mapping</h3>
                <p className="text-gray-600">Intelligent field resolution from SugarCRM to PandaDoc tokens.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Role-Based Access</h3>
                <p className="text-gray-600">Comprehensive user management with granular permissions.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Production Ready
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Enterprise Grade
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              Multi-Cloud
            </Badge>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-2 text-center pb-6">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
              <CardDescription className="text-gray-600">
                Enter your API key to access the integration dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form id="login-form" onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                    API Key
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your personal API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pl-10 h-12 border-gray-200 focus:border-primary"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Use your personal API key provided by your system administrator
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Demo Access</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-gray-200 hover:bg-gray-50"
                onClick={quickLoginWithDemo}
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Quick Login (Demo Account)</span>
                </div>
              </Button>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Dustin Anglen - Super Administrator
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  dustin.anglen@pandadoc.com
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              Secure API key authentication • Enterprise grade security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}