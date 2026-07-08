export type PageGuide = {
  key: string;
  section: "Requester workspace" | "Admin console" | "Account";
  href: string;
  title: string;
  description: string;
  steps: string[];
};

export const PAGE_GUIDES = [
  {
    key: "app-overview",
    section: "Requester workspace",
    href: "/app",
    title: "Overview",
    description: "Your bookings at a glance.",
    steps: [
      "Check the three summary tiles first: pending requests, accepted bookings, and total requests.",
      "Open Book a room when you need to search for an available classroom.",
      "Use Upcoming accepted bookings to jump into the details for your next confirmed reservation.",
    ],
  },
  {
    key: "find-room",
    section: "Requester workspace",
    href: "/app/search",
    title: "Book a room",
    description:
      "Search availability and book a room derived from the live timetable, approved bookings and maintenance.",
    steps: [
      "Choose the date and time window you want to reserve.",
      "Narrow the search with building, room type, capacity, and equipment only when those constraints matter.",
      "Submit the search, review the free intervals, then pick a slot to start a booking request.",
    ],
  },
  {
    key: "my-bookings",
    section: "Requester workspace",
    href: "/app/bookings",
    title: "My bookings",
    description: "Track the status of every request you've made.",
    steps: [
      "Use the status tabs to separate pending, accepted, rejected, and cancelled requests.",
      "Open a booking to inspect its timeline, room, date, and attendee details.",
      "Cancel a pending or accepted request when the room is no longer needed.",
    ],
  },
  {
    key: "app-calendar",
    section: "Requester workspace",
    href: "/app/calendar",
    title: "Calendar",
    description: "Lectures, approved bookings and maintenance, colour-coded by source.",
    steps: [
      "Select a building to load its timetable, bookings, maintenance, and available gaps.",
      "Switch between day, week, and month views depending on how much time you need to scan.",
      "Use the colour legend to tell lectures, bookings, maintenance, and available space apart.",
    ],
  },
  {
    key: "notifications",
    section: "Requester workspace",
    href: "/app/notifications",
    title: "Notifications",
    description: "Review booking updates, request decisions and system messages.",
    steps: [
      "Scan unread messages first; they are visually highlighted in the list.",
      "Open booking-related messages from newest to oldest so you do not miss request decisions.",
      "Mark individual messages or the full list as read once you have acted on them.",
    ],
  },
  {
    key: "admin-overview",
    section: "Admin console",
    href: "/admin",
    title: "Overview",
    description: "A role-aware overview of requests, utilisation and the next admin tasks.",
    steps: [
      "Start with the KPI tiles to spot requests, room coverage and utilisation movement.",
      "Use Quick actions for the common admin jobs your role can access.",
      "Review the pending queue first, then open reports for deeper utilisation details.",
    ],
  },
  {
    key: "approvals",
    section: "Admin console",
    href: "/admin/approvals",
    title: "Requests queue",
    description:
      "Each request shows exactly why it can or cannot be accepted, so you can resolve conflicts without guessing.",
    steps: [
      "Read each request card from top to bottom: room, requester, time, attendees, and reason.",
      "Use the decision panel to understand whether lectures, maintenance, capacity, or competing requests block acceptance.",
      "Accept clear requests, reject requests that cannot proceed, or use override only when your role and policy allow it.",
    ],
  },
  {
    key: "admin-calendar",
    section: "Admin console",
    href: "/admin/calendar",
    title: "Calendar",
    description:
      "A unified view of lectures, approved bookings and maintenance across buildings.",
    steps: [
      "Pick the building whose schedule you need to inspect.",
      "Compare lectures, approved bookings, maintenance, and available blocks in the same timeline.",
      "Change the calendar view or date to diagnose conflicts before approving or creating changes elsewhere.",
    ],
  },
  {
    key: "rooms",
    section: "Admin console",
    href: "/admin/rooms",
    title: "Rooms",
    description: "Manage the bookable room catalogue, capacity, type and equipment.",
    steps: [
      "Use the table to review room code, building, type, capacity, and active status.",
      "Create a new room when the catalogue is missing a bookable space.",
      "Edit or deactivate existing rooms when room details change or the space should stop accepting bookings.",
    ],
  },
  {
    key: "buildings",
    section: "Admin console",
    href: "/admin/buildings",
    title: "Buildings",
    description: "Campus buildings that contain bookable rooms.",
    steps: [
      "Review building code, name, and campus before adding rooms under that building.",
      "Create a building before adding any rooms that belong to it.",
      "Edit building records when naming, codes, or campus grouping changes.",
    ],
  },
  {
    key: "equipment",
    section: "Admin console",
    href: "/admin/equipment",
    title: "Equipment",
    description: "Equipment types that rooms can be fitted with.",
    steps: [
      "Check existing equipment codes before adding a new capability.",
      "Create equipment options that requesters should be able to filter by, such as projector or smart board.",
      "Edit equipment names or codes when the campus terminology changes.",
    ],
  },
  {
    key: "semesters",
    section: "Admin console",
    href: "/admin/semesters",
    title: "Semesters",
    description:
      "Create semesters and set the active one. Only the active semester affects availability.",
    steps: [
      "Create each semester with a clear name plus start and end dates.",
      "Activate the semester that should drive live availability and timetable imports.",
      "Archive old semesters when they should no longer affect room searches.",
    ],
  },
  {
    key: "timetable",
    section: "Admin console",
    href: "/admin/timetable",
    title: "Timetable import",
    description:
      "Upload the semester schedule from Excel or CSV. Replacing a timetable never touches existing bookings.",
    steps: [
      "Choose the target semester before selecting a timetable file.",
      "Use append to add rows, or replace when the semester timetable should be refreshed from the file.",
      "Watch the import progress and fix row-level errors before uploading another version.",
    ],
  },
  {
    key: "maintenance",
    section: "Admin console",
    href: "/admin/maintenance",
    title: "Maintenance windows",
    description:
      "Block rooms for maintenance. Blocked periods never appear as available and cannot be booked.",
    steps: [
      "Create a maintenance window for the exact room, date, and time range that should be unavailable.",
      "Add a reason that helps approvers and requesters understand the block.",
      "Remove a maintenance window only when the room is ready to become bookable again.",
    ],
  },
  {
    key: "users",
    section: "Admin console",
    href: "/admin/users",
    title: "Users",
    description: "Manage accounts, roles and access across the system.",
    steps: [
      "Invite users with their university email, full name, role, and department.",
      "Use Manage on a row to change roles, suspend accounts, or reactivate access.",
      "Confirm the department and role before saving because they control what the user can see and do.",
    ],
  },
  {
    key: "departments",
    section: "Admin console",
    href: "/admin/departments",
    title: "Departments",
    description: "Academic departments that users and courses belong to.",
    steps: [
      "Create departments before assigning users or imported timetable data to them.",
      "Keep department codes short and consistent with campus records.",
      "Edit a department when the display name, code, or faculty changes.",
    ],
  },
  {
    key: "reports",
    section: "Admin console",
    href: "/admin/reports",
    title: "Reports",
    description: "Utilisation, bookings and conflicts. Export large datasets to CSV, Excel or PDF.",
    steps: [
      "Set the date range first; every chart and table follows that window.",
      "Move between utilisation, bookings, and conflicts to answer different operational questions.",
      "Export the relevant report when you need to share or archive the data outside AURA.",
    ],
  },
  {
    key: "audit",
    section: "Admin console",
    href: "/admin/audit",
    title: "Audit log",
    description: "An append-only record of every state change. Read-only.",
    steps: [
      "Filter by entity type, such as booking or room, when you need to narrow the log.",
      "Read each row by timestamp, actor, action, entity, and IP address.",
      "Use the log for traceability only; operational changes happen on the relevant management page.",
    ],
  },
  {
    key: "profile",
    section: "Account",
    href: "/app/profile",
    title: "Profile",
    description: "Your AURA identity, department, and access details.",
    steps: [
      "Update your display name and department if your account details have changed.",
      "Review your email, role, status, and last sign-in details on the summary card.",
      "Use the access summary to understand which permissions are attached to your role.",
    ],
  },
  {
    key: "settings",
    section: "Account",
    href: "/app/settings",
    title: "Settings",
    description: "Account preferences, notifications, and security controls.",
    steps: [
      "Review account and security details before changing preferences.",
      "Enable multi-factor auth from Security, scan the QR code or add the setup secret, then verify the six-digit code.",
      "Update your password with your current password, a new password, and confirmation.",
      "Save browser preferences such as in-app alerts, guide behaviour, and compact tables.",
    ],
  },
] satisfies PageGuide[];

