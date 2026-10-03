export type TourRole = "patient" | "family";

export type TourStatus =
  | "not_started"
  | "skipped"
  | "completed";

export type TourId =
  | "general"
  | "dashboard"
  | "medicines"
  | "chats"
  | "history"
  | "monitoring"
  | "reports"
  | "account"
  | "profile"
  | "settings";

export interface TourStep {
  id: string;
  route: string;
  title: string;
  description: string;
  target:
    | { selector: string }
    | { heading: string; container?: string }
    | {
        text: string;
        selector: string;
        container?: string;
      };
  optional?: boolean;
  openAccount?: boolean;
}

export const homeFor = (role: TourRole) =>
  role === "family" ? "/monitor" : "/";

export const welcomeFor = (role: TourRole) =>
  role === "family"
    ? "Take a quick tour to learn where to monitor patients, find alerts, chat, and manage your account. Detailed page tours are available anytime in Settings."
    : "Take a quick tour to find your dashboard, medicines, chats, history, and account options. Detailed page tours are available anytime in Settings.";

const labels: Record<TourId, string> = {
  general: "General Application",
  dashboard: "Dashboard",
  medicines: "Medicines",
  chats: "Chats",
  history: "History",
  monitoring: "Patient Monitoring",
  reports: "Patient Reports",
  account: "Account Menu",
  profile: "Profile",
  settings: "Settings",
};

export function availableTours(
  role: TourRole,
): Array<{ id: TourId; label: string }> {
  const ids: TourId[] =
    role === "patient"
      ? [
          "general",
          "dashboard",
          "medicines",
          "chats",
          "history",
          "account",
          "profile",
          "settings",
        ]
      : [
          "general",
          "monitoring",
          "reports",
          "chats",
          "account",
          "profile",
          "settings",
        ];

  return ids.map((id) => ({
    id,
    label: labels[id],
  }));
}

const heading = (
  heading: string,
  container?: string,
): TourStep["target"] => ({
  heading,
  container,
});

const selector = (
  selector: string,
): TourStep["target"] => ({
  selector,
});

const text = (
  text: string,
  selector = "button",
  container?: string,
): TourStep["target"] => ({
  text,
  selector,
  container,
});

const step = (
  id: string,
  route: string,
  title: string,
  description: string,
  target: TourStep["target"],
  optional = false,
): TourStep => ({
  id,
  route,
  title,
  description,
  target,
  optional,
});

