const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

/**
 * Determine if SendGrid should be used
 */
const useSendGrid =
  !!process.env.SENDGRID_API_KEY &&
  process.env.SENDGRID_API_KEY.startsWith('SG.') &&
  !!process.env.SENDGRID_FROM_EMAIL;

/**
 * Debug info
 */
console.log('🔍 Email Configuration Check');
console.log('  useSendGrid:', useSendGrid);
console.log('  SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');
console.log('  SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
console.log('  EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');

/**
 * Gmail transporter (LOCAL DEV ONLY)
 */
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send OTP Email
 */
const sendOTPEmail = async (email, name, otp) => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📧 OTP EMAIL');
    console.log('='.repeat(60));
    console.log(`👤 To: ${email}`);
    console.log(`📝 Name: ${name}`);
    console.log(`🔐 OTP Code: ${otp}`);
    console.log(`⏰ Expires: 10 minutes`);
    console.log('='.repeat(60) + '\n');

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px;">
          <div style="background:#667eea; color:white; padding:20px; text-align:center;">
            <h1>🏙️ CityGuide</h1>
            <p>Email Verification</p>
          </div>
          <div style="padding:30px;">
            <h2>Hello ${name},</h2>
            <p>Your OTP code is:</p>
            <div style="font-size:32px; font-weight:bold; letter-spacing:6px; text-align:center;">
              ${otp}
            </div>
            <p>This code is valid for 10 minutes.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    /**
     * SENDGRID (PRODUCTION)
     */
    if (useSendGrid) {
      console.log('📧 Sending via SendGrid');

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL.trim(), // MUST be VERIFIED
        subject: 'Verify Your CityGuide Account',
        text: `Your OTP is ${otp}. It expires in 10 minutes.`,
        html: htmlTemplate,
      };

      await sgMail.send(msg);
      console.log('✅ Email sent via SendGrid');
      return { success: true, provider: 'sendgrid' };
    }

    /**
     * DEV MODE (NO EMAIL)
     */
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️ DEV MODE: Email not sent');
      return { success: true, provider: 'dev-console' };
    }

    /**
     * GMAIL (LOCAL DEV ONLY)
     */
    console.log('📧 Sending via Gmail (DEV ONLY)');
    const transporter = createGmailTransporter();

    await transporter.sendMail({
      from: `"CityGuide" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your CityGuide Account',
      html: htmlTemplate,
    });

    console.log('✅ Email sent via Gmail');
    return { success: true, provider: 'gmail' };

  } catch (error) {
    console.error('❌ Email sending failed');

    // 🔥 THIS IS THE MOST IMPORTANT PART
    if (error.response?.body?.errors) {
      error.response.body.errors.forEach((err, index) => {
        console.error(`❌ SendGrid Error ${index + 1}:`);
        console.error('   Message:', err.message);
        console.error('   Field:', err.field);
        console.error('   Help:', err.help);
      });
    } else {
      console.error(error);
    }

    throw new Error('Failed to send OTP email');
  }
};

module.exports = { sendOTPEmail };
