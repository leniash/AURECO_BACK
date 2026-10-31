const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const DAY = 86400000;
const DEMO_PW = 'demo1234';
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEMO_PW, 10);

const PROLES = ['student', 'teacher', 'lecturer', 'supervisor', 'administrator'];
const PROWS = [
  { g: 'Portfolios' },
  { k: 'view_own', l: 'View their own portfolio', c: [[1, 1], null, null, null, null] },
  { k: 'add_projects', l: 'Add projects and edit their profile', c: [[1, 0], null, null, null, null] },
  { k: 'view_taught', l: 'View portfolios of students they teach or supervise', c: [null, [1, 0], [1, 0], [1, 0], null] },
  { k: 'view_all', l: "View every student's portfolio", c: [[0, 1], [0, 1], [0, 1], [0, 1], [1, 0]] },
  { k: 'add_acts', l: 'Add activities and achievements', c: [[1, 0], null, null, null, null] },
  { k: 'verify', l: 'Check (verify) entries', c: [[0, 1], [1, 0], [1, 0], [0, 0], [0, 0]] },
  { k: 'comment_rate', l: 'Comment on and rate portfolios', c: [[0, 1], [1, 0], [1, 0], [0, 0], [0, 0]] },
  { k: 'add_notes', l: 'Add attachment progress notes', c: [[0, 1], [0, 0], [0, 0], [1, 0], [0, 0]] },
  { k: 'change_gpa', l: 'Change certified GPA and grades', c: [[0, 1], [0, 1], [0, 1], [0, 1], [0, 1]] },
  { g: 'Letters' },
  { k: 'ask_letter', l: 'Ask for a recommendation letter', c: [[1, 0], null, null, null, null] },
  { k: 'write_letters', l: 'Write recommendation letters', c: [[0, 1], [1, 0], [1, 0], [0, 0], [0, 0]] },
  { g: 'People and reports' },
  { k: 'manage_accounts', l: 'Create and manage accounts', c: [[0, 1], [0, 1], [0, 1], [0, 1], [1, 1]] },
  { k: 'change_perms', l: 'Change permissions', c: [[0, 1], [0, 1], [0, 1], [0, 1], [1, 1]] },
  { k: 'see_reports', l: 'See the dashboard and reports', c: [[0, 1], [0, 0], [0, 0], [0, 0], [1, 1]] }
];

function defaultPerms() {
  const p = {};
  PROWS.forEach(r => {
    if (!r.k) return;
    p[r.k] = {};
    PROLES.forEach((role, i) => {
      const c = r.c[i];
      p[r.k][role] = c ? { v: !!c[0], lock: !!c[1] } : null;
    });
  });
  return p;
}

