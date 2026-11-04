const { GoogleGenAI } = require('@google/genai');
const { query } = require('../config/db');

// Ensure Windows SSL certificate chains do not fail TLS handshakes
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const apiKey = process.env.GEMINI_API_KEY;
let aiClient = null;

try {
  aiClient = new GoogleGenAI({ apiKey });
} catch (err) {
  console.error('Failed to initialize GoogleGenAI client:', err.message);
}

/**
 * Generate a formal academic/professional recommendation letter.
 */
async function generateRecommendationLetter({ student, lecturer, purpose, specificNote, projects, activities, gpa }) {
  if (!aiClient) {
    throw new Error('AI service is not configured. Missing GEMINI_API_KEY.');
  }

  const prompt = `
You are drafting an official academic and professional Letter of Recommendation from Africa University.
Africa University is an elite, pan-African institution located in Mutare, Zimbabwe.

Lecturer Information:
- Name: ${lecturer.name || 'Faculty Member'}
- Title/Department: ${lecturer.title || 'Lecturer'}, Department of ${lecturer.dept || 'Computer Science & Information Technology'}
- Institution: Africa University, Mutare, Zimbabwe

Student Candidate:
- Name: ${student.name}
- Programme: ${student.programme || 'BSc Computer Science'}, Year ${student.year || 3}
- Overall Cumulative GPA: ${gpa || student.overall || '3.50'} / 4.00
- Purpose of Recommendation: ${purpose || 'Employment / Graduate Study'}
- Special Note/Focus Requested: ${specificNote || 'Highlight overall competence, technical leadership, and character'}

Key Verified Projects:
${(projects || []).map(p => `- ${p.name} (${p.kind}): Goal: ${p.goal}. Challenge: ${p.challenge}. Role: ${p.role}. Result: ${p.result}`).slice(0, 3).join('\n') || 'Demonstrated consistent excellence in practical coursework and systems design.'}

Verified Extracurricular & Leadership:
${(activities || []).map(a => `- ${a.title} (${a.type}): ${a.where || 'University level'}`).slice(0, 3).join('\n') || 'Active member of the university community.'}

Instructions:
1. Write a professional, heartfelt, high-impact recommendation letter.
2. Structure it with standard academic greeting ("Dear Selection Committee / Hiring Manager,"), an opening stating strong support, 2 body paragraphs referencing concrete projects and leadership, a paragraph on character and ethics, and an enthusiastic closing.
3. Sign off as:
   Yours sincerely,
   ${lecturer.title ? lecturer.title + ' ' : ''}${lecturer.name}
   Africa University, Zimbabwe
4. Return ONLY the letter body text without markdown code backticks.
`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  const letterText = response.text ? response.text.trim() : '';

  // Store in ai_recommendation_history
  try {
    await query(
      'INSERT INTO ai_recommendation_history (student_id, staff_id, prompt_type, generated_text) VALUES ($1, $2, $3, $4)',
      [student.id, lecturer.id || null, 'letter', letterText]
    );
  } catch (e) {
    console.error('Failed to save AI letter history:', e.message);
  }

  return { letter: letterText };
}

/**
 * Perform an intelligent portfolio audit and enhancement critique.
 */
async function reviewPortfolio({ student, projects, activities, gpa }) {
  if (!aiClient) {
    throw new Error('AI service is not configured.');
  }

  const prompt = `
Analyze this student portfolio for a student at Africa University:
Student: ${student.name} (${student.programme || 'Computing'}, Year ${student.year || 3})
Cumulative GPA: ${gpa || student.overall || 'N/A'}
Skills: ${(student.skills || []).join(', ') || 'Software Development'}
Projects: ${(projects || []).map(p => p.name + ' - ' + (p.result || p.goal)).join('; ')}
Activities: ${(activities || []).map(a => a.title).join('; ')}

Provide an evaluation in JSON format with:
{
  "summary": "Brief 2-sentence executive summary of student caliber",
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "recommendedImprovements": ["Improvement 1", "Improvement 2"],
  "industryReadinessScore": 88, // 1 to 100
  "suggestedCareerRoles": ["Role 1", "Role 2", "Role 3"]
}
Return only pure JSON.
`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  let raw = response.text ? response.text.trim() : '{}';
  raw = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = { summary: raw, topStrengths: [], recommendedImprovements: [] };
  }

  return parsed;
}

/**
 * Polish a student project description to highlight metrics and outcomes.
 */
async function improveProjectDescription({ name, kind, goal, challenge, role, result }) {
  if (!aiClient) {
    throw new Error('AI service is not configured.');
  }

  const prompt = `
You are an expert tech recruiter and portfolio coach.
Polish this student project description to sound impactful, professional, and results-oriented (STAR format):
- Project: ${name}
- Category: ${kind}
- Goal: ${goal}
- Challenge: ${challenge}
- Role: ${role}
- Result: ${result}

Return a JSON object with:
{
  "polishedGoal": "Clear, compelling goal statement",
  "polishedChallenge": "Engaging description of technical hurdle tackled",
  "polishedRole": "Precise contribution statement demonstrating ownership",
  "polishedResult": "Quantifiable, impressive outcome statement"
}
Return only pure JSON without markdown backticks.
`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  let raw = response.text ? response.text.trim() : '{}';
  raw = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    return { polishedGoal: goal, polishedChallenge: challenge, polishedRole: role, polishedResult: result };
  }
}

/**
 * AI-assisted recommendation request email drafting for students.
 */
async function draftRequestEmail({ studentName, studentProgramme, recipientName, purpose, notes, deadline }) {
  if (!aiClient) {
    throw new Error('AI service is not configured.');
  }

  const prompt = `
You are drafting a professional, respectful, and persuasive academic email from an Africa University student requesting a Letter of Recommendation.
Africa University is an elite Pan-African university in Zimbabwe.

Student Information:
- Student Name: ${studentName || 'Ashley Kanombirira'}
- Programme: ${studentProgramme || 'BSc Software Engineering'}
- Recipient / Faculty Member / Recommender: ${recipientName || 'Professor'}
- Purpose of Letter: ${purpose || 'Job / Internship / Scholarship Application'}
- Specific Notes / Highlights Student Wants Mentioned: ${notes || 'Highlighted performance in coursework and practical projects'}
- Deadline: ${deadline || 'Two weeks'}

Instructions:
1. Write a polite, articulate, and well-structured email.
2. Structure:
   - Respectful salutation (e.g. "Dear ${recipientName || 'Professor'},")
   - Clear statement of request and purpose.
   - Polite explanation of why the student is asking this specific recommender (referencing their mentorship or class).
   - Brief summary of what the student is sharing (grades, project portfolio).
   - Mention the target deadline respectfully.
   - Sincere expression of gratitude.
   - Professional closing with student's full name and programme.
3. Return ONLY the ready-to-send email body text without markdown backticks or extra preamble.
`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return { emailText: response.text ? response.text.trim() : '' };
}

module.exports = {
  generateRecommendationLetter,
  reviewPortfolio,
  improveProjectDescription,
  draftRequestEmail
};

