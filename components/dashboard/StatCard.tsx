import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string | ReactNode;
  className?: string;
}

export default function StatCard({ title, value, subtitle, className }: StatCardProps) {
  const hasCustomBg = className?.includes('bg-');
  const baseClasses = hasCustomBg ? '' : 'bg-white dark:bg-gray-800';
  const titleColor = className?.includes('text-white') ? 'text-white' : 'text-gray-600 dark:text-white';
  const subtitleColor = className?.includes('text-white') ? 'text-white' : 'text-gray-700 dark:text-gray-300';
  
  return (
    <div className={`${baseClasses} rounded-lg shadow-sm p-6 ${className || ''}`}>
      <h3 className={`text-sm font-medium ${titleColor}`}>{title}</h3>
      <div className="mt-2">
        <div className="text-3xl font-bold text-black dark:text-white">{value}</div>
        {subtitle && <p className={`text-sm ${subtitleColor} mt-1`}>{subtitle}</p>}
      </div>
    </div>
  );
}
