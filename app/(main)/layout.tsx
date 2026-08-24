import Navbar from "@/components/navbar";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationManager from "@/components/notifications/NotificationManager";
import AlertBell from "@/components/alerts/AlertBell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar role={user.role} />

      <main className="flex-1 overflow-y-auto px-4 pb-8 md:ml-72">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.1),transparent_18%)] pt-6">
          {children}
        </div>
      </main>

      {user.role === "patient" && (
        <NotificationManager />
      )}

      {user.role === "patient" && (
        <NotificationBell />
      )}

      {user.role === "family" && (
        <AlertBell />
      )}
    </div>
  );
}