export function buildTour(
  role: TourRole,
  patientId?: string,
  tour: TourId = "general",
): TourStep[] {
  if (
    !availableTours(role).some(
      (item) => item.id === tour,
    )
  ) {
    return [];
  }

  const home = homeFor(role);

  const account = (): TourStep => ({
    ...step(
      "account",
      home,
      "Account Menu",
      "The Account section contains Profile and Settings. Profile holds your personal information. Settings contains application preferences and guided tours.",
      selector(
        '.rx-drawer [role="group"][aria-label="Account"]',
      ),
    ),
    openAccount: true,
  });

  const profile = () =>
    step(
      "profile",
      "/profile",
      "Profile Information",
      role === "patient"
        ? "View or update your name and email. Your Patient ID can be copied for connections. Age and condition help personalize your account. Use Save Changes to save edits."
        : "View or update your name and email here. Use Save Changes to save edits. Your Family ID and patient connections are available under Patient Monitoring.",
      heading("Profile Information", "div.bg-card"),
    );

  const settings = () =>
    step(
      "settings",
      "/settings",
      "Settings and Walkthroughs",
      "Manage your preferences here. Take a Tour Again restarts the general introduction. Choose a page below it for a more detailed walkthrough.",
      selector('[data-tour="help"]'),
    );

  const chat = () =>
    step(
      "chats",
      "/chats",
      "Stay Connected",
      role === "patient"
        ? "Chat with your connected family members. Select a contact to open a conversation."
        : "Chat with your connected patients. Select a contact to open a conversation.",
      selector(".rx-chats"),
    );

  const monitoring = () =>
    step(
      "monitoring",
      "/monitor",
      "Patient Connections",
      "Request a connection using a Patient ID and wait for approval. Approved connections provide View Monitoring access. Pending or declined connections do not provide access to patient records.",
      heading("Patient Connections", "section"),
    );

  const overview = () =>
    step(
      "overview",
      "/",
      "Your Medication Dashboard",
      "See your adherence rate, today's progress, and next reminder. Values reflect the medication records available to your account.",
      selector(".rx-main .grid.md\\:grid-cols-3"),
    );

  const medicines = () =>
    step(
      "medicines",
      "/medicines",
      "My Medicines",
      "Manage medication names, dosage, schedules, duration, and notes here. This tour explains the controls without adding, editing, or deleting medicines.",
      heading("My Medicines"),
    );

  const history = () =>
    step(
      "history",
      "/history",
      "Medication History",
      "Review medication activity and verification records over a selected time range. Records show the system's status and verification information.",
      heading("History"),
    );

  if (tour === "general") {
    return [
      step(
        "navigation",
        home,
        "Application Navigation",
        "Use Main Menu to move between the features available to your role. On mobile, use the menu button to open the sidebar.",
        selector(".rx-drawer nav, .rx-mobile-topbar"),
      ),
      ...(role === "patient"
        ? [
            overview(),
            medicines(),
            chat(),
            history(),
          ]
        : [
            monitoring(),
            step(
              "alerts",
              "/alerts",
              "Medication Alerts",
              "Review medication notifications from your connected patients here.",
              selector(".rx-main h1"),
            ),
            chat(),
          ]),
      account(),
      profile(),
      settings(),
    ];
  }

  if (tour === "account") {
    return [
      account(),
      profile(),
      settings(),
    ];
  }

  if (tour === "dashboard") {
    return [
      overview(),
      step(
        "loading-order",
        "/",
        "Pillbox Loading Order",
        "Review which medicine and dose belongs in each chamber for today's plan. Check this section when preparing the physical pillbox.",
        heading(
          "Today's Rx Box Loading Order",
          "section, div.bg-card",
        ),
        true,
      ),
      step(
        "schedule",
        "/",
        "Today's Medication Schedule",
        "See today's medicines, scheduled times, notes when provided, and recorded statuses. Smart Pillbox events provide verification information; the tour does not confirm intake.",
        heading("Today's Schedule", "div.bg-card"),
      ),
      step(
        "upcoming",
        "/",
        "Upcoming Medications",
        "See upcoming medication times and details. Notes appear with a medicine when provided. The existing schedule button opens the wider upcoming schedule.",
        heading("Upcoming", "div.bg-card"),
      ),
      step(
        "analysis",
        "/",
        "Adherence Analysis",
        "Review adherence, completed and missed activity, delays, and the available trend chart. Insufficient Data means more completed activity is needed before reliable patterns can be shown.",
        heading("Adherence Analysis", "section"),
      ),
      step(
        "insights",
        "/",
        "Behavioral Insights",
        "Read the patterns identified from recorded medication activity. These explain observed behavior and risk indicators; they are not a diagnosis or a guarantee of future behavior.",
        heading("Behavioral Insights", "div"),
        true,
      ),
      step(
        "notifications",
        "/",
        "Medication Notifications",
        "Use this button to review your medication notifications. The tour does not mark them as read or trigger medication actions.",
        selector(".rx-notification-controls > div"),
      ),
    ];
  }

  if (tour === "medicines") {
    return [
      medicines(),
      step(
        "add",
        "/medicines",
        "Add a Medicine",
        "Add New Medicine opens the medication form. Enter the medicine details, dosage, scheduled times, duration, and any notes before saving. This tour does not open or submit the form.",
        text("Add New Medicine"),
      ),
      step(
        "sort",
        "/medicines",
        "Sort Your List",
        "Arrange medicines by recently added, oldest added, or alphabetical order using this control.",
        selector("#sort"),
      ),
      step(
        "details",
        "/medicines",
        "Medication Details",
        "Each card shows a medicine's name and dosage, followed by its schedule and other saved details. Add your first medicine to see a card here.",
        selector(
          '.rx-main div.bg-card:has(button[aria-label^="Edit "])',
        ),
        true,
      ),
      step(
        "frequency",
        "/medicines",
        "Medication Frequency",
        "This field shows how often this medicine is scheduled.",
        text("Frequency", "p", "div"),
        true,
      ),
      step(
        "times",
        "/medicines",
        "Scheduled Times",
        "These time labels show when the medicine is scheduled. Review them when checking your daily medication plan.",
        text("Scheduled Times", "p", "div"),
        true,
      ),
      step(
        "dose",
        "/medicines",
        "Pills per Dose",
        "Check the number of pills assigned to each scheduled dose here.",
        text(
          "Pills per Scheduled Dose",
          "p",
          "div",
        ),
        true,
      ),
      step(
        "notes",
        "/medicines",
        "Instructions and Notes",
        "Saved instructions and notes appear here when provided for a medicine.",
        text("Notes", "p", "div"),
        true,
      ),
      step(
        "duration",
        "/medicines",
        "Medication Duration",
        "Check the saved start and end dates for the medication schedule.",
        text("Duration", "p", "div"),
        true,
      ),
      step(
        "edit",
        "/medicines",
        "Manage a Medicine",
        "Use the pencil button to edit this medicine. The nearby delete button asks for confirmation before removing it. Neither action is performed during the tour.",
        selector(
          '.rx-main button[aria-label^="Edit "]',
        ),
        true,
      ),
    ];
  }

  if (tour === "history") {
    return [
      history(),
      step(
        "range",
        "/history",
        "Date Range",
        "Choose an available time range to review past activity. Custom lets you select From and To dates.",
        selector(
          ".rx-main div.rounded-\\[20px\\]:has(button)",
        ),
      ),
      step(
        "summary",
        "/history",
        "Historical Summary",
        "Compare adherence, verified doses, missed doses, and verification issues. The cards distinguish on-time and late activity; the adherence card explains its scoring.",
        selector(
          ".rx-main .grid.xl\\:grid-cols-4",
        ),
      ),
      step(
        "performance",
        "/history",
        "Medication Performance",
        "Compare the available adherence and activity statistics for each medicine in the selected range.",
        heading("Medication Performance", "section"),
      ),
      step(
        "activity",
        "/history",
        "Medication Activity",
        "Review records grouped by date. Statuses distinguish taken, late, missed, pending, upcoming, wrong-chamber, and unverified activity where applicable.",
        heading("Medication Activity", "section"),
      ),
      step(
        "record",
        "/history",
        "Record Details and Verification",
        "A record shows the medicine, dosage, scheduled and actual time, status, chamber details, and verification method. System verification notes and annotations appear when available.",
        selector(".rx-main .border-l-4"),
        true,
      ),
    ];
  }

  if (tour === "chats") {
    return [
      chat(),
      step(
        "contacts",
        "/chats",
        "Connect with a Contact",
        role === "patient"
          ? "Use Add Family to find a family member by Family ID and begin the existing contact request flow."
          : "Use Add Patient to find a patient by Patient ID and begin the existing contact request flow.",
        text(
          role === "patient"
            ? "Add Family"
            : "Add Patient",
        ),
      ),
      step(
        "conversations",
        "/chats",
        "Conversation List",
        "Your conversations appear here. Select a contact to read and send messages. This walkthrough does not open a conversation or change sent/read status.",
        selector(".rx-chat-panes > div"),
      ),
    ];
  }

  if (tour === "profile") {
    return [
      profile(),
      step(
        "name",
        "/profile",
        "Personal Information",
        "Edit your first, middle, and last name using these fields.",
        selector("#firstName"),
      ),
      step(
        "email",
        "/profile",
        "Account Email",
        "View your account email in this field. Use the controls available on the page when updating your account information.",
        selector("#email"),
      ),
      ...(role === "patient"
        ? [
            step(
              "patient-id",
              "/profile",
              "Your Patient ID",
              "Copy this identifier when connecting with a family member. Copying does not change your account.",
              selector('[aria-label="Patient ID"]'),
            ),
            step(
              "age",
              "/profile",
              "Age",
              "View or update your saved age here.",
              selector("#age"),
            ),
            step(
              "condition",
              "/profile",
              "Condition",
              "View or update the condition saved in your profile.",
              selector("#condition"),
            ),
          ]
        : []),
      step(
        "save",
        "/profile",
        "Save Profile Changes",
        "Use Save Changes after editing your profile. The tour does not change or save any fields.",
        text("Save Changes"),
      ),
      step(
        "password",
        "/profile",
        "Update Password",
        "This button opens the existing password update dialog. No password action is performed by the tour.",
        text("Update Password"),
      ),
      step(
        "delete",
        "/profile",
        "Account Removal",
        "Delete Account opens a confirmation flow. It is a separate account action and is never activated by this walkthrough.",
        text("Delete Account"),
      ),
    ];
  }

  if (tour === "settings") {
    return [
      step(
        "appearance",
        "/settings",
        "Appearance",
        "Switch between Light, Dark, and System using the theme control.",
        heading("Appearance", "div.bg-card"),
      ),
      ...(role === "patient"
        ? [
            step(
              "family-access",
              "/settings",
              "Family Monitoring Access",
              "Review monitoring requests and connected family members. Approval and access-removal actions remain under your control.",
              selector("#family-monitoring"),
              true,
            ),
          ]
        : [
            step(
              "sms",
              "/settings",
              "Family SMS Alerts",
              "Review your SMS phone number, consent, and alert preference here. Saving preferences or sending a test SMS requires your own action.",
              heading(
                "Family SMS Alerts",
                "div.bg-white",
              ),
              true,
            ),
          ]),
      step(
        "push",
        "/settings",
        "Browser Notifications",
        "Review browser notification support and permission here. Available controls depend on your browser. The tour never requests permission automatically.",
        {
          text:
            "Browser Push Notifications|Push Notifications",
          selector: "h2",
          container: "div.bg-card, div.bg-white",
        },
      ),
      settings(),
      step(
        "reset",
        "/settings",
        "Reset Data",
        "This section contains the existing reset action and confirmation. Read its explanation before using it. The tour does not reset any data.",
        heading(
          "Reset Data",
          "div.bg-white, div.bg-card",
        ),
      ),
    ];
  }

  if (tour === "monitoring") {
    return [
      step(
        "monitor-overview",
        "/monitor",
        "Patient Monitoring",
        "Manage patient connections and open approved monitoring dashboards here.",
        heading("Patient Monitoring"),
      ),
      monitoring(),
      step(
        "monitor-open",
        "/monitor",
        "Open an Approved Dashboard",
        "View Monitoring opens this patient's medication status and behavioral information. A View Report link on that dashboard opens the patient's report.",
        text("View Monitoring"),
        true,
      ),
      ...(patientId
        ? [
            step(
              "patient-status",
              `/monitor/${encodeURIComponent(patientId)}`,
              "Patient Medication Status",
              "Review the connected patient's verified, missed, late, wrong-chamber, and adherence summaries. Medication statuses are read-only.",
              heading(
                "Today's Medication Status",
                "section",
              ),
            ),
            step(
              "patient-behavior",
              `/monitor/${encodeURIComponent(patientId)}`,
              "Patient Medication Behavior",
              "Review available adherence trends, detected patterns, and risk reasons. The page explains when there is insufficient completed activity for analysis.",
              heading(
                "Behavioral Adherence Analysis",
                "section",
              ),
            ),
            step(
              "patient-logs",
              `/monitor/${encodeURIComponent(patientId)}`,
              "Recent Medication Logs",
              "Review recent medication statuses, verification details, and notes. Acknowledgment records a family response without changing the medication status; the tour never acknowledges a record.",
              heading(
                "Recent Medication Logs",
                "section",
              ),
            ),
          ]
        : []),
    ];
  }

  if (tour === "reports" && patientId) {
    const route =
      `/reports/medication?patientID=${encodeURIComponent(patientId)}`;

    return [
      step(
        "report",
        route,
        "Patient Report",
        "Review the connected patient's report. Access remains subject to the patient's monitoring approval.",
        selector("#medication-report > header"),
      ),
      step(
        "regimen",
        route,
        "Medication Regimen",
        "Review the patient's recorded medicines, dosage, scheduled times, duration, and notes.",
        heading("Medication Regimen", "section"),
      ),
      step(
        "summary",
        route,
        "Adherence Summary",
        "Review the report's adherence and medication activity totals for its selected period.",
        heading("Adherence Summary", "section"),
      ),
      step(
        "activity",
        route,
        "Medication Activity and Verification",
        "Review scheduled activity, final statuses, verification times and sources, and available notes. These records are read-only here.",
        heading(
          "Detailed Medication Activity",
          "section",
        ),
      ),
      step(
        "behavior",
        route,
        "Behavioral Analysis",
        "Read the available patterns and trends based on completed activity. Insufficient Data means there is not enough activity for reliable analysis.",
        heading(
          "Behavioral Adherence Analysis",
          "section",
        ),
      ),
    ];
  }

  return [];
}

const normalize = (value: string) =>
  value.replace(/\s+/g, " ").trim();

export function findTourTarget(
  step: TourStep,
): HTMLElement | null {
  const target = step.target;

  const candidates =
    "heading" in target
      ? Array.from(
          document.querySelectorAll<HTMLElement>(
            ".rx-main h1, .rx-main h2, .rx-main h3",
          ),
        ).filter(
          (node) =>
            normalize(node.textContent ?? "") ===
            target.heading,
        )
      : Array.from(
          document.querySelectorAll<HTMLElement>(
            target.selector,
          ),
        ).filter(
          (node) =>
            !("text" in target) ||
            target.text
              .split("|")
              .includes(
                normalize(node.textContent ?? ""),
              ),
        );

  return (
    candidates
      .map((node) =>
        "container" in target && target.container
          ? node.closest<HTMLElement>(
              target.container,
            ) ?? node
          : node,
      )
      .find((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 8 &&
          rect.left < innerWidth - 8 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }) ?? null
  );
}