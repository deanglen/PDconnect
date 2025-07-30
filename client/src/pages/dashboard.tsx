import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: () => api.getStats(),
  });

  if (statsLoading) {
    return (
      <div className="flex-1">
        <Topbar 
          title="Dashboard" 
          description="Monitor integration performance and manage configurations"
        />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Dashboard" 
        description="Monitor integration performance and manage configurations"
        actions={
          <>
            <Button variant="outline" className="bg-green-600 text-white hover:bg-green-700">
              <i className="fas fa-plug mr-2"></i>
              Test Connection
            </Button>
            <Button className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-file-plus mr-2"></i>
              Create Document
            </Button>
          </>
        }
      />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Documents Created"
            value={stats?.documentsCreated || 0}
            change={stats?.documentsGrowth || "0% from last month"}
            icon={<i className="fas fa-file-alt text-primary text-xl"></i>}
            iconBg="bg-blue-100"
            changeType="positive"
          />
          <StatsCard
            title="Active Tenants"
            value={stats?.activeTenants || 0}
            change={stats?.tenantsGrowth || "0 new this month"}
            icon={<i className="fas fa-building text-green-600 text-xl"></i>}
            iconBg="bg-green-100"
            changeType="positive"
          />
          <StatsCard
            title="Success Rate"
            value={`${stats?.successRate || 0}%`}
            change={stats?.successTrend || "On target"}
            icon={<i className="fas fa-chart-line text-green-600 text-xl"></i>}
            iconBg="bg-green-100"
            changeType="positive"
          />
          <StatsCard
            title="Webhook Events"
            value={stats?.webhookEvents || 0}
            change={stats?.webhookRecent || "No recent activity"}
            icon={<i className="fas fa-exchange-alt text-orange-600 text-xl"></i>}
            iconBg="bg-orange-100"
            changeType="neutral"
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Documents</CardTitle>
                <a href="#" className="text-primary hover:text-blue-700 text-sm font-medium">View All</a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center text-gray-500 py-8">
                  <i className="fas fa-file-alt text-4xl mb-4 text-gray-300"></i>
                  <p>No recent documents</p>
                  <p className="text-sm">Documents will appear here when created</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Health</CardTitle>
                <div className="flex items-center text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                  <span className="text-sm font-medium">All Systems Operational</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <i className="fas fa-database text-gray-400 mr-3"></i>
                    <span className="text-gray-700">SugarCRM Connection</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600 font-medium">Online</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <i className="fas fa-file-alt text-gray-400 mr-3"></i>
                    <span className="text-gray-700">PandaDoc API</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600 font-medium">Online</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <i className="fas fa-link text-gray-400 mr-3"></i>
                    <span className="text-gray-700">Webhook Endpoint</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600 font-medium">Active</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <i className="fas fa-server text-gray-400 mr-3"></i>
                    <span className="text-gray-700">Database</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600 font-medium">Healthy</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
