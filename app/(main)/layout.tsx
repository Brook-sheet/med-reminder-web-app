// app/(main)/layout.tsx
import Navbar from "@/components/navbar";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationManager from "@/components/notifications/NotificationManager";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      {/* Offset for fixed sidebar on md+ screens */}
      <main className="flex-1 overflow-y-auto md:ml-72 px-4 pb-8">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.1),transparent_18%)] pt-6">
          {children}
        </div>
      </main>

      {/* ── Notification system ── */}
      {/* NotificationManager handles popup notifications (upcoming, due, intake) */}
      <NotificationManager />

      {/* NotificationBell is the floating bell with history panel (always visible) */}
      <NotificationBell />
    </div>
  );
}