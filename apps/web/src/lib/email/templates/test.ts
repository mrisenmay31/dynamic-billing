export function testEmailHtml(): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #2D6A4F;">Dynamic Billing — Test Email</h2>
      <p>This is a test email confirming that Resend is correctly configured for the Dynamic Billing app.</p>
      <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
    </div>
  `
}
