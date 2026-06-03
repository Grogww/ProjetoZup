const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;
const APP_NAME = process.env.APP_NAME || 'ProjetoZup';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_RESET_PATH = process.env.FRONTEND_RESET_PATH || '/reset-password';

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured to send emails');
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return cachedTransporter;
};

const buildResetLink = (token) => {
  const base = FRONTEND_URL.replace(/\/$/, '');
  const path = FRONTEND_RESET_PATH.startsWith('/')
    ? FRONTEND_RESET_PATH
    : `/${FRONTEND_RESET_PATH}`;
  return `${base}${path}?token=${encodeURIComponent(token)}`;
};

const sendPasswordResetEmail = async ({ to, name, token, expiresInMinutes }) => {
  const transporter = getTransporter();
  const resetLink = buildResetLink(token);

  const subject = `${APP_NAME} - Recuperação de senha`;
  const text = [
    `Olá${name ? `, ${name}` : ''}!`,
    '',
    `Recebemos uma solicitação para redefinir a senha da sua conta no ${APP_NAME}.`,
    `Para criar uma nova senha, acesse o link abaixo (válido por ${expiresInMinutes} minutos):`,
    '',
    resetLink,
    '',
    'Se você não solicitou esta alteração, ignore esta mensagem — sua senha permanecerá a mesma.',
  ].join('\n');

  const html = `
    <p>Olá${name ? `, <strong>${name}</strong>` : ''}!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${APP_NAME}</strong>.</p>
    <p>Para criar uma nova senha, clique no link abaixo (válido por <strong>${expiresInMinutes} minutos</strong>):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>Se você não solicitou esta alteração, ignore esta mensagem — sua senha permanecerá a mesma.</p>
  `;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};

module.exports = { sendPasswordResetEmail };
