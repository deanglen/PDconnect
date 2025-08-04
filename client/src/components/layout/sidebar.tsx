import { Link, useLocation } from "wouter";

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'fas fa-tachometer-alt' },
  { name: 'Tenant Config', href: '/tenants', icon: 'fas fa-building' },
  { name: 'Live Testing', href: '/live-testing', icon: 'fas fa-vial' },
  { name: 'Field Mappings', href: '/mappings', icon: 'fas fa-arrows-alt-h' },
  { name: 'Workflows', href: '/workflows', icon: 'fas fa-project-diagram' },
  { name: 'PD Requests', href: '/documents', icon: 'fas fa-file-alt' },
  { name: 'Token Explorer', href: '/tokens', icon: 'fas fa-tags' },
  { name: 'Webhook Logs', href: '/webhooks', icon: 'fas fa-exchange-alt' },
  { name: 'User Management', href: '/users', icon: 'fas fa-users' },
];

export function Sidebar({ className = "" }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside className={`w-60 bg-white shadow-lg border-r border-gray-200 flex-shrink-0 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Integration Manager</h1>
        <p className="text-sm text-gray-500 mt-1">SugarCRM ↔ PandaDoc</p>
      </div>
      
      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href} className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}>
                  <i className={`${item.icon} w-5 h-5 mr-3`}></i>
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      

    </aside>
  );
}
