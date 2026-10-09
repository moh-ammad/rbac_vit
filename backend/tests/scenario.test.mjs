// End-to-end API test of the README scenario.
//
//   1. Super Admin builds classes, subjects and topics
//   2. creates a "Science Teacher" role (Class 1 → Science, Class 10 → Physics + Chemistry)
//   3. creates a "Class 2 Student" role (Class 2 → all subjects)
//   4. checks that each role only sees what it was given
//   5. the student takes a test, gets an analysis and video recommendations
//
// Run against an EMPTY database (it creates data):
//   npm run db:reset && npm run dev     (in one terminal)
//   npm run test:scenario               (in another)

const API = process.env.API_URL ?? "http://localhost:3000/api";
let failures = 0;

function client() {
  let cookie = "";
  return async function call(method, path, body) {
    const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  };
}

function check(label, condition, extra) {
  if (condition) console.log(`  ✔ ${label}`);
  else { failures += 1; console.log(`  ✘ ${label}`, extra ?? ""); }
}

async function main() {
  const admin = client();
  console.log("Super Admin");
  check("logs in", (await admin("POST", "/auth/login", { email: process.env.ADMIN_EMAIL ?? "admin@lms.com", password: process.env.ADMIN_PASSWORD ?? "admin123" })).ok);

  const mk = async (name, grade) => (await admin("POST", "/classes", { name, grade })).class;
  const c1 = await mk("Class 1", 1), c2 = await mk("Class 2", 2), c10 = await mk("Class 10", 10);
  check("creates classes", c1 && c2 && c10);
  const link = async (cls, name) => (await admin("POST", `/classes/${cls.id}/subjects`, { name })).classSubject.id;
  const c1Science = await link(c1, "Science"); await link(c1, "Maths");
  const c2Science = await link(c2, "Science"); const c2English = await link(c2, "English");
  const c10Physics = await link(c10, "Physics"); const c10Chem = await link(c10, "Chemistry"); const c10Maths = await link(c10, "Maths");
  check("links subjects to classes", c1Science && c2Science && c10Physics);

  const topic = async (cs, name) => (await admin("POST", `/class-subjects/${cs}/topics`, { name })).topic.id;
  const plants = await topic(c2Science, "Plants"), animals = await topic(c2Science, "Animals");
  const optics = await topic(c10Physics, "Optics");
  check("creates topics", plants && animals && optics);

  const teacherRole = (await admin("POST", "/roles", {
    name: "Science Teacher", audience: "TEACHER",
    permissions: ["classes.view", "resources.view", "resources.manage", "videos.view", "videos.manage", "papers.view", "papers.manage", "results.view", "instructions.view"],
    scope: [{ classId: c1.id, allSubjects: false, classSubjectIds: [c1Science] }, { classId: c10.id, allSubjects: false, classSubjectIds: [c10Physics, c10Chem] }],
  })).role;
  check("creates Science Teacher role with nested class → subject scope", teacherRole?.scope.length === 2, teacherRole);

  const studentRole = (await admin("POST", "/roles", {
    name: "Class 2 Student", audience: "STUDENT",
    permissions: ["classes.view", "resources.view", "videos.view", "papers.view", "papers.attempt", "instructions.view"],
    scope: [{ classId: c2.id, allSubjects: true, classSubjectIds: [] }],
  })).role;
  const c2TeacherRole = (await admin("POST", "/roles", {
    name: "Class 2 Science Teacher", audience: "TEACHER",
    permissions: ["classes.view", "papers.view", "papers.manage", "results.view", "videos.view", "videos.manage"],
    scope: [{ classId: c2.id, allSubjects: false, classSubjectIds: [c2Science] }],
  })).role;
  check("creates Class 2 Student + Class 2 Science Teacher roles", studentRole && c2TeacherRole);

  const user = async (name, email, roleId) => (await admin("POST", "/users", { name, email, password: "secret123", roleId })).user;
  await user("Ravi Teacher", "ravi@school.com", teacherRole.id);
  await user("Asha Student", "asha@school.com", studentRole.id);
  await user("Meena Teacher", "meena@school.com", c2TeacherRole.id);
  check("creates users with roles", true);

  await admin("POST", "/resources", { title: "Plants Around Us", type: "BOOK", author: "NCERT", classSubjectId: c2Science, topicId: plants });
  await admin("POST", "/resources", { title: "Trigonometry Handbook", type: "BOOK", classSubjectId: c10Maths });
  await admin("POST", "/resources", { title: "How light bends", type: "BLOG", content: "Refraction explained…", classSubjectId: c10Physics, topicId: optics });
  await admin("POST", "/videos", { title: "Animal habitats", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", classSubjectId: c2Science, topicId: animals });
  await admin("POST", "/videos", { title: "Parts of a plant", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", classSubjectId: c2Science, topicId: plants });

  console.log("\nScience Teacher (Class 1 Science, Class 10 Physics + Chemistry)");
  const teacher = client();
  await teacher("POST", "/auth/login", { email: "ravi@school.com", password: "secret123" });
  const tClasses = (await teacher("GET", "/classes")).classes;
  check("sees only Class 1 and Class 10", tClasses.map((c) => c.name).join(",") === "Class 1,Class 10", tClasses.map((c) => c.name));
  const tC10 = tClasses.find((c) => c.name === "Class 10");
  check("in Class 10 sees only Chemistry + Physics (not Maths)", tC10.subjects.map((s) => s.name).join(",") === "Chemistry,Physics", tC10.subjects);
  const tRes = (await teacher("GET", "/resources")).resources.map((r) => r.title);
  check("resources: sees Physics blog, not Class 10 Maths or Class 2", tRes.includes("How light bends") && !tRes.includes("Trigonometry Handbook") && !tRes.includes("Plants Around Us"), tRes);
  check("search 'light' finds the blog", (await teacher("GET", "/resources?q=light")).total === 1);
  check("cannot add a resource to Class 2", (await teacher("POST", "/resources", { title: "x", type: "NOTES", classSubjectId: c2Science })).status === 403);
  check("can add a resource to Class 10 Physics", (await teacher("POST", "/resources", { title: "Lens notes", type: "NOTES", classSubjectId: c10Physics })).resource);
  check("cannot open Settings → roles", (await teacher("GET", "/roles")).status === 403);
  check("cannot open Users", (await teacher("GET", "/users")).status === 403);

  console.log("\nClass 2 Science Teacher builds a test");
  const meena = client();
  await meena("POST", "/auth/login", { email: "meena@school.com", password: "secret123" });
  const paper = (await meena("POST", "/papers", { title: "Living things — unit test", classSubjectId: c2Science, durationMinutes: 10 })).paper;
  const q = (prompt, options, correctIndex, topicId) => meena("POST", `/papers/${paper.id}/questions`, { prompt, options, correctIndex, topicId });
  await q("Which part of a plant makes food?", ["Root", "Leaf", "Stem"], 1, plants);
  await q("Plants take in which gas?", ["Oxygen", "Carbon dioxide", "Nitrogen"], 1, plants);
  await q("Where does a fish live?", ["Water", "Desert", "Tree"], 0, animals);
  await q("Which animal can fly?", ["Cow", "Eagle", "Snake"], 1, animals);
  const published = await meena("PUT", `/papers/${paper.id}`, { title: paper.title, classSubjectId: c2Science, durationMinutes: 10, isPublished: true });
  check("creates and publishes a 4-question paper", published.paper?.isPublished === true, published);

  console.log("\nClass 2 Student");
  const student = client();
  await student("POST", "/auth/login", { email: "asha@school.com", password: "secret123" });
  const me = (await student("GET", "/me")).user;
  check("/me returns role and permissions from the DB", me.role.name === "Class 2 Student" && me.permissions.includes("papers.attempt"));
  const sClasses = (await student("GET", "/classes")).classes;
  check("sees only Class 2 (all its subjects)", sClasses.length === 1 && sClasses[0].subjects.length === 2, sClasses);
  const detail = await student("GET", `/classes/${c2.id}`);
  check("sees Class 2 teachers (Meena for Science)", detail.teachers.some((t) => t.name === "Meena Teacher" && t.subjects.includes("Science")), detail.teachers);
  const sRes = (await student("GET", "/resources")).resources.map((r) => r.title);
  check("resources: only Class 2", sRes.join() === "Plants Around Us", sRes);
  check("cannot add resources", (await student("POST", "/resources", { title: "x", type: "NOTES", classSubjectId: c2Science })).status === 403);
  const view = await student("GET", `/papers/${paper.id}`);
  check("paper is sent WITHOUT correct answers", view.paper.questions.every((qq) => qq.correctIndex === undefined));

  // Plants: both right. Animals: both wrong.
  const answers = view.paper.questions.map((qq, i) => ({ questionId: qq.id, selectedIndex: [1, 1, 2, 0][i] }));
  const attempt = (await student("POST", `/papers/${paper.id}/attempts`, { answers })).attempt;
  check("submits test → 50%", Math.round(attempt.percentage) === 50, attempt);
  const result = await student("GET", `/attempts/${attempt.id}`);
  const weak = result.topics.filter((t) => t.level === "weak").map((t) => t.topic);
  check("analysis marks Animals as weak, Plants as strong", weak.join() === "Animals" && result.topics.find((t) => t.topic === "Plants").level === "strong", result.topics);
  check("recommends the Animals video", result.recommendations[0]?.video.title === "Animal habitats", result.recommendations);
  const overall = (await student("GET", "/analysis/me")).analysis;
  check("overall analysis has insights", overall.insights.length > 0, overall.insights);

  console.log("\nTeacher sees results");
  const results = await meena("GET", `/papers/${paper.id}/results`);
  check("class results list Asha at 50%", results.students[0]?.percentage === 50, results.students);
  check("Science Teacher (no Class 2) cannot see this paper", (await teacher("GET", `/papers/${paper.id}`)).status === 404);

  console.log("\nNo privilege escalation");
  const coordRole = (await admin("POST", "/roles", { name: "Class 2 Coordinator", audience: "STAFF", permissions: ["roles.manage", "classes.view", "papers.view"], scope: [{ classId: c2.id, allSubjects: true, classSubjectIds: [] }] })).role;
  await user("Kiran Coordinator", "kiran@school.com", coordRole.id);
  const coord = client();
  await coord("POST", "/auth/login", { email: "kiran@school.com", password: "secret123" });
  check("coordinator cannot grant a permission they lack", (await coord("POST", "/roles", { name: "Sneaky", audience: "STAFF", permissions: ["users.manage"], scope: [] })).status === 403);
  check("coordinator cannot grant Class 10", (await coord("POST", "/roles", { name: "Sneaky", audience: "STAFF", permissions: ["classes.view"], scope: [{ classId: c10.id, allSubjects: true, classSubjectIds: [] }] })).status === 403);
  check("coordinator cannot grant all classes", (await coord("POST", "/roles", { name: "Sneaky", audience: "STAFF", permissions: ["classes.view"], allClasses: true })).status === 403);
  check("coordinator can create a role inside their own access", (await coord("POST", "/roles", { name: "Class 2 Viewer", audience: "STAFF", permissions: ["classes.view"], scope: [{ classId: c2.id, allSubjects: true, classSubjectIds: [] }] })).status === 201);
  check("coordinator cannot edit own role", (await coord("PUT", `/roles/${coordRole.id}`, { name: "Class 2 Coordinator", audience: "STAFF", permissions: ["roles.manage", "classes.view", "papers.view"], scope: [] })).status === 403);
  const superRole = (await admin("GET", "/roles")).roles.find((r) => r.isSuperAdmin);
  check("nobody can edit the Super Admin role", (await admin("PUT", `/roles/${superRole.id}`, { name: "Hacked", audience: "STAFF", permissions: [] })).status === 403);

  console.log("\nRegistration");
  const newbie = client();
  await newbie("POST", "/auth/register", { name: "New Person", email: "new@school.com", password: "secret123" });
  check("new sign-up is PENDING with no role", (await newbie("GET", "/me")).user.status === "PENDING");
  check("pending user cannot read classes", (await newbie("GET", "/classes")).status === 403);
  check("pending user appears in admin's pending filter", (await admin("GET", "/users?status=PENDING")).users.some((u) => u.email === "new@school.com"));

  console.log("\nRole history");
  const events = (await admin("GET", "/roles/events")).events;
  check("role events were tracked", events.filter((e) => e.action === "CREATED").length >= 3 && events.some((e) => e.action === "ASSIGNED"), events.length);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
