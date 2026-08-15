// Envia e-mail via SMTP (nodemailer). Se o SMTP não estiver configurado,
// o link de redefinição é impresso no console do servidor (modo desenvolvimento).
const nodemailer = require('nodemailer');

function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function enviarEmail({ to, subject, text, html }) {
  if (!smtpConfigurado()) {
    console.log('\n[mailer] SMTP não configurado — e-mail NÃO enviado.');
    console.log('[mailer] Destinatário:', to);
    console.log('[mailer] Assunto:', subject);
    console.log('[mailer] Conteúdo:\n' + (text || html) + '\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { enviarEmail, smtpConfigurado };
