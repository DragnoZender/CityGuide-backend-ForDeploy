// ============================================
// OTP VERIFICATION ENDPOINTS
// Add these to production-server.js after the health check endpoint
// ============================================

const bcrypt = require('bcryptjs');

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// 1. SEND OTP (Modified Register)
// ============================================
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    console.log('📧 OTP request for:', email);
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Check if user already exists and is verified
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Hash OTP before storing
    const hashedOTP = await bcrypt.hash(otp, 10);
    
    if (existingUser && !existingUser.isEmailVerified) {
      // Update existing unverified user
      existingUser.name = name;
      existingUser.password = password; // Will be hashed by pre-save hook
      existingUser.otp = hashedOTP;
      existingUser.otpExpiry = otpExpiry;
      existingUser.otpAttempts = 0;
      await existingUser.save();
      
      console.log('🔄 Updated existing unverified user:', email);
    } else {
      // Create new user (unverified)
      await User.create({
        name,
        email: email.toLowerCase(),
        password, // Will be hashed by pre-save hook
        otp: hashedOTP,
        otpExpiry,
        otpAttempts: 0,
        isEmailVerified: false
      });
      
      console.log('✅ Created new unverified user:', email);
    }
    
    // Send OTP email
    try {
      await sendOTPEmail(email, name, otp);
      console.log('📧 OTP sent successfully to:', email);
      
      res.status(200).json({
        success: true,
        message: 'OTP sent to your email. Please verify to complete registration.',
        email: email
      });
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      
      // Delete the user if email fails
      await User.deleteOne({ email: email.toLowerCase(), isEmailVerified: false });
      
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please check your email address and try again.'
      });
    }
    
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// 2. VERIFY OTP
// ============================================
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    console.log('🔐 OTP verification attempt for:', email);
    
    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and OTP'
      });
    }
    
    if (otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be 6 digits'
      });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified. Please login.'
      });
    }
    
    // Check if OTP exists
    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new OTP.'
      });
    }
    
    // Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }
    
    // Check attempts
    if (user.otpAttempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }
    
    // Verify OTP
    const isOTPValid = await bcrypt.compare(otp, user.otp);
    
    if (!isOTPValid) {
      // Increment attempts
      user.otpAttempts += 1;
      await user.save();
      
      const remainingAttempts = 3 - user.otpAttempts;
      
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
      });
    }
    
    // OTP is valid - verify user
    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    console.log('✅ Email verified successfully:', user.email);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      }
    });
    
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// 3. RESEND OTP
// ============================================
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔄 Resend OTP request for:', email);
    
    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified. Please login.'
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Hash OTP
    const hashedOTP = await bcrypt.hash(otp, 10);
    
    // Update user
    user.otp = hashedOTP;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await user.save();
    
    // Send OTP email
    try {
      await sendOTPEmail(email, user.name, otp);
      console.log('📧 OTP resent successfully to:', email);
      
      res.status(200).json({
        success: true,
        message: 'New OTP sent to your email'
      });
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      });
    }
    
  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// KEEP THE EXISTING LOGIN ENDPOINT AS IS
// Just add a check for email verification
// ============================================