async function seed() {
  console.log('--- Seeding Neon Database with Africa University Records ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Registry Data
    const registry = [
      { schoolId: '2023-0148', name: 'Jordan Lee', email: 'jordan.lee@students.school.edu', year: 3, programme: 'BSc Computer Science' },
      { schoolId: '2023-0152', name: 'Sam Patel', email: 'sam.patel@students.school.edu', year: 3, programme: 'BSc Computer Science' },
      { schoolId: '2024-0310', name: 'Alex Carter', email: 'alex.carter@students.school.edu', year: 2, programme: 'BSc Information Systems' },
      { schoolId: '2023-0201', name: 'Taylor Kim', email: 'taylor.kim@students.school.edu', year: 3, programme: 'BSc Computer Science' },
      { schoolId: '2022-0077', name: 'Casey Nguyen', email: 'casey.nguyen@students.school.edu', year: 4, programme: 'BSc Computer Science' },
      { schoolId: '2024-0188', name: 'Tendai Sibanda', email: 'tendai.sibanda@students.school.edu', year: 2, programme: 'BSc Computer Science' },
      { schoolId: '2025-0301', name: 'Nomsa Dube', email: 'nomsa.dube@students.school.edu', year: 1, programme: 'BSc Information Systems' },
      { schoolId: '2025-0302', name: 'Farai Moyo', email: 'farai.moyo@students.school.edu', year: 1, programme: 'BSc Computer Science' },
      { schoolId: '2026-0501', name: 'Mia Dube', email: 'mia.dube@students.school.edu', year: 1, programme: 'BSc Information Systems' },
      { schoolId: '2026-0502', name: 'Kudzai Ncube', email: 'kudzai.ncube@students.school.edu', year: 1, programme: 'BSc Computer Science' }
    ];

    for (const r of registry) {
      await client.query(`
        INSERT INTO registry (school_id, name, email, year, programme)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (school_id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          year = EXCLUDED.year,
          programme = EXCLUDED.programme;
      `, [r.schoolId, r.name, r.email, r.year, r.programme]);
    }
    console.log(`✓ Inserted ${registry.length} official student registry records.`);

    // 2. Users Data
    const startJ = Date.now() - 37 * DAY;
    const startC = Date.now() - 68 * DAY;
    const att = (start) => ({ supId: 'u_casey', company: 'Acme Ltd', start, end: start + 84 * DAY });

    const users = [
      {
        id: 'u_jordan', role: 'student', name: 'Jordan Lee', school_id: '2023-0148',
        email: 'jordan.lee@students.school.edu', phone: '+263 77 123 4567', status: 'active',
        year: 3, programme: 'BSc Computer Science', overall: 3.41,
        gpas: [3.12, 3.35, 3.55, 3.45, 3.65, 3.52],
        bio: "Third-year Computer Science student who enjoys building tools that save people time. Strong in databases and web development. I'm looking for a software developer role after I graduate.",
        skills: ['Python', 'SQL', 'JavaScript', 'Git'],
        linkedin: 'linkedin.com/in/jordanlee', github: 'github.com/jordanlee',
        attach: att(startJ)
      },
      {
        id: 'u_sam', role: 'student', name: 'Sam Patel', school_id: '2023-0152',
        email: 'sam.patel@students.school.edu', phone: '+263 77 101 4101', status: 'active',
        year: 3, programme: 'BSc Computer Science', overall: 3.28,
        gpas: [3.0, 3.2, 3.3, 3.4, 3.35, 3.4],
        bio: 'Third-year student interested in data and mobile apps.',
        skills: ['Java', 'Kotlin', 'SQL'],
        linkedin: 'linkedin.com/in/sampatel', github: 'github.com/sampatel',
        attach: att(startJ)
      },
      {
        id: 'u_alex', role: 'student', name: 'Alex Carter', school_id: '2024-0310',
        email: 'alex.carter@students.school.edu', phone: '+263 77 102 4102', status: 'active',
        year: 2, programme: 'BSc Information Systems', overall: 3.15,
        gpas: [3.0, 3.1, 3.3, 3.2],
        bio: 'Second-year Information Systems student.',
        skills: ['Excel', 'SQL']
      },
      {
        id: 'u_taylor', role: 'student', name: 'Taylor Kim', school_id: '2023-0201',
        email: 'taylor.kim@students.school.edu', phone: '+263 77 103 4103', status: 'active',
        year: 3, programme: 'BSc Computer Science', overall: 3.55,
        gpas: [3.4, 3.5, 3.6, 3.7, 3.6, 3.5],
        bio: 'Final-year project lead who likes teamwork and clean code.',
        skills: ['Python', 'React', 'Git'],
        linkedin: 'linkedin.com/in/taylorkim', github: 'github.com/taylorkim'
      },
      {
        id: 'u_casen', role: 'student', name: 'Casey Nguyen', school_id: '2022-0077',
        email: 'casey.nguyen@students.school.edu', phone: '+263 77 104 4104', status: 'active',
        year: 4, programme: 'BSc Computer Science', overall: 3.62,
        gpas: [3.3, 3.4, 3.5, 3.6, 3.7, 3.7, 3.8],
        bio: 'Fourth-year student who enjoys backend work.',
        skills: ['Go', 'PostgreSQL', 'Docker'],
        linkedin: 'linkedin.com/in/caseynguyen', github: 'github.com/caseynguyen',
        attach: att(startC)
      },
      {
        id: 'u_tendai', role: 'student', name: 'Tendai Sibanda', school_id: '2024-0188',
        email: 'tendai.sibanda@students.school.edu', phone: '+263 77 105 4105', status: 'active',
        year: 2, programme: 'BSc Computer Science', overall: 3.22,
        gpas: [3.1, 3.2, 3.3, 3.3],
        bio: 'Second-year student.',
        skills: ['Python']
      },
      {
        id: 'u_nomsa', role: 'student', name: 'Nomsa Dube', school_id: '2025-0301',
        email: 'nomsa.dube@students.school.edu', phone: '+263 77 106 4106', status: 'active',
        year: 1, programme: 'BSc Information Systems', overall: 3.05,
        gpas: [3.0, 3.1]
      },
      {
        id: 'u_farai', role: 'student', name: 'Farai Moyo', school_id: '2025-0302',
        email: 'farai.moyo@students.school.edu', phone: '+263 77 107 4107', status: 'active',
        year: 1, programme: 'BSc Computer Science', overall: 3.0,
        gpas: [3.0, 3.0]
      },
      {
        id: 'u_riley', role: 'staff', name: 'Riley Adams', hon: 'Dr.', title: 'Lecturer',
        dept: 'Computing', email: 'riley.adams@school.edu', status: 'active',
        teaches: ['u_jordan', 'u_sam', 'u_alex', 'u_taylor', 'u_casen', 'u_tendai']
      },
      {
        id: 'u_jamie', role: 'staff', name: 'Jamie Ortiz', hon: 'Ms.', title: 'Teacher',
        dept: 'Communication', email: 'jamie.ortiz@school.edu', status: 'active',
        teaches: ['u_jordan', 'u_alex']
      },
      {
        id: 'u_morgan', role: 'staff', name: 'Morgan Hughes', hon: 'Prof.', title: 'Lecturer',
        dept: 'Mathematics', email: 'morgan.hughes@school.edu', status: 'active',
        teaches: ['u_jordan', 'u_sam']
      },
      {
        id: 'u_casey', role: 'supervisor', name: 'Casey Brooks', company: 'Acme Ltd',
        dept: 'Software team', email: 'casey.brooks@acme.example', status: 'active'
      },
      {
        id: 'u_quinn', role: 'admin', name: 'Quinn Moyer', dept: 'Registry office',
        email: 'quinn.moyer@school.edu', status: 'active'
      },
      {
        id: 'u_robin', role: 'student', name: 'Robin Hale', school_id: '2025-0412',
        email: 'robin.hale@students.school.edu', phone: '+263 77 555 0412',
        year: 1, status: 'pending', signup_info: { match: true, issues: [], at: Date.now() - DAY }
      }
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (
          id, role, name, school_id, email, password_hash, phone, status,
          year, programme, overall, gpas, bio, skills, linkedin, github,
          hon, title, dept, teaches, company, attach, signup_info
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          status = EXCLUDED.status,
          password_hash = EXCLUDED.password_hash;
      `, [
        u.id, u.role, u.name, u.school_id || null, u.email, DEFAULT_PASSWORD_HASH, u.phone || null, u.status || 'active',
        u.year || null, u.programme || null, u.overall || null, JSON.stringify(u.gpas || []), u.bio || '',
        JSON.stringify(u.skills || []), u.linkedin || '', u.github || '',
        u.hon || null, u.title || null, u.dept || null, JSON.stringify(u.teaches || []),
        u.company || null, u.attach ? JSON.stringify(u.attach) : null, u.signup_info ? JSON.stringify(u.signup_info) : null
      ]);
    }
    console.log(`✓ Inserted ${users.length} active users across all 4 roles.`);

    // 3. Projects, Activities, Letters, Notes, Assess, Perms
    let an = 0;
    const A = (sid, type, year, title, where, status, age, comments) => ({
      id: 'a' + (++an), sid, type, year, title, where: where || '', status, created: Date.now() - age * DAY, evidence: '', comments: comments || []
    });

    const acts = [
      A('u_jordan', 'achievement', 3, "Dean's list", 'Faculty of Science', 'verified', 60),
      A('u_jordan', 'achievement', 2, 'Hackathon finalist', 'Inter-university', 'verified', 300),
      A('u_jordan', 'achievement', 1, 'Best first-year project', 'Computing department', 'verified', 600),
      A('u_jordan', 'leadership', 3, 'Chess club treasurer', "Students' union", 'waiting', 45, [{ by: 'u_riley', text: 'Please add a letter from the club president.', at: Date.now() - 20 * DAY }]),
      A('u_jordan', 'leadership', 2, 'Class representative', 'Computing', 'verified', 350),
      A('u_jordan', 'leadership', 2, 'Peer mentor', 'First-year mentoring programme', 'verified', 320),
      A('u_jordan', 'extra', 3, 'Debate society', 'Member, years 1 to 3', 'verified', 90),
      A('u_jordan', 'extra', 1, 'Football, first team', 'University sport', 'verified', 550),
      A('u_jordan', 'extra', 2, 'Photography club', 'Member', 'waiting', 5),
      A('u_sam', 'achievement', 3, 'Programming contest, second place', 'Regional contest', 'waiting', 3),
      A('u_sam', 'leadership', 2, 'Student council secretary', '', 'verified', 200),
      A('u_sam', 'extra', 1, 'Basketball', 'Campus league', 'verified', 500),
      A('u_alex', 'leadership', 2, 'Volunteer tutor', 'Maths support desk', 'waiting', 40),
      A('u_alex', 'extra', 1, 'Drama club', '', 'verified', 400),
      A('u_taylor', 'achievement', 2, 'Faculty prize', 'Computing', 'verified', 300),
      A('u_taylor', 'leadership', 3, 'Hackathon team lead', '', 'verified', 100),
      A('u_taylor', 'extra', 1, 'Robotics club', '', 'verified', 500),
      A('u_casen', 'achievement', 3, "Dean's list", '', 'verified', 200),
      A('u_casen', 'leadership', 3, 'Coding club president', '', 'verified', 150),
      A('u_casen', 'extra', 2, 'Cycling', '', 'verified', 300),
      A('u_tendai', 'achievement', 1, 'First-year merit award', '', 'verified', 400),
      A('u_nomsa', 'extra', 1, 'Choir', '', 'waiting', 10)
    ];

    let pn = 0;
    const P = (sid, name, kind, goal, challenge, role, result, live, code) => ({
      id: 'p_' + (++pn), sid, name, kind, goal, challenge, role, result, live: live || '', code: code || '', comments: []
    });

    const projects = [
      P('u_jordan', 'Student results portal', 'Class project · Team of 4', 'Let lecturers upload marks and let students see them.', 'Marks pages loaded slowly. I added a database index and cut the load time from 6 seconds to 2.', 'I built the database and the login system. Two teammates built the screens, one wrote tests.', 'Used by 3 classes, 120 students', 'https://example.com/results', 'https://github.com/jordanlee/results-portal'),
      P('u_jordan', 'Clinic booking app', 'Freelance · Solo', 'Help a small clinic stop double-booking patients.', 'Two people booked the same slot. I chose to lock a slot the moment someone starts booking it.', 'I did everything: design, code and set-up.', 'Missed appointments down by a third', 'https://example.com/clinic', 'https://github.com/jordanlee/clinic-booking'),
      P('u_jordan', 'Budget tracker', 'Personal build · Solo', 'Track monthly spending without a spreadsheet.', 'Syncing between phone and laptop. I used a small sync queue.', 'Solo build.', 'Used daily for 8 months', '', 'https://github.com/jordanlee/budget'),
      P('u_jordan', 'Library catalogue search', 'Class project · Team of 3', 'Help students find books faster than the old card list.', 'Searches were slow on long titles. I tried two methods and picked the faster one.', 'Team of 3. I wrote the search and the database.', 'Searches take under 1 second. Used by 200 students.', '', ''),
      P('u_sam', 'Step counter app', 'Personal build · Solo', 'Count steps and show weekly trends.', 'Battery use was high; I batched sensor reads.', 'Solo.', 'Battery use down 40%', '', 'https://github.com/sampatel/steps'),
      P('u_sam', 'Campus map', 'Class project · Team of 3', 'A simple map of lecture rooms.', 'Offline use; cached tiles.', 'Wrote the search.', 'Used by 80 students', '', ''),
      P('u_alex', 'Inventory sheet', 'Class project · Solo', 'Track stock for a small shop.', '', '', '', '', ''),
      P('u_taylor', 'Team scheduler', 'Class project · Team of 4', 'Fair timetable for group work.', '', 'Led the team.', 'Used by 4 classes', '', ''),
      P('u_taylor', 'Portfolio site', 'Personal build · Solo', 'Show my work.', '', 'Solo.', '', '', ''),
      P('u_taylor', 'Final-year project', 'Final-year · Team of 4', 'Real-time lab booking.', 'Handling clashes.', 'Led a team of four.', 'Delivered ahead of schedule', '', ''),
      P('u_casen', 'Log shipper', 'Personal build · Solo', 'Ship logs cheaply.', '', 'Solo.', 'Cut costs by half', '', ''),
      P('u_casen', 'Chat service', 'Class project · Team of 3', 'Scalable chat.', '', 'Backend.', 'Handled 5k users in tests', '', ''),
      P('u_casen', 'Warehouse API', 'Attachment · Solo', 'Stock API for a client.', '', 'Solo.', 'In use', '', ''),
      P('u_tendai', 'Quiz game', 'Class project · Team of 2', 'A study quiz.', '', '', '', '', '')
    ];

    const bodyV1 = 'Dear hiring manager,\n\nIt is my pleasure to recommend Taylor Kim for the software internship. In my databases class they showed strong problem-solving skills.\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\nDr. Riley Adams';
    const draftV2 = 'Dear hiring manager,\n\nIt is my pleasure to recommend Taylor Kim for the software internship. In my databases class they showed strong problem-solving skills.\n\nIn their final-year project, Taylor led a team of four and delivered a working system ahead of schedule.\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\nDr. Riley Adams';
    const share = { grades: true, ach: true, lead: true, extra: true };

    let ln = 0;
    const L = (sid, staffId, purpose, due, status, o) => Object.assign({
      id: 'l_' + (++ln), sid, staffId, purpose, due, note: '', share, status, reply: '', versions: [], changeRequests: [], changesUsed: 0, draft: '', created: Date.now() - 5 * DAY
    }, o || {});

    const letters = [
      L('u_jordan', 'u_riley', 'Internship', Date.now() + 20 * DAY, 'ready', {
        versions: [{
          n: 1,
          body: 'Dear hiring manager,\n\nI am pleased to recommend Jordan Lee for a software internship. In my databases class Jordan built the strongest project of the year, and they led the team with care and good humour.\n\nI recommend them without reservation.\n\nYours sincerely,\nDr. Riley Adams',
          sent: Date.now() - 3 * DAY,
          seen: false
        }],
        note: "I'm applying for a software internship at a local bank."
      }),
      L('u_jordan', 'u_morgan', 'Scholarship', Date.now() + 30 * DAY, 'accepted'),
      L('u_jordan', 'u_jamie', 'Job application', Date.now() + 17 * DAY, 'declined', { reply: "I'm on leave this term. Please ask another lecturer." }),
      L('u_jordan', 'u_riley', 'Scholarship', Date.now() + 10 * DAY, 'waiting', { note: 'I would like my leadership in the chess club mentioned.' }),
      L('u_sam', 'u_riley', 'Job application', Date.now() + 27 * DAY, 'waiting'),
      L('u_taylor', 'u_riley', 'Internship', Date.now() + 15 * DAY, 'changes', {
        versions: [{ n: 1, body: bodyV1, sent: Date.now() - 13 * DAY, seen: true }],
        changesUsed: 1,
        changeRequests: [{ text: 'Please mention my final-year project and how I led the team.', at: Date.now() - DAY }],
        draft: draftV2
      }),
      L('u_alex', 'u_riley', 'Scholarship', Date.now() - 3 * DAY, 'waiting')
    ];

    const notes = [
      { sid: 'u_jordan', wk: 4, r: { punct: 5, qual: 3, team: 4 }, text: 'Started the reports page. Needs a clearer plan.', at: startJ + 27 * DAY, by: 'u_casey' },
      { sid: 'u_jordan', wk: 5, r: { punct: 5, qual: 4, team: 5 }, text: 'Settled in well. Asks good questions.', at: startJ + 34 * DAY, by: 'u_casey' },
      { sid: 'u_sam', wk: 5, r: { punct: 4, qual: 4, team: 4 }, text: 'Steady progress on the mobile client.', at: startJ + 34 * DAY, by: 'u_casey' },
      { sid: 'u_casen', wk: 9, r: { punct: 5, qual: 5, team: 5 }, text: 'Delivered the stock API and wrote the handover notes.', at: startC + 62 * DAY, by: 'u_casey' }
    ];

    const assess = [
      { sid: 'u_jordan', by: 'u_riley', r: { leadership: 4, teamwork: 5, communication: 3 }, feedback: 'Jordan led the club well this year. Next, try delegating more tasks.', at: Date.now() - 10 * DAY }
    ];

    const perms = defaultPerms();
    const permLog = [
      { ts: Date.now() - DAY, by: 'Quinn Moyer', text: 'Permissions changed for Lecturers' },
      { ts: Date.now() - 20 * DAY, by: 'Quinn Moyer', text: 'Teachers can now comment on portfolios' }
    ];
    const auditLog = [
      { ts: Date.now() - 3600000, text: 'Registry updated Year 2 grades' },
      { ts: Date.now() - DAY, text: 'Permissions changed for Lecturers' },
      { ts: Date.now() - DAY, text: '2 students signed up' }
    ];
    const reports = [
      { id: 'r1', name: 'Year 3 progress', fmt: 'PDF', ts: Date.now() - 20 * DAY, f: { 'rep.type': 'progress', 'rep.group': '3', 'rep.grades': true, 'rep.credits': true, 'rep.acts': true, 'rep.comp': true } },
      { id: 'r2', name: 'Compliance summary', fmt: 'Excel', ts: Date.now() - 32 * DAY, f: { 'rep.type': 'compliance', 'rep.group': 'all' } }
    ];

    await client.query(`
      INSERT INTO portfolio_state (id, version, projects, acts, letters, notes, finals, assess, perms, perm_log, audit_log, reports)
      VALUES ('current', 2, $1, $2, $3, $4, '{}', $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        projects = EXCLUDED.projects,
        acts = EXCLUDED.acts,
        letters = EXCLUDED.letters,
        notes = EXCLUDED.notes,
        assess = EXCLUDED.assess,
        perms = EXCLUDED.perms,
        perm_log = EXCLUDED.perm_log,
        audit_log = EXCLUDED.audit_log,
        reports = EXCLUDED.reports,
        updated_at = CURRENT_TIMESTAMP;
    `, [
      JSON.stringify(projects),
      JSON.stringify(acts),
      JSON.stringify(letters),
      JSON.stringify(notes),
      JSON.stringify(assess),
      JSON.stringify(perms),
      JSON.stringify(permLog),
      JSON.stringify(auditLog),
      JSON.stringify(reports)
    ]);
    console.log('✓ Initialized portfolio state (projects, activities, letters, permissions).');

    await client.query('COMMIT');
    console.log('--- Database seeding completed successfully! ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
