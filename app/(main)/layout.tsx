// app/(main)/layout.tsx
import Navbar from "@/components/navbar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Navbar />
      {/* Offset for fixed sidebar on md+ screens */}
      <main className="flex-1 overflow-y-auto md:ml-64">
        {children}
      </main>
    </div>
  );
}
