# Vitaran LMS — dynamic role-based learning management system

A school LMS where **only the Super Admin is seeded**. Every other role (Principal, Science Teacher, Physics Teacher, Class 5 Student…), class, subject, topic, resource, video, question paper and instruction is created from the UI and stored in PostgreSQL.

Each role gets two things:

1. **Page access.** This is which pages the role sees and what it may do there (view / manage / take tests / view results).
2. **Class & subject access.** This is a nested checkbox tree, Class ▸ Subjects, that limits everything the role sees.

Students take tests. Their answers are analysed topic by topic, and weak topics get **matching videos recommended**.

---

## Contents

1. [Tech stack](#tech-stack)
2. [Quick start](#quick-start)
3. [Folder structure](#folder-structure)
4. [How the RBAC works](#how-the-rbac-works)
5. [Walkthrough: Science Teacher & Class 2 Student](#walkthrough-science-teacher--class-2-student)
6. [Tests, analysis and video recommendations](#tests-analysis-and-video-recommendations)
7. [Pages](#pages)
8. [Data model](#data-model)
9. [API reference](#api-reference)
10. [Security notes](#security-notes)
11. [Testing](#testing)
12. [What changed from the previous version](#what-changed-from-the-previous-version)

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, lucide-react, react-hot-toast |
| Backend | Express 5, TypeScript (run with `tsx`), Zod 4 validation |
| Database | PostgreSQL + Prisma 7 (`prisma-client` generator with the `@prisma/adapter-pg` driver adapter) |
| Auth | bcrypt password hashes and a JWT inside an **httpOnly cookie**. No localStorage or sessionStorage anywhere. |

---

## Quick start

You need **Node.js 20+** and **PostgreSQL 14+**.

```bash
# 1. Database
createdb vitaran            # or create it in pgAdmin

# 2. Backend
cd backend
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, SUPER_ADMIN_* values
npm install
npm run setup               # prisma generate + apply migrations + seed the Super Admin
npm run dev                 # API on http://localhost:3000

# 3. Frontend (second terminal)
cd frontend
cp .env.example .env        # API_URL=http://localhost:3000
npm install
npm run dev                 # app on http://localhost:3001
```

Open **http://localhost:3001** and sign in with the Super Admin from `backend/.env` (default `admin@lms.com` / `admin123`).

> **Coming from the old version of this repo?** The schema was redesigned, so the old migrations were replaced by a single fresh one. Reset your local database once with `cd backend && npm run db:reset`. This drops all data, re-applies the migration and runs the seed.

### Useful scripts

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | API with auto-reload |
| backend | `npm run setup` | generate client, apply migrations, seed |
| backend | `npm run db:reset` | wipe the DB, re-migrate, re-seed |
| backend | `npm run seed` | (re)create the Super Admin; safe to run repeatedly |
| backend | `npm run typecheck` | `tsc --noEmit` |
| backend | `npm run test:scenario` | end-to-end API test of the walkthrough below (run it on an empty DB) |
| frontend | `npm run dev` / `build` / `lint` | Next.js |

---

## Folder structure

```
vitaran_rbac/
├── README.md
├── backend/
│   ├── .env.example
│   ├── prisma.config.ts              # Prisma 7 config (schema, migrations, seed command)
│   ├── prisma/
│   │   ├── schema.prisma             # the whole data model
│   │   ├── migrations/               # SQL migrations
│   │   └── seed.ts                   # seeds ONLY the Super Admin role + account
│   ├── src/
│   │   ├── server.ts                 # starts the HTTP server
│   │   ├── app.ts                    # Express app: CORS, JSON, /api, error handler
│   │   ├── routes.ts                 # mounts every module; everything after auth needs a session
│   │   ├── config/
│   │   │   ├── env.ts                # typed environment variables
│   │   │   └── permissions.ts        # catalogue of grantable permission keys (grouped by page)
│   │   ├── lib/
│   │   │   ├── prisma.ts             # Prisma client
│   │   │   ├── auth-tokens.ts        # bcrypt, JWT, httpOnly session cookie helpers
│   │   │   └── http.ts               # HttpError, param helpers, slugify
│   │   ├── middleware/
│   │   │   ├── auth.ts               # authenticate / requireActive / requirePermission
│   │   │   ├── error.ts              # turns Zod/Prisma/HTTP errors into JSON
│   │   │   └── rate-limit.ts         # login/register rate limit
│   │   ├── services/
│   │   │   ├── access.service.ts     # ★ loads a user's permissions + class/subject scope
│   │   │   ├── analysis.service.ts   # ★ topic analysis, weak areas, video recommendations
│   │   │   ├── audit.service.ts      # role history log
│   │   │   └── content.service.ts    # shared helpers for content modules
│   │   └── modules/                  # one folder per feature, each with its routes
│   │       ├── auth/                 # register, login, logout, /me
│   │       ├── roles/                # roles CRUD, permissions, scope tree, role history
│   │       ├── users/                # users CRUD, role assignment
│   │       ├── classes/              # classes, subjects, class-subjects, topics
│   │       ├── resources/            # books / blogs / notes / links + search
│   │       ├── videos/
│   │       ├── papers/               # question papers, questions, attempts, results
│   │       ├── instructions/
│   │       ├── school/
│   │       ├── dashboard/
│   │       └── search/
│   └── tests/
│       └── scenario.test.mjs         # 39 end-to-end API checks
└── frontend/
    ├── .env.example
    ├── next.config.ts                # proxies /api/* → Express (first-party cookie)
    ├── app/
    │   ├── layout.tsx                # root layout + toaster
    │   ├── (public)/                 # landing, login, register
    │   └── (app)/                    # signed-in area (guarded by AppShell)
    │       ├── layout.tsx
    │       ├── dashboard/
    │       ├── classes/  [id]/
    │       ├── resources/  [id]/
    │       ├── videos/
    │       ├── question-papers/  [id]/  [id]/take/
    │       ├── results/[id]/         # one attempt's analysis
    │       ├── instructions/
    │       ├── school/
    │       ├── users/
    │       ├── settings/             # roles, permissions, nested class/subject checkboxes, activity log
    │       ├── search/
    │       └── profile/
    ├── components/
    │   ├── ui/                       # Button, Modal, Checkbox (tri-state), form controls, cards, badges
    │   ├── layout/                   # AppShell (auth + page guard), Topbar
    │   ├── auth/                     # login/register form
    │   ├── settings/                 # RoleEditor, PermissionMatrix, ScopeTree, RoleHistory
    │   ├── content/                  # class/subject/topic pickers, video player
    │   └── analysis/                 # score ring, topic bars, recommendations, trend chart
    ├── lib/
    │   ├── api.ts                    # fetch wrapper (same-origin, cookie)
    │   ├── auth-context.tsx          # current user from /api/me (kept in React memory only)
    │   ├── use-api.ts                # data-loading hook, debounce, pagination
    │   ├── navigation.ts             # pages ↔ required permissions
    │   └── format.ts
    └── types/index.ts
```

---

## How the RBAC works

### 1. What is hardcoded and what is data

| Lives in code (it *is* the app) | Lives in the database (managed from the UI) |
|---|---|
| The pages and API routes | Roles: name, description, audience, active flag |
| The **catalogue** of permission keys, e.g. `resources.manage` (`backend/src/config/permissions.ts`) | **Which role has which permission** (`RolePermission`) |
| The Super Admin bootstrap in `seed.ts` | **Which classes/subjects a role can reach** (`RoleClass`, `RoleClassSubject`) |
| | Users and the role assigned to each |
| | Classes, subjects, topics, content, tests, results |
| | Full history of every role change (`RoleEvent`) |

The permission catalogue has to live in code because each key maps to a page or action that exists in code. You can't grant access to a page that hasn't been built. The Settings page loads the catalogue from `GET /api/permissions`, so the frontend doesn't keep its own copy.

### 2. Permission catalogue

| Page | Keys |
|---|---|
| Classes | `classes.view`, `classes.manage` |
| Resources | `resources.view`, `resources.manage` |
| Videos | `videos.view`, `videos.manage` |
| Question papers | `papers.view`, `papers.manage`, `papers.attempt` (take tests), `results.view` |
| Instructions | `instructions.view`, `instructions.manage` |
| School | `school.view`, `school.manage` |
| Users | `users.view`, `users.manage` (create users, **assign roles**) |
| Settings | `roles.manage` |

The Dashboard is available to every active user, and its widgets depend on their permissions.

### 3. Role audience

Each role says **who holds it**:

- **Staff**: principal, office staff, coordinators.
- **Teacher**: listed as a teacher of the classes and subjects they are scoped to.
- **Student**: listed as a student of their classes. Typically also gets `papers.attempt`.

The class page uses this to show "who teaches Science in Class 2" and "who studies in Class 2". You never have to assign teachers or enroll students separately: the role **is** the assignment.

### 4. Class & subject scope (the nested checkboxes)

```
☑ Class 1            [All subjects]   → RoleClass(allSubjects = true): includes subjects added later
   ☑ Maths
   ☑ Science
☐ Class 2
▣ Class 10           [2 of 3]         → RoleClass(allSubjects = false)
   ☑ Physics                            + RoleClassSubject(Class 10 · Physics)
   ☑ Chemistry                          + RoleClassSubject(Class 10 · Chemistry)
   ☐ Maths
```

There is also an **"All classes and subjects"** switch (`Role.allClasses`) for roles like Principal.

### 5. Enforcement: `access.service.ts`

On **every request** the API loads the user, their role, the role's permissions and the role's scope **from the database**. It turns these into:

```ts
{ permissions: Set<PermissionKey>, classIds: string[] | null, classSubjectIds: string[] | null }
// null = unrestricted (Super Admin or an "all classes" role)
```

- Routes are protected with `requirePermission("resources.manage")`.
- Queries are filtered with `classSubjectWhere(access)`, so a Science Teacher's resource list *cannot* contain Class 10 Maths, even through the API.
- Writes are checked with `assertClassSubjectScope(access, id)`, so you can't post into a class you don't have.

Because nothing is cached in the token, **changes in Settings apply on the user's next click**. There's no need to sign out and back in.

The frontend gets the same information from `GET /api/me` (held in React state only). It uses it to hide nav items and buttons, but the API is the real gatekeeper.

### 6. Role history ("track of all roles")

Every change writes a `RoleEvent`: CREATED, UPDATED, PERMISSIONS_CHANGED (with what was added and removed), SCOPE_CHANGED (with the new classes and subjects), ACTIVATED/DEACTIVATED, DELETED, ASSIGNED and UNASSIGNED (with the user). You can see it in:

- **Settings → Activity log**: everything, newest first.
- **Settings → a role**: that role's history and current members.
- **Users → Edit user**: that person's role history.

---

## Walkthrough: Science Teacher & Class 2 Student

1. **Sign in as Super Admin.** Open **Classes → New class**: create *Class 1*, *Class 2* and *Class 10*. Open each class and add subjects, e.g. Class 10: Physics, Chemistry, Maths. Add topics to subjects (e.g. *Optics*, *Electricity*).
2. **Settings → New role** → name it `Science Teacher`, choose **Teacher**.
   - *Page access*: tick View classes, View/Manage resources, View/Manage videos, View/Manage question papers, View results, View instructions.
   - *Class & subject access*: tick **Class 1 → Science**, then expand **Class 10** and tick **Physics** and **Chemistry**. Save.
3. **Settings → New role** → `Class 2 Student`, choose **Student**. Tick View classes, View resources, View videos, View question papers, **Take tests**, View instructions. Tick **Class 2** (all subjects). Save.
4. **Users → Add user**: create a teacher and a student and pick their roles. People who sign up themselves appear in **Users → Waiting for a role**, and you can assign a role from that list.
5. **Sign in as the Science Teacher.** The nav shows only Dashboard, Classes, Resources, Videos, Question Papers and Instructions. Classes shows only *Class 1 (Science)* and *Class 10 (Physics, Chemistry)*. Resources and videos are limited to those subjects. They can add content only there.
6. **Sign in as the Class 2 Student.** They see Class 2, its subjects, **its teachers** (from Teacher roles that cover Class 2) and its resources and videos. Nothing else.

`backend/tests/scenario.test.mjs` runs exactly this story against the API and checks every rule (39 checks).

---

## Tests, analysis and video recommendations

**Building a test:** Question papers → New paper (class & subject, optional time limit) → add multiple-choice questions. **Tag each question with a topic** and give it marks and an explanation → **Publish**.

**Taking a test:** students see published papers for their classes. The test page has a question navigator and a countdown (it auto-submits at 0:00). **Correct answers never reach the browser before submission**: the paper is served without `correctIndex`, and grading happens on the server.

**Analysis (`backend/src/services/analysis.service.ts`):**

1. Group the answered questions by topic. Untagged questions go to "General *subject*".
2. Accuracy per topic = marks scored ÷ marks possible.
3. Classify each topic: **weak < 60%**, average 60–79%, **strong ≥ 80%**.
4. **Recommend videos** for weak topics (weakest first):
   - first, videos tagged with **the same topic**;
   - if that topic has no video yet, other videos of the **same class-subject**, labelled "related".
   - Only videos inside the student's scope are suggested.
5. In the overall analysis (dashboard), only the **latest attempt of each paper** counts, so retaking a test after studying replaces the old weakness.
6. Insights are written in plain language: strongest area, topics that need work, and the trend (last 3 tests vs earlier ones: improving, slipping or steady).

Where students see this:

- **Results page**: score ring, topic bars, recommended videos (play in-app), and an answer review with explanations.
- **Dashboard**: average, tests taken, weak-topic count, score trend chart, subject bars, recommendations, and tests not yet taken.

**Teachers** with `results.view` see a paper's **Results** tab: class average, highest and lowest score, score distribution, class accuracy per topic, per-question difficulty, and each student's latest attempt (with a link to that student's analysis).

---

## Pages

| Page | What it does | Permissions |
|---|---|---|
| Dashboard | Role-aware widgets: stats, pending sign-ups, student performance & recommendations, latest submissions, instructions, new content | any active user |
| Classes | Classes & subjects in scope; class page shows subjects, topics, teachers, students. Managers create classes, subjects and topics | `classes.view` / `classes.manage` |
| Resources | Books, blogs, notes, links. **Search** (title, author, description, body text, topic, subject), filters (type tabs with counts, class, subject), pagination, full CRUD, blog/notes reader | `resources.view` / `resources.manage` |
| Videos | YouTube-embedded lessons with search, class/subject/topic filters and CRUD | `videos.view` / `videos.manage` |
| Question papers | Papers, question editor, publish, take tests, "My results", class results | `papers.*`, `results.view` |
| Instructions | Notices for the whole school or one class; pin to top | `instructions.view` / `.manage` |
| School | School profile (name shown in the top bar), statistics, roles overview | `school.view` / `.manage` |
| Users | Search and filter users, create, edit, **assign role**, suspend, delete, role history; pending sign-ups queue | `users.view` / `.manage` |
| Settings | Roles, page access matrix, **nested class → subject checkboxes**, members, activity log | `roles.manage` |
| Search | Global search across everything the user can see | any active user |
| Profile | Change name and password | any user |

---

## Data model

```
User ──▶ Role ──┬── RolePermission (permission key)
                ├── RoleClass (classId, allSubjects)
                ├── RoleClassSubject (classSubjectId)
                └── RoleEvent (history)

ClassGroup ──< ClassSubject >── Subject
                   │
                   ├──< Topic
                   ├──< Resource (type BOOK | BLOG | NOTES | LINK; may also be school-wide)
                   ├──< Video ──▶ Topic
                   └──< QuestionPaper ──< Question ──▶ Topic
                                     └──< TestAttempt ──< AttemptAnswer

Instruction ──▶ ClassGroup (optional = whole school)
School (single profile row)
```

See `backend/prisma/schema.prisma` for every field. It is commented.

---

## API reference

All routes are under `/api`. Everything except `auth/*` needs the session cookie.

| Method & path | Permission |
|---|---|
| `POST auth/register`, `POST auth/login`, `POST auth/logout` | public |
| `GET me`, `PATCH me` | signed in |
| `GET dashboard`, `GET search?q=`, `GET class-subjects`, `GET school/profile` | active |
| `GET permissions`, `GET roles/scope-tree`, `GET roles/events?roleId=` | roles.manage |
| `GET roles` | roles.manage or users.manage |
| `GET/POST roles`, `GET/PUT/DELETE roles/:id` | roles.manage |
| `GET users?q=&roleId=&status=`, `GET users/:id/history` | users.view / users.manage |
| `POST users`, `PUT users/:id`, `DELETE users/:id` | users.manage |
| `GET classes`, `GET classes/:id`, `GET subjects` | classes.view |
| `POST/PUT/DELETE classes…`, `subjects…`, `classes/:id/subjects`, `class-subjects/:id`, `topics…` | classes.manage |
| `GET resources?q=&type=&classId=&subjectId=&page=`, `GET resources/:id` | resources.view |
| `POST/PUT/DELETE resources…` | resources.manage |
| `GET videos?q=&classId=&subjectId=&topicId=&page=` | videos.view |
| `POST/PUT/DELETE videos…` | videos.manage |
| `GET papers`, `GET papers/:id` | papers.view / manage / attempt / results.view |
| `POST/PUT/DELETE papers…`, `POST papers/:id/questions`, `PUT/DELETE questions/:id` | papers.manage |
| `POST papers/:id/attempts`, `GET attempts/mine`, `GET analysis/me` | papers.attempt |
| `GET attempts/:id` | owner, or results.view in scope |
| `GET papers/:id/results`, `GET analysis/students/:id` | results.view |
| `GET/POST/PUT/DELETE instructions…` | instructions.view / manage |
| `GET school`, `PUT school` | school.view / school.manage |

---

## Security notes

- **No browser storage.** The session is an httpOnly, SameSite=Lax cookie. Next.js proxies `/api/*` to Express, so the cookie is first-party. User and permission data live only in React memory, reloaded from `/api/me`.
- **The server is the authority.** The UI hides what you can't use, but every route checks permissions and class/subject scope again.
- **No privilege escalation.** Anyone other than the Super Admin who has `roles.manage` or `users.manage`:
  - can grant only permissions they hold themselves, and only classes/subjects inside their own scope;
  - cannot grant "all classes" unless they have it;
  - cannot edit or delete their own role, or change their own role or status;
  - cannot assign a role that is stronger or wider than their own, or touch Super Admin accounts.
- The **Super Admin role is locked**: it can't be edited or deleted, and the last active Super Admin can't be deleted.
- New sign-ups are **PENDING with no role**. They see a waiting screen until someone assigns a role.
- Answers are graded on the server, and correct options are never sent before submission.
- Login and register are rate-limited. Passwords are bcrypt-hashed.

---

## Testing

```bash
cd backend
npm run db:reset           # empty DB with only the Super Admin
npm run dev                # in one terminal
npm run test:scenario      # in another → "All checks passed"
```

The scenario test covers:

- class, subject and topic setup;
- nested role scopes;
- what each role can and cannot see and do;
- search;
- correct answers being hidden;
- grading, weak-topic detection and video recommendation;
- teacher results;
- privilege-escalation guards;
- the pending-registration flow;
- the role history.

Both apps also pass `tsc --noEmit`, the frontend passes `eslint`, and `next build` succeeds.

---

## What changed from the previous version

- Roles, permissions and class/subject scope are now **fully database-driven**. The hardcoded `demoRolePermissions` and the seeded `user` role are gone. Only the Super Admin is seeded.
- Separate teacher-assignment and enrolment tables were replaced by **role scopes**, which is what the nested checkboxes edit.
- **No localStorage**: the JWT moved from localStorage into an httpOnly cookie.
- New: resources with search, videos, tests with analysis and recommendations, instructions, school profile, role audit log, users CRUD, and a profile page.
- Backend reorganised into `src/{config,lib,middleware,services,modules}`. Frontend reorganised into `components/{ui,layout,settings,content,analysis}`.
