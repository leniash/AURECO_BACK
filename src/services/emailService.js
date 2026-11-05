const nodemailer = require('nodemailer');
const { query } = require('../config/db');

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER || 'mushayapokuvakat@africau.edu';
  const pass = process.env.SMTP_PASS || 'xqkzrnrpbmlqgrao';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }
  return null;
}

let transporter = getTransporter();

const RESEND_API_KEY = process.env.RESEND_API_KEY || (process.env.RESEND_KEY ? String(process.env.RESEND_KEY) : Buffer.from('cmVfSkFZU1VCbTVfSnBEQzJoYkFmRjRUcUdNZkVHV0x0QWJO', 'base64').toString('ascii'));

async function sendViaResend({ to, subject, html, text }) {
  const from = process.env.RESEND_FROM || 'Africa University <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || text,
      text: text || ''
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data && data.message) || `Resend API failed with status ${res.status}`);
  }
  return data;
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || '"Africa University Portfolios" <notifications@africau.edu>';
  const bodyText = text || html || '';

  console.log(`[EMAIL NOTIFICATION] To: ${to} | Subject: ${subject}`);

  let status = 'sent_mock';

  // 1. Try Resend HTTPS API (Port 443 - works everywhere including Render Free Tier)
  if (RESEND_API_KEY) {
    try {
      const resendResult = await sendViaResend({ to, subject, html, text: bodyText });
      status = 'sent (Resend ' + (resendResult.id || '') + ')';
      console.log(`[EMAIL RESEND] Successfully delivered to ${to} via HTTPS API! ID: ${resendResult.id}`);
    } catch (resendErr) {
      console.warn(`[EMAIL RESEND WARN] Resend dispatch note: ${resendErr.message}`);
      // Fallback to SMTP
      if (transporter) {
        try {
          await transporter.sendMail({ from, to, subject, html, text: bodyText });
          status = 'sent (SMTP)';
          console.log(`[EMAIL SMTP] Successfully sent to ${to}`);
        } catch (smtpErr) {
          status = 'failed: ' + resendErr.message;
          console.error(`[EMAIL ERROR] Both Resend & SMTP failed for ${to}:`, smtpErr.message);
        }
      } else {
        status = 'failed: ' + resendErr.message;
      }
    }
  } else if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, html, text: bodyText });
      status = 'sent (SMTP)';
      console.log(`[EMAIL SMTP] Successfully sent to ${to}`);
    } catch (err) {
      status = 'failed: ' + err.message;
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, err.message);
    }
  } else {
    console.log(`[EMAIL DISPATCH - SIMULATED] Content:\n${bodyText}`);
  }

  // Record in Neon database email_logs
  try {
    await query(
      'INSERT INTO email_logs (recipient, subject, body, status) VALUES ($1, $2, $3, $4)',
      [to, subject, bodyText, status]
    );
  } catch (e) {
    console.error('Failed to log email to database:', e.message);
  }

  return { success: true, status };
}

async function sendVerificationCode(email, code, stage) {
  const isEmailStage = stage === 'email';
  const subject = `Africa University: Your ${isEmailStage ? 'Email' : 'Phone'} Verification Code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0b1f3a; margin-top: 0;">Africa University</h2>
      <p>Hello,</p>
      <p>Your 6-digit verification code for the Student Portfolio System is:</p>
      <div style="background-color: #f1f5f9; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #1e3a8a; border-radius: 6px;">
        ${code}
      </div>
      <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
        This code is valid for 15 minutes. If you did not request this, please disregard this message.
      </p>
    </div>
  `;
  return sendEmail({ to: email, subject, html, text: `Your Africa University verification code is: ${code}` });
}

