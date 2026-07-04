import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, isPositive, icon, color }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
          {change && (
            <p className={`text-xs font-medium mt-2 flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <span className="mr-1">{isPositive ? '↑' : '↓'}</span>
              {change} from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-white`}>
           <div style={{ color: color.replace('bg-', 'text-').replace('-500', '-600') }}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
