export type Audience = "STAFF" | "TEACHER" | "STUDENT";
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type ResourceType = "BOOK" | "BLOG" | "NOTES" | "LINK";

export type Me = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  role: { id: string; name: string; slug: string; audience: Audience; isSuperAdmin: boolean; allClasses: boolean; isActive: boolean } | null;
  isSuperAdmin: boolean;
  unrestricted: boolean;
  permissions: string[];
  classIds: string[] | null;
  classSubjectIds: string[] | null;
};

export type ClassSubjectLabel = { id: string; classGroup: { id: string; name: string }; subject: { id: string; name: string } };

export type ClassSubjectOption = {
  id: string;
  label: string;
  class: { id: string; name: string; grade: number | null };
  subject: { id: string; name: string };
  topics: { id: string; name: string }[];
};

export type PermissionGroup = { page: string; permissions: { key: string; label: string; description: string }[] };

export type ScopeEntry = { classId: string; className?: string; allSubjects: boolean; classSubjectIds: string[]; subjectNames?: string[] };

export type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  audience: Audience;
  isSuperAdmin: boolean;
  isActive: boolean;
  allClasses: boolean;
  members: number;
  permissions: string[];
  scope: ScopeEntry[];
  createdAt: string;
  updatedAt: string;
  users?: { id: string; name: string; email: string; status: AccountStatus }[];
};

export type RoleEvent = {
  id: string;
  roleId: string | null;
  roleName: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string } | null;
  targetUser?: { name: string; email: string } | null;
};

export type ScopeTreeClass = { id: string; name: string; grade: number | null; subjects: { classSubjectId: string; subjectId: string; name: string }[] };

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  createdAt: string;
  role: { id: string; name: string; audience: Audience; isSuperAdmin: boolean } | null;
};

export type Resource = {
  id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  url: string | null;
  author: string | null;
  content?: string | null;
  createdAt: string;
  classSubject: ClassSubjectLabel | null;
  topic: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

export type Video = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  createdAt: string;
  classSubject: ClassSubjectLabel;
  topic: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

export type Paper = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  isPublished: boolean;
  createdAt: string;
  classSubject: ClassSubjectLabel;
  createdBy: { id: string; name: string } | null;
  questions: number;
  attempts: number;
  myLatest: { attemptId: string; percentage: number; tries: number } | null;
};

export type Question = {
  id: string;
  prompt: string;
  options: string[];
  marks: number;
  order: number;
  topic: { id: string; name: string } | null;
  correctIndex?: number;
  explanation?: string | null;
};

export type TopicStat = {
  key: string;
  topicId: string | null;
  topic: string;
  classSubjectId: string;
  subject: string;
  className: string;
  correct: number;
  total: number;
  marksScored: number;
  marksTotal: number;
  accuracy: number;
  level: "weak" | "average" | "strong";
};

export type Recommendation = {
  video: { id: string; title: string; url: string; description: string | null; topic: { name: string } | null; classSubject: { subject: { name: string }; classGroup: { name: string } } };
  reason: string;
  topic: string;
  accuracy: number;
  match: "topic" | "subject";
};

export type StudentAnalysis = {
  summary: { testsTaken: number; papersCovered: number; averagePercentage: number | null; weakTopics: number };
  topics: TopicStat[];
  subjects: { classSubjectId: string; subject: string; className: string; percentage: number }[];
  trend: { attemptId: string; paper: string; subject: string; percentage: number; submittedAt: string }[];
  insights: string[];
  recommendations: Recommendation[];
};

export type Instruction = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  classGroup: { id: string; name: string } | null;
  createdBy: { name: string } | null;
};
