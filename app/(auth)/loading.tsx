import { PageLoader } from "@/components/ui/Loading";

/** Route-level loading for every page inside (auth). */
export default function AuthLoading() {
  return <PageLoader label="Preparing your account…" className="min-h-screen" />;
}