const DESCRIPTION_ALIASES: Record<string, string> = {
  "A role-aware overview of requests, utilisation and the next admin tasks.":
    "admin-overview",
  "Search availability and book a room derived from the live timetable, approved bookings and maintenance. All times are West Africa Time (Africa/Accra).":
    "find-room",
  "Lectures, approved bookings and maintenance, colour-coded by source. All times West Africa Time (Africa/Accra).":
    "app-calendar",
  "A unified view of lectures, approved bookings and maintenance across buildings. All times West Africa Time (Africa/Accra).":
    "admin-calendar",
  "Create semesters and set the active one. Only the active semester affects availability (BR2).":
    "semesters",
  "Equipment types that rooms can be fitted with (projector, smart board, audio, and so on).":
    "equipment",
};

export function getPageGuide({
  title,
  description,
}: {
  title: string;
  description?: string;
}): PageGuide {
  const alias = description ? DESCRIPTION_ALIASES[description] : undefined;
  if (alias) return PAGE_GUIDES.find((guide) => guide.key === alias)!;

  if (title === "Overview" && description?.startsWith("Welcome,")) {
    return PAGE_GUIDES.find((guide) => guide.key === "app-overview")!;
  }

  const exact = PAGE_GUIDES.find(
    (guide) => guide.title === title && guide.description === description,
  );
  if (exact) return exact;

  const byTitle = PAGE_GUIDES.find((guide) => guide.title === title);
  if (byTitle) return byTitle;

  return {
    key: "page",
    section: "Requester workspace",
    href: "#main",
    title,
    description: description ?? "Use this page to complete the current task.",
    steps: [
      "Read the page title and description to confirm you are in the right place.",
      "Use the filters, table actions, or primary action for the task shown on this page.",
      "Check any success or error message before moving to another page.",
    ],
  };
}

export function groupedPageGuides() {
  return PAGE_GUIDES.reduce<Record<PageGuide["section"], PageGuide[]>>(
    (groups, guide) => {
      groups[guide.section].push(guide);
      return groups;
    },
    {
      "Requester workspace": [],
      "Admin console": [],
      Account: [],
    },
  );
}
