import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  LegalSection,
  SUPPORT_EMAIL,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Rx Box: Smart Pillbox.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms explain the responsibilities and limitations that apply when using Rx Box: Smart Pillbox."
    >
      <LegalSection title="1. Using Rx Box">
        <p>
          These terms apply to Rx Box: Smart Pillbox, operated by the Rx Box
          project team. By using the application, you agree to these terms.
          If you do not agree, discontinue use.
        </p>
        <p>
          Information handling is described in our{" "}
          <Link
            href="/privacy"
            className="font-medium text-sky-700 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Purpose of the application">
        <p>
          Rx Box supports medication reminders, schedule management, intake
          recording, adherence analysis, food monitoring, and approved family
          monitoring. Connected pillbox features can provide dispensing and
          sensor events.
        </p>
        <p>
          Rx Box is a project application. Its features support daily medication
          routines but do not provide a clinical diagnosis or guarantee a
          treatment outcome.
        </p>
      </LegalSection>

      <LegalSection title="3. Medical limitations">
        <p>
          Rx Box does not replace a doctor, pharmacist, prescription, or emergency
          service. Follow the medication instructions provided by your healthcare
          professional.
        </p>
        <p>
          Do not start, stop, change, or repeat a dose solely because of an app
          notification, intake record, sensor event, or risk estimate. Ask a
          qualified healthcare professional when medication instructions are
          unclear.
        </p>
        <p>
          Sensor detection and manual confirmation record an event. They do not
          independently prove that medication was swallowed. Adherence and food
          risk estimates may be incomplete or inaccurate.
        </p>
        <p>
          For urgent medical concerns, contact an appropriate healthcare or
          emergency service.
        </p>
      </LegalSection>

      <LegalSection title="4. Account responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate account and profile information.</li>
          <li>Keep passwords and authentication codes private.</li>
          <li>Use an account and role you are authorized to use.</li>
          <li>Sign out on shared devices.</li>
          <li>Report suspected unauthorized access to the project team.</li>
        </ul>
        <p>
          Google sign-in authenticates your identity. It does not confirm your
          medication information or authorize access to another person&apos;s
          records.
        </p>
      </LegalSection>

      <LegalSection title="5. Medication schedules and hardware">
        <p>
          You are responsible for checking medication names, doses, schedule
          times, and instructions against your prescription. Check the pillbox
          loading order and chamber capacity before using connected hardware.
        </p>
        <p>
          Hardware operation and reminders depend on factors such as power,
          connectivity, device configuration, browser permissions, and external
          delivery services. Keep an alternative way to follow your medication
          schedule when the system is unavailable.
        </p>
      </LegalSection>

      <LegalSection title="6. Family monitoring and messages">
        <p>
          Family monitoring requires the patient&apos;s approval. Only request
          access you are authorized to receive. Patients should review approvals
          and remove access when it is no longer appropriate.
        </p>
        <p>
          Treat another person&apos;s medication and health information as
          private. Do not share it without their permission. You are responsible
          for messages and attachments you send.
        </p>
        <p>
          Monitoring alerts and chat are not emergency communication services.
          Delivery and response are not guaranteed.
        </p>
      </LegalSection>

      <LegalSection title="7. Notifications">
        <p>
          Browser push, mobile notifications, email, and SMS depend on your
          selected preferences and the availability of delivery services.
          Notifications may be delayed, blocked, duplicated, or missed.
        </p>
        <p>
          SMS and other notifications may reveal medication information to
          anyone who can access your phone or notification screen. Review your
          device privacy settings. Standard carrier or data charges may apply.
        </p>
      </LegalSection>

      <LegalSection title="8. Acceptable use">
        <p>You must not use Rx Box to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Access accounts or patient information without authorization.</li>
          <li>Impersonate another person or submit misleading information.</li>
          <li>Harass users or send harmful or unlawful content.</li>
          <li>Upload malicious files or disrupt application operation.</li>
          <li>Bypass security controls or misuse connected hardware.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Availability and changes">
        <p>
          Features may change as the project develops. Maintenance, technical
          problems, and provider outages may affect availability. The team does
          not guarantee uninterrupted operation or error-free records and
          estimates.
        </p>
        <p>
          Access may be restricted when an account is used to harm others,
          compromise security, or violate these terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Account deletion">
        <p>
          You can stop using Rx Box and use its account deletion feature.
          Deletion removes the account and records covered by that feature.
          Shared messages and other retained records are explained in the
          Privacy Policy.
        </p>
        <p>
          Contact the project team if you cannot access your account or need
          assistance with a deletion request.
        </p>
      </LegalSection>

      <LegalSection title="11. Updates and contact">
        <p>
          These terms may be updated as the service changes. The date at the top
          identifies the latest revision. Nothing in these terms removes rights
          you have under applicable law.
        </p>
        <p>
          Questions can be sent to the Rx Box team at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="break-all font-medium text-sky-700 underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}