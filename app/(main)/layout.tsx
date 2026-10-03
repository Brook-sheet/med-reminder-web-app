import {
  ProductTourProvider,
  TourNotificationManager,
} from "@/components/onboarding/ProductTourProvider";
import Navbar from "@/components/navbar";
import NotificationBell from "@/components/notifications/NotificationBell";
import AlertBell from "@/components/alerts/AlertBell";
import { getCurrentUser } from "@/lib/auth";
import PageTransition from "@/components/ui/PageTransition";
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
    <ProductTourProvider
      key={`${user.userId}:${user.role}`}
      userId={user.userId}
      role={user.role}
    >
      <div className="rx-shell flex min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar role={user.role} />

        <main className="rx-main flex-1 overflow-y-auto px-4 pb-8 md:ml-72">
          <div className="rx-page min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.1),transparent_18%)] pt-6">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>

        {user.role === "patient" && (
          <TourNotificationManager />
        )}

        <div className="rx-notification-controls contents">
          {user.role === "patient" && (
            <NotificationBell />
          )}

          {user.role === "family" && (
            <AlertBell />
          )}
        </div>
      </div>
    </ProductTourProvider>
  );
}