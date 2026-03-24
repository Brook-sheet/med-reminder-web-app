import StatCard from '@/components/dashboard/StatCard';
import ScheduleList from '@/components/dashboard/Schedule/ScheduleList';
import WeeklyAdherence from '@/components/dashboard/weekly/WeeklyAdherence';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back, Ace!</h1>
          <p className="text-lg text-gray-600 mt-2">Heres your medication status for today</p>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Adherence Rate"
            value={<span className="text-blue-600">0%</span>}
            subtitle="This month"
            className="border-l-4 border-blue-500"
          />
          <StatCard
            title="Today's Progress"
            value="0/4"
            subtitle="medicines taken"
          />
          <StatCard
            title="Next Reminder"
            value="2:00 PM"
            subtitle="Aspirin 100mg"
            className="bg-orange-50 border-orange-200"
          />
        </div>

        {/* Today's Schedule Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Todays Schedule</h2>
          <ScheduleList />
        </div>

        {/* Weekly Adherence Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Weekly Adherence</h2>
          <WeeklyAdherence />
        </div>
      </div>
    </div>
  );
}