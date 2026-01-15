const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Check if using SendGrid
const useSendGrid = process.env.SENDGRID_API_KEY && 
                    process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key' &&
                    process.env.SENDGRID_API_KEY.startsWith('SG.');

// Debug logging
console.log('🔍 SendGrid Configuration Check:');
console.log('  SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
console.log('  SENDGRID_API_KEY value:', process.env.SENDGRID_API_KEY ? `${process.env.SENDGRID_API_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('  SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
console.log('  useSendGrid:', useSendGrid);

// Create email transporter (for Gmail fallback)
const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  return transporter;
};

// Send OTP email
const sendOTPEmail = async (email, name, otp) => {
  try {
    // ALWAYS log OTP to console for easy testing
    console.log('\n' + '='.repeat(60));
    console.log('📧 OTP EMAIL');
    console.log('='.repeat(60));
    console.log(`👤 To: ${email}`);
    console.log(`📝 Name: ${name}`);
    console.log(`🔐 OTP Code: ${otp}`);
    console.log(`⏰ Expires: 10 minutes`);
    console.log('='.repeat(60) + '\n');
    
    // HTML email template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .otp-box {
            background: white;
            border: 2px dashed #667eea;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            border-radius: 10px;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏙️ CityGuide</h1>
            <p>Welcome to CityGuide!</p>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with CityGuide. To complete your registration, please verify your email address.</p>
            
            <p>Your verification code is:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <p>If you didn't request this code, please ignore this email.</p>
            
            <p>Best regards,<br>The CityGuide Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2026 CityGuide. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Check if using SendGrid
    if (useSendGrid) {
      console.log('📧 Using SendGrid for email delivery');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER,
        subject: 'Verify Your CityGuide Account',
        html: htmlTemplate
      };
      
      await sgMail.send(msg);
      console.log('✅ Email sent via SendGrid to:', email);
      return { success: true, messageId: 'sendgrid-' + Date.now() };
    }
    
    // DEVELOPMENT MODE: Only log to console, don't send email
    const isDevelopment = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com';
    
    if (isDevelopment) {
      console.log('📧 DEVELOPMENT MODE - Email not sent (console only)');
      return { success: true, messageId: 'dev-mode-' + Date.now() };
    }
    
    // GMAIL FALLBACK: Send actual email via Gmail (for local development)
    console.log('📧 Using Gmail for email delivery');
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"CityGuide" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your CityGuide Account',
      html: htmlTemplate
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent via Gmail:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Failed to send email');
  }
};

module.exports = {
  sendOTPEmail
};
