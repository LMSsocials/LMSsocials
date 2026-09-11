import { Resend } from 'resend'

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function sendPasswordResetEmail({ email, name, resetUrl }) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

  const resend = new Resend(process.env.RESEND_API_KEY)
  const safeName = escapeHtml(name || 'there')
  const safeUrl = escapeHtml(resetUrl)
  const { error } = await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM || 'LMS Socials <support@lmssocials.com>',
    to: email,
    subject: 'Reset your LMS Socials password',
    html: `
      <div style="background:#f4f0e8;padding:40px 16px;font-family:Arial,sans-serif;color:#292927">
        <div style="max-width:560px;margin:0 auto;background:#fffaf1;border-radius:20px;padding:36px">
          <p style="margin:0 0 12px;color:#e84e54;font-size:12px;font-weight:700;letter-spacing:1.2px">LMS SOCIALS</p>
          <h1 style="margin:0 0 18px;font-size:28px">Reset your password</h1>
          <p style="font-size:15px;line-height:1.6">Hi ${safeName}, we received a request to reset your LMS Socials password.</p>
          <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 20px;border-radius:12px;background:#ff5d62;color:#fff;text-decoration:none;font-weight:700">Choose a new password</a></p>
          <p style="color:#77716a;font-size:13px;line-height:1.6">This link expires in 30 minutes and can only be used once. If you did not request it, you can safely ignore this email.</p>
        </div>
      </div>`,
  })

  if (error) throw new Error(error.message || 'Password reset email could not be sent')
}
