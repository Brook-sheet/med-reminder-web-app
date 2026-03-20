import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string;
  className?: string;
}

export default function StatCard({ title, value, subtitle, className }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className || ''}`}>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
