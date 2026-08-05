import PatientIdSection from "@/components/profile/PatientIdSection";

export default function MonitorPage() {
  return (
    <div className="min-h-full bg-background p-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Patient Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage patient connections and view monitoring dashboards in read-only mode.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-card p-6 rounded-[28px] shadow-sm border border-border/80">
            <PatientIdSection />
          </div>
        </div>
      </div>
    </div>
  );
}
