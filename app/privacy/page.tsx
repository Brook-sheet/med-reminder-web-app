import type { Metadata } from "next";
import LegalPage, {
  LegalSection,
  SUPPORT_EMAIL,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Rx Box: Smart Pillbox collects, uses, stores, and shares information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains how Rx Box: Smart Pillbox handles information when you create an account and use its medication reminder and monitoring features."
    >
      <LegalSection title="1. About Rx Box">
        <p>
          Rx Box: Smart Pillbox is a medication reminder and monitoring project
          developed by the Rx Box team. It supports medication scheduling,
          intake records, adherence analysis, food monitoring, and approved
          family monitoring.
        </p>
        <p>
          This policy covers information handled through the Rx Box application
          and its connected features.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Account information such as your name, email address, account role,
            and authentication information. Passwords for email accounts are
            stored as hashes rather than plain text.
          </li>
          <li>
            Profile information you provide, such as your age and health
            condition.
          </li>
          <li>
            Medication names, schedules, instructions, intake records, and
            reminder responses.
          </li>
          <li>
            Food entries and information used to produce food and adherence
            risk estimates.
          </li>
          <li>
            Family monitoring requests, approvals, conversations, messages, and
            attachments you choose to send.
          </li>
          <li>
            Notification preferences, browser push subscriptions, device
            notification tokens, and your phone number when you enable SMS.
          </li>
          <li>
            Connected pillbox events, including dispensing, pickup detection,
            missed events, and device status.
          </li>
          <li>
            Technical information processed during operation, such as request
            metadata, timestamps, delivery records, and error logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Sign in with Google">
        <p>
          When you choose Sign in with Google, Rx Box requests the openid,
          email, and profile permissions. We use your Google account identifier,
          verified email address, and name to create or identify your Rx Box
          account and authenticate your sign-in.
        </p>
        <p>
          Google authentication tokens are processed to validate your identity.
          Rx Box does not receive your Google password. The current sign-in
          integration does not request access to Gmail messages, Google Drive
          files, Google Calendar, or Google Contacts.
        </p>
        <p>
          Google account information is used for authentication and account
          management. It is not used for advertising or to train adherence or
          food risk models.
        </p>
        <p>
          Rx Box&apos;s use and transfer of information received from Google APIs
          will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="font-medium text-sky-700 underline underline-offset-4"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="4. How information is used">
        <ul className="list-disc space-y-2 pl-5">
          <li>Create accounts, authenticate users, and manage profiles.</li>
          <li>Maintain medication schedules and intake history.</li>
          <li>Deliver reminders, account emails, and selected notifications.</li>
          <li>Calculate and display adherence and food risk estimates.</li>
          <li>Provide monitoring access to family members you approve.</li>
          <li>Support messages between connected users.</li>
          <li>Investigate errors and maintain application operation.</li>
        </ul>
        <p>
          Risk estimates are informational. They are not a medical diagnosis
          and do not replace advice from a qualified healthcare professional.
        </p>
      </LegalSection>

      <LegalSection title="5. Family monitoring and sharing">
        <p>
          Approved family accounts can access the patient information made
          available through the monitoring features, including medication
          schedules, intake status, reports, and risk information. Patients can
          manage monitoring approvals and remove access using the application.
        </p>
        <p>
          Messages and attachments are shared with their intended recipients.
          Removing monitoring access does not erase information someone has
          already viewed, downloaded, or received.
        </p>
        <p>
          Rx Box does not sell your personal information or use Google account
          information for targeted advertising.
        </p>
      </LegalSection>

      <LegalSection title="6. Services that process information">
        <p>
          Rx Box uses Vercel for web hosting and MongoDB Atlas for application
          storage. Google processes Google sign-in requests. Configured email
          services process verification and password reset emails.
        </p>
        <p>
          When enabled, notification services process the information required
          to deliver notifications. This can include browser push services,
          Expo for supported mobile notifications, and TextBee and mobile
          carriers for SMS delivery.
        </p>
        <p>
          Providers receive information needed for their function. SMS messages
          may include medication names, scheduled times, and intake status.
          Notification content may be visible on a device&apos;s lock screen.
        </p>
        <p>
          Service providers may process information in countries outside your
          country of residence under their own privacy and security practices.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies and local storage">
        <p>
          Rx Box uses authentication cookies to maintain your session and
          temporary cookies to protect the Google sign-in process. Your browser
          may also store interface preferences and application resources.
        </p>
        <p>
          Blocking authentication cookies can prevent sign-in from working.
          Browser notification permission can be managed through your browser
          settings.
        </p>
      </LegalSection>

      <LegalSection title="8. Storage, security, and retention">
        <p>
          Account and application records are stored in the application database.
          Rx Box uses authentication and access controls to restrict protected
          features. No internet service or storage system can guarantee complete
          security.
        </p>
        <p>
          Account information and application records are retained while needed
          to provide the service. The account deletion feature removes your user
          record and the medication, food, sensor, notification, subscription,
          and alert records covered by that feature.
        </p>
        <p>
          Deletion does not automatically erase shared conversations, messages,
          attachments, delivery records, or copies already received by others.
          Contact the team if you need help with additional data removal.
        </p>
      </LegalSection>

      <LegalSection title="9. Your choices and requests">
        <p>
          You can update available profile fields, change notification
          preferences, manage approved monitoring access, and use the account
          deletion feature in the application.
        </p>
        <p>
          You can also remove Rx Box&apos;s Google connection through your Google
          account settings. Removing that connection does not itself delete
          your Rx Box account or its stored records.
        </p>
        <p>
          To request access, correction, or deletion of information, contact{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="break-all font-medium text-sky-700 underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          . We may need to verify your identity before handling a request. Do
          not send passwords or authentication codes.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes and contact">
        <p>
          We may update this policy when application features or data practices
          change. The date at the top identifies the latest revision.
        </p>
        <p>
          For privacy questions, contact the Rx Box team at{" "}
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