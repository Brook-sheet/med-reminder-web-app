import ProfileCard from "@/components/dashboard/settings/ProfileCard";

export default function ProfilePage() {
  return (
    <div className="min-h-full bg-background p-6 pb-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Profile
          </h1>

          <p className="mt-1 text-gray-600 dark:text-gray-300">
            View and manage your profile information and account settings
          </p>
        </div>

        <div className="space-y-4">
          <ProfileCard />
        </div>
      </div>
    </div>
  );
}