// app/(main)/layout.tsx
import Navbar from "@/components/navbar";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationManager from "@/components/notifications/NotificationManager";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Navbar />
      {/* Offset for fixed sidebar on md+ screens */}
      <main className="flex-1 overflow-y-auto md:ml-64">
        {children}
      </main>

      {/* ── Notification system ── */}
      {/* NotificationManager handles popup notifications (upcoming, due, intake) */}
      <NotificationManager />

      {/* NotificationBell is the floating bell with history panel (always visible) */}
      <NotificationBell />
    </div>
  );
}