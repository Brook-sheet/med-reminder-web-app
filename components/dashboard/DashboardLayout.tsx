import StatCard from './StatCard';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back, John!</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">Heres your medication status for today</p>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Adherence Rate"
            value={<span className="text-white dark:text-white">85%</span>}
            subtitle="This month"
            className="border-l-4 border-blue-500 bg-blue-600 dark:bg-blue-700 text-white"
          />
          <StatCard
            title="Today's Progress"
            value={<span className="text-white dark:text-white">1/4</span>}
            subtitle="medicines taken"
            className="bg-gray-700 dark:bg-gray-700 text-white"
          />
          <StatCard
            title="Next Reminder"
            value={<span className="text-white dark:text-white">2:00 PM</span>}
            subtitle={<span className="text-white dark:text-white">Aspirin 100mg</span>}
            className="bg-gray-700 dark:bg-gray-700 text-white"
          />
        </div>
      </div>
    </div>
  );
}


