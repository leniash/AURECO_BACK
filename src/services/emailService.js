const nodemailer = require('nodemailer');
const { query } = require('../config/db');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || '"Africa University Portfolios" <notifications@africau.edu>';
  const bodyText = text || html || '';

  console.log(`[EMAIL NOTIFICATION] To: ${to} | Subject: ${subject}`);

  let status = 'sent_mock';
  if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, html, text: bodyText });
      status = 'sent';
      console.log(`[EMAIL] Successfully sent to ${to}`);
    } catch (err) {
      status = 'failed: ' + err.message;
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, err.message);
    }
  } else {
    console.log(`[EMAIL DISPATCH - SIMULATED (Configure SMTP for production)] Content:\n${bodyText}`);
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

async function sendLetterRequestNotification(lecturerEmail, studentName, purpose) {
  const subject = `Recommendation Letter Request: ${studentName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0b1f3a; margin-top: 0;">Africa University Staff Portal</h2>
      <p>Dear Colleague,</p>
      <p><b>${studentName}</b> has requested a letter of recommendation for <b>${purpose}</b>.</p>
      <p>You can review their academic grades, completed projects, verified achievements, and use the AI recommendation assistant to draft your letter via the staff portal.</p>
      <p style="margin-top: 24px;">
        <a href="${process.env.FRONTEND_URL || 'https://africa-university-portfolio.vercel.app'}" style="background-color: #c49a45; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold;">Open Staff Portal</a>
      </p>
    </div>
  `;
  return sendEmail({ to: lecturerEmail, subject, html, text: `${studentName} requested a recommendation letter for ${purpose}.` });
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
  sendLetterReadyNotification,
  sendAccountApprovedNotification
};
