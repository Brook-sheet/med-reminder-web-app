import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  LegalSection,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "About Rx Box",
  description:
    "Rx Box: Smart Pillbox supports medication reminders, intake tracking, adherence analysis, and approved family monitoring.",
};

const features = [
  {
    title: "Medication schedules",
    description:
      "Manage medicines, scheduled times, and medication instructions.",
  },
  {
    title: "Reminders and intake history",
    description:
      "Receive selected reminders and review recorded medication events.",
  },
  {
    title: "Adherence and food monitoring",
    description:
      "Review intake patterns and informational risk estimates based on recorded data.",
  },
  {
    title: "Approved family monitoring",
    description:
      "Allow approved family members to view monitoring information and communicate through the app.",
  },
];

export default function AboutPage() {
  return (
    <LegalPage
      title="Support for your daily medication routine"
      description="Rx Box: Smart Pillbox combines medication scheduling, intake records, and connected pillbox features to support people managing maintenance medicines, including those with hypertension and diabetes."
      showUpdated={false}
    >
      <LegalSection title="What is Rx Box?">
        <p>
          Rx Box is a smart medication reminder and monitoring project. Patients
          can organize medication schedules and review intake history. Approved
          family members can follow monitoring information through their own
          accounts.
        </p>
      </LegalSection>

      <section aria-label="Application features">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5"
            >
              <h2 className="font-semibold text-slate-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <LegalSection title="Why we offer Google sign-in">
        <p>
          Google sign-in provides a convenient way to authenticate your Rx Box
          account. Rx Box uses your Google account identifier, verified email,
          and name for authentication and account management.
        </p>
        <p>
          The current integration requests only basic identity permissions. It
          does not request access to Gmail, Google Drive, Calendar, or Contacts.
          Read our{" "}
          <Link
            href="/privacy"
            className="font-medium text-sky-700 underline underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection title="Designed to support care">
        <p>
          Reminders and risk estimates support daily routines. They do not
          replace medical advice, prescriptions, or emergency care. Always
          follow instructions from your healthcare professional.
        </p>
      </LegalSection>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Create an account
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Sign in
        </Link>
      </div>
    </LegalPage>
  );
}