async function sendLetterRequestNotification(params, legacyStudentName, legacyPurpose) {
  let to, recipientName, studentName, studentProgramme, purpose, note, accessCode, token, isGuest;
  if (typeof params === 'object') {
    ({ to, recipientName, studentName, studentProgramme, purpose, note, accessCode, token, isGuest } = params);
  } else {
    to = params;
    studentName = legacyStudentName;
    purpose = legacyPurpose;
  }

  const feUrl = process.env.FRONTEND_URL || 'https://africa-university-student-recommendation-front.vercel.app';
  const targetLink = isGuest && token ? `${feUrl}/#/guest/letter/${token}` : `${feUrl}/#/login`;
  const subject = `Recommendation Letter Request: ${studentName || 'Student'}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
      <div style="border-bottom: 2px solid #c49a45; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="color: #0b1f3a; margin: 0; font-size: 20px;">Africa University</h2>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Official Recommendation Request</span>
      </div>

      <p style="font-size: 15px;">Dear ${recipientName || 'Colleague'},</p>
      <p style="font-size: 14px; line-height: 1.5;">
        <b>${studentName}</b> ${studentProgramme ? `(${studentProgramme})` : ''} has requested a Letter of Recommendation for <b>${purpose || 'Academic / Professional Application'}</b>.
      </p>

      ${note ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #c49a45; padding: 12px 16px; margin: 16px 0; font-size: 13px; font-style: italic; color: #334155;">
          "${note.replace(/\n/g, '<br>')}"
        </div>
      ` : ''}

      ${isGuest && accessCode ? `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
          <div style="font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 1px;">Your Secure One-Time Access Code</div>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1e3a8a; margin: 8px 0; font-family: monospace;">${accessCode}</div>
          <p style="margin: 0; font-size: 12px; color: #3b82f6;">No account needed. Use this code or click the direct button below to access the recommendation portal.</p>
        </div>
      ` : ''}

      <p style="font-size: 13px; color: #475569;">
        You can review the student's authorized portfolio records, academic results, and use the <b>Gemini AI Letter Assistant</b> to draft, sign, and certify your letter directly on the portal.
      </p>

      <div style="margin-top: 24px; text-align: center;">
        <a href="${targetLink}" style="background-color: #c49a45; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
          ${isGuest ? 'Open Guest Recommendation Portal' : 'Open Staff Portal'}
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; text-align: center;">
        Africa University, Mutare, Zimbabwe · Student Portfolio & Verified Credentials System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, html, text: `${studentName} requested a recommendation letter for ${purpose}. Open: ${targetLink}` });
}

async function sendVerificationRequestNotification({ to, verifierName, studentName, activityTitle, activityType, accessCode, token, isGuest }) {
  const feUrl = process.env.FRONTEND_URL || 'https://africa-university-student-recommendation-front.vercel.app';
  const targetLink = isGuest && token ? `${feUrl}/#/guest/verify/${token}` : `${feUrl}/#/login`;
  const subject = `Activity Verification Request: ${studentName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
      <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="color: #0b1f3a; margin: 0; font-size: 20px;">Africa University</h2>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Credential & Activity Verification</span>
      </div>

      <p style="font-size: 15px;">Dear ${verifierName || 'Colleague'},</p>
      <p style="font-size: 14px; line-height: 1.5;">
        <b>${studentName}</b> has requested that you verify the following achievement/activity for their official university portfolio:
      </p>

      <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #1e293b;">
        <b>${activityTitle}</b> (${activityType || 'Extracurricular / Project'})
      </div>

      ${isGuest && accessCode ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
          <div style="font-size: 12px; font-weight: bold; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">Your One-Time Access Code</div>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #047857; margin: 8px 0; font-family: monospace;">${accessCode}</div>
          <p style="margin: 0; font-size: 12px; color: #059669;">Use this code or click the button below to verify this student record.</p>
        </div>
      ` : ''}

      <div style="margin-top: 24px; text-align: center;">
        <a href="${targetLink}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
          ${isGuest ? 'Review & Verify Activity' : 'Open Staff Portal'}
        </a>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html, text: `${studentName} requested verification for ${activityTitle}. Open: ${targetLink}` });
}

async function sendLetterReadyNotification(studentEmail, studentName, lecturerName) {
  const subject = `Your Letter of Recommendation is Ready!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0b1f3a; margin-top: 0;">Africa University</h2>
      <p>Dear ${studentName},</p>
      <p><b>${lecturerName}</b> has completed and submitted your letter of recommendation.</p>
      <p>You can now download and view the certified letter from your Student Portfolio account.</p>
    </div>
  `;
  return sendEmail({ to: studentEmail, subject, html, text: `${lecturerName} has completed your letter of recommendation.` });
}

async function sendAccountApprovedNotification(studentEmail, studentName) {
  const subject = `Africa University Portfolio: Account Approved!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0b1f3a; margin-top: 0;">Welcome to Africa University Portfolio</h2>
      <p>Dear ${studentName},</p>
      <p>Your student registration has been verified and approved by the registry administrator. You can now sign in to your portfolio.</p>
    </div>
  `;
  return sendEmail({ to: studentEmail, subject, html, text: `Your student account has been approved.` });
}

module.exports = {
  sendEmail,
  sendVerificationCode,
  sendLetterRequestNotification,
  sendVerificationRequestNotification,
  sendLetterReadyNotification,
  sendAccountApprovedNotification
};
