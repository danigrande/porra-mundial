import axios from 'axios';
let sendEmailFn = null;
let emailConfigured = false;

async function initEmail() {
  if (emailConfigured || sendEmailFn) return;

  if (process.env.BREVO_API_KEY && process.env.FROM_EMAIL) {
    const key = process.env.BREVO_API_KEY.trim();
    const headers = {
      'Content-Type': 'application/json',
      'api-key': key,
    };

    sendEmailFn = async ({ to, subject, html }) => {
      await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { email: process.env.FROM_EMAIL, name: 'Predicción Mundial' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }, {
        headers,
        timeout: 15000,
      });
    };
    emailConfigured = true;
    console.log('📧 Email service: Brevo API');
  } else {
    console.log('📧 Email service: not configured — will use admin-contact fallback');
  }
}

export async function sendResetCode(email, code) {
  await initEmail();
  if (!sendEmailFn) throw new Error('EMAIL_NOT_CONFIGURED');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0e27; color: #fff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🏆</span>
        <h1 style="color: #f5a623; margin: 8px 0;">Predicción Mundial</h1>
      </div>
      <h2 style="color: #fff;">Recuperación de contraseña</h2>
      <p style="color: #94a3b8;">Usa el siguiente código para restablecer tu contraseña. Expira en 1 hora.</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 16px 32px; border-radius: 12px;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 12px;">Si no solicitaste este cambio, ignora este mensaje.</p>
      <hr style="border-color: #1e2a5a; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 11px; text-align: center;">Predicción Mundial 2026 — Pronósticos entre amigos</p>
    </div>
  `;

  await sendEmailFn({ to: email, subject: 'Código de recuperación — Predicción Mundial', html });
}

export function isEmailConfigured() {
  return emailConfigured;
}

export async function ensureInit() {
  await initEmail();
}
