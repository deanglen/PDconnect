import { Link, useLocation } from "wouter";

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'fas fa-tachometer-alt' },
  { name: 'Tenant Config', href: '/tenants', icon: 'fas fa-building' },
  { name: 'Field Mappings', href: '/mappings', icon: 'fas fa-arrows-alt-h' },
  { name: 'Workflows', href: '/workflows', icon: 'fas fa-project-diagram' },
  { name: 'Token Explorer', href: '/tokens', icon: 'fas fa-tags' },
  { name: 'Webhook Logs', href: '/webhooks', icon: 'fas fa-exchange-alt' },
];

export function Sidebar({ className = "" }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside className={`w-60 bg-white shadow-lg border-r border-gray-200 ${className}`}>
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
                <Link href={item.href}>
                  <a className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                    <i className={`${item.icon} w-5 h-5 mr-3`}></i>
                    {item.name}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
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
    </aside>
  );
}
