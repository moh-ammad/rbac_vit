// The catalogue of things a role can be allowed to do.
//
// These keys are tied to pages and API routes that exist in code, so the list
// itself lives in code. WHICH role gets WHICH key is stored in the database
// (RolePermission) and managed from the Settings page — nothing about roles is
// hardcoded.

export const PERMISSION_GROUPS = [
  {
    page: "Classes",
    permissions: [
      { key: "classes.view", label: "View classes", description: "See classes, subjects, topics, teachers and students in scope" },
      { key: "classes.manage", label: "Manage classes", description: "Create/edit classes, subjects and topics" },
    ],
  },
  {
    page: "Resources",
    permissions: [
      { key: "resources.view", label: "View resources", description: "Browse and search books, blogs and notes" },
      { key: "resources.manage", label: "Manage resources", description: "Add, edit and delete resources" },
    ],
  },
  {
    page: "Videos",
    permissions: [
      { key: "videos.view", label: "View videos", description: "Watch video lessons" },
      { key: "videos.manage", label: "Manage videos", description: "Add, edit and delete videos" },
    ],
  },
  {
    page: "Question papers",
    permissions: [
      { key: "papers.view", label: "View question papers", description: "See published papers in scope" },
      { key: "papers.manage", label: "Manage question papers", description: "Create papers, questions and publish tests" },
      { key: "papers.attempt", label: "Take tests", description: "Attempt published papers and see own analysis" },
      { key: "results.view", label: "View results", description: "See student results and class analysis" },
    ],
  },
  {
    page: "Instructions",
    permissions: [
      { key: "instructions.view", label: "View instructions", description: "Read notices and guidelines" },
      { key: "instructions.manage", label: "Manage instructions", description: "Post, edit and delete instructions" },
    ],
  },
  {
    page: "School",
    permissions: [
      { key: "school.view", label: "View school", description: "School profile and statistics" },
      { key: "school.manage", label: "Edit school profile", description: "Update school details" },
    ],
  },
  {
    page: "Users",
    permissions: [
      { key: "users.view", label: "View users", description: "See users in scope" },
      { key: "users.manage", label: "Manage users", description: "Create users, assign roles, suspend, delete" },
    ],
  },
  {
    page: "Settings",
    permissions: [
      { key: "roles.manage", label: "Manage roles", description: "Create roles, set permissions and class/subject access" },
    ],
  },
] as const;

export type PermissionKey = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => p.key));

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
