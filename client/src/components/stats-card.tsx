import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  iconBg: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export function StatsCard({ title, value, change, icon, iconBg, changeType = 'positive' }: StatsCardProps) {
  const changeColor = changeType === 'positive' 
    ? 'text-green-600' 
    : changeType === 'negative' 
    ? 'text-red-600' 
    : 'text-gray-600';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {change && (
              <p className={`text-sm mt-1 ${changeColor}`}>
                {changeType === 'positive' && <i className="fas fa-arrow-up mr-1"></i>}
                {changeType === 'negative' && <i className="fas fa-arrow-down mr-1"></i>}
                {changeType === 'neutral' && <i className="fas fa-clock mr-1"></i>}
                <span>{change}</span>
              </p>
            )}
          </div>
          <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
