const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'cityguide_secret_key_2024';
const JWT_EXPIRY = '7d';
const MONGO_URI = process.env.MONGO_URI;

// Import Models
const User = require('./models/User');
const Place = require('./models/Place');
const Favorite = require('./models/Favorite');
const PlaceSubmission = require('./models/PlaceSubmission');
const PlaceUpdate = require('./models/PlaceUpdate');
const Review = require('./models/Review');

// Import Email Service
const { sendOTPEmail } = require('./utils/emailService');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'place-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Multer error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next(error);
});

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
  })
  .catch((error) => {
    console.error('❌ MongoDB Connection Error:', error.message);
  });

// ============================================
// JWT MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is banned
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.isActive === false) {
      console.log(`🚫 Banned user attempted access: ${user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned. Please contact support.'
      });
    }
    
    req.user = decoded;
    console.log(`✅ Token verified for user: ${decoded.email}`);
    next();
  } catch (error) {
    console.log('❌ Invalid token:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Admin middleware
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CityGuide API is running!',
    timestamp: new Date().toISOString()
  });
});

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// OTP VERIFICATION ENDPOINTS
// ============================================

// Send OTP (Modified Register)
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
    const bcrypt = require('bcryptjs');
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

// Verify OTP
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
    const bcrypt = require('bcryptjs');
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

// Resend OTP
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
    const bcrypt = require('bcryptjs');
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

// Register (Keep for backward compatibility or direct registration without OTP)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    console.log('📝 Registration attempt:', email);
    
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
    
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password
    });
    
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
    
    console.log('✅ User registered successfully:', user.email);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Verify password using model method
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if email is verified (skip for admin users)
    // Admin users created via script don't need email verification
    if (user.role !== 'admin' && user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. Check your inbox for the OTP.'
      });
    }
    
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
    
    console.log('✅ User logged in successfully:', user.email);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Verify token (optional - for session restoration)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Token validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// PROTECTED ROUTES (Require Authentication)
// ============================================

// Get cities
app.get('/api/cities', authenticateToken, async (req, res) => {
  try {
    console.log('📍 Cities requested by:', req.user.email);
    
    // Get distinct cities from places collection
    const cities = await Place.distinct('city');
    
    res.json({
      success: true,
      data: cities.sort()
    });
  } catch (error) {
    console.error('❌ Get cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get places
app.get('/api/places', authenticateToken, async (req, res) => {
  try {
    const { city, page = 1, limit = 10, sort = 'rating' } = req.query;
    console.log(`🏙️ Places requested for ${city} by:`, req.user.email);
    
    // Build query
    const query = city ? { city } : {};
    
    // Build sort object
    const sortObj = {};
    sortObj[sort] = -1; // Descending order
    
    // Get places from database
    const places = await Place.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalPlaces = await Place.countDocuments(query);
    const totalPages = Math.ceil(totalPlaces / parseInt(limit));
    
    console.log(`✅ Found ${places.length} places for ${city || 'all cities'}`);
    
    res.json({
      success: true,
      data: places,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalPlaces,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('❌ Get places error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Search places
app.get('/api/places/search', authenticateToken, async (req, res) => {
  try {
    const { keyword, city, minRating, page = 1, limit = 10, sort = 'rating' } = req.query;
    console.log(`🔍 Search for "${keyword}" in ${city || 'all cities'} with minRating ${minRating || 'any'} sorted by ${sort} by:`, req.user.email);
    
    // Build query
    const query = {
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ]
    };
    
    // Filter by city if provided
    if (city) {
      query.city = city;
    }
    
    // Filter by minimum rating if provided
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sort] = -1; // Descending order
    
    // Get paginated results
    const searchResults = await Place.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalResults = await Place.countDocuments(query);
    const totalPages = Math.ceil(totalResults / parseInt(limit));
    
    console.log(`✅ Found ${searchResults.length} results (page ${page}/${totalPages}) for "${keyword}"`);
    
    res.json({
      success: true,
      data: searchResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalResults,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get place by ID
app.get('/api/places/:id', authenticateToken, async (req, res) => {
  try {
    const placeId = req.params.id;
    console.log(`📍 Place ${placeId} requested by:`, req.user.email);
    
    const place = await Place.findById(placeId);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    res.json({
      success: true,
      data: place
    });
  } catch (error) {
    console.error('❌ Get place error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    console.log('❤️ Favorites requested by:', req.user.email);
    
    const favorites = await Favorite.find({ userId: req.user.userId })
      .populate('placeId');
    
    // Map to include place details
    const favoritesWithDetails = favorites.map(fav => ({
      favoriteId: fav._id,
      _id: fav.placeId._id,
      name: fav.placeId.name,
      category: fav.placeId.category,
      city: fav.placeId.city,
      rating: fav.placeId.rating,
      description: fav.placeId.description,
      image: fav.placeId.image,
      createdAt: fav.createdAt
    }));
    
    res.json({
      success: true,
      data: favoritesWithDetails
    });
  } catch (error) {
    console.error('❌ Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Add to favorites
app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { placeId } = req.body;
    console.log(`❤️ Add favorite ${placeId} by:`, req.user.email);
    
    // Check if place exists
    const place = await Place.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    // Check if already favorited
    const existingFavorite = await Favorite.findOne({
      userId: req.user.userId,
      placeId: placeId
    });
    
    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: 'Place already in favorites'
      });
    }
    
    // Create favorite
    const favorite = await Favorite.create({
      userId: req.user.userId,
      placeId: placeId
    });
    
    console.log(`✅ Added ${place.name} to favorites`);
    
    res.json({
      success: true,
      message: 'Added to favorites',
      data: {
        _id: favorite._id,
        userId: req.user.userId,
        placeId: placeId
      }
    });
  } catch (error) {
    console.error('❌ Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Remove from favorites
app.delete('/api/favorites/:id', authenticateToken, async (req, res) => {
  try {
    const favoriteId = req.params.id;
    console.log(`💔 Remove favorite ${favoriteId} by:`, req.user.email);
    
    const favorite = await Favorite.findOneAndDelete({
      _id: favoriteId,
      userId: req.user.userId
    });
    
    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('❌ Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// IMAGE UPLOAD ROUTES
// ============================================

// Upload image endpoint
app.post('/api/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log('📤 Image upload request received from:', req.user.email);
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    console.log('📁 File details:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    // Generate the URL for the uploaded image
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    console.log('✅ Image uploaded successfully:', imageUrl);
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading image'
    });
  }
});

// ============================================
// PLACE SUBMISSION ROUTES
// ============================================

// Submit a new place
app.post('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const { name, category, city, description, address, image, contactNumber, website, noteForAdmin } = req.body;
    
    console.log('📝 Place submission by:', req.user.email);
    
    // Validation
    if (!name || !category || !city || !description || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    const submission = await PlaceSubmission.create({
      name,
      category,
      city,
      description,
      address,
      image: image || 'https://via.placeholder.com/400x300?text=Place+Image',
      contactNumber,
      website,
      noteForAdmin,
      submittedBy: req.user.userId,
      status: 'pending'
    });
    
    console.log('✅ Place submitted successfully:', submission.name);
    
    res.status(201).json({
      success: true,
      message: 'Place submitted successfully. Awaiting admin approval.',
      data: submission
    });
  } catch (error) {
    console.error('❌ Place submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's submissions
app.get('/api/submissions/my', authenticateToken, async (req, res) => {
  try {
    console.log('📋 User submissions requested by:', req.user.email);
    
    const submissions = await PlaceSubmission.find({ submittedBy: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get available cities for submission
app.get('/api/submissions/cities', authenticateToken, async (req, res) => {
  try {
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'];
    
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('❌ Get cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    console.log('👥 Admin users list requested by:', req.user.email);
    
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user status (Admin only)
app.patch('/api/admin/users/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { isActive, role } = req.body;
    console.log(`👤 Admin updating user ${req.params.id} by:`, req.user.email);
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive, role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    console.log(`🗑️ Admin deleting user ${req.params.id} by:`, req.user.email);
    
    // Prevent deleting yourself
    if (req.params.id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Also delete user's submissions and favorites
    await PlaceSubmission.deleteMany({ submittedBy: req.params.id });
    await Favorite.deleteMany({ userId: req.params.id });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all place submissions (Admin only)
app.get('/api/admin/submissions', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    console.log('📋 Admin submissions list requested by:', req.user.email);
    
    const query = status ? { status } : {};
    const submissions = await PlaceSubmission.find(query)
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Review place submission (Admin only)
app.patch('/api/admin/submissions/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    console.log(`📝 Admin reviewing submission ${req.params.id} by:`, req.user.email);
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected.'
      });
    }
    
    const submission = await PlaceSubmission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes,
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('submittedBy', 'name email');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // If approved, create the place
    if (status === 'approved') {
      await Place.create({
        name: submission.name,
        category: submission.category,
        city: submission.city,
        rating: 0, // No rating until first review
        description: submission.description,
        image: submission.image,
        address: submission.address,
        contactNumber: submission.contactNumber,
        website: submission.website,
        ownerId: submission.submittedBy, // Set owner
        totalReviews: 0,
        averageRating: 0 // No rating until first review
      });
      console.log('✅ Place approved and added to database:', submission.name);
    }
    
    res.json({
      success: true,
      message: `Submission ${status} successfully`,
      data: submission
    });
  } catch (error) {
    console.error('❌ Review submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get admin dashboard stats
app.get('/api/admin/stats', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    console.log('📊 Admin stats requested by:', req.user.email);
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const bannedUsers = await User.countDocuments({ isActive: false });
    const totalPlaces = await Place.countDocuments();
    const pendingSubmissions = await PlaceSubmission.countDocuments({ status: 'pending' });
    const approvedSubmissions = await PlaceSubmission.countDocuments({ status: 'approved' });
    const rejectedSubmissions = await PlaceSubmission.countDocuments({ status: 'rejected' });
    const pendingUpdates = await PlaceUpdate.countDocuments({ status: 'pending' });
    
    // Get places by category
    const placesByCategory = await Place.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get places by city
    const placesByCity = await Place.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalPlaces,
        pendingSubmissions,
        approvedSubmissions,
        rejectedSubmissions,
        pendingUpdates,
        placesByCategory,
        placesByCity
      }
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all place update requests (Admin only)
app.get('/api/admin/updates', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    console.log('📝 Admin update requests list by:', req.user.email);
    
    const query = status ? { status } : {};
    const updates = await PlaceUpdate.find(query)
      .populate('submittedBy', 'name email')
      .populate('placeId')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: updates
    });
  } catch (error) {
    console.error('❌ Get updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Review place update request (Admin only)
app.patch('/api/admin/updates/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    console.log(`📝 Admin reviewing update ${req.params.id} by:`, req.user.email);
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected.'
      });
    }
    
    const updateRequest = await PlaceUpdate.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes,
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('placeId');
    
    if (!updateRequest) {
      return res.status(404).json({
        success: false,
        message: 'Update request not found'
      });
    }
    
    // If approved, apply the updates to the place
    if (status === 'approved') {
      const place = await Place.findById(updateRequest.placeId);
      if (place) {
        if (updateRequest.updates.name) place.name = updateRequest.updates.name;
        if (updateRequest.updates.category) place.category = updateRequest.updates.category;
        if (updateRequest.updates.description) place.description = updateRequest.updates.description;
        if (updateRequest.updates.image) place.image = updateRequest.updates.image;
        if (updateRequest.updates.address !== undefined) place.address = updateRequest.updates.address;
        if (updateRequest.updates.contactNumber !== undefined) place.contactNumber = updateRequest.updates.contactNumber;
        if (updateRequest.updates.website !== undefined) place.website = updateRequest.updates.website;
        
        await place.save();
        console.log('✅ Place updated successfully:', place.name);
      }
    }
    
    res.json({
      success: true,
      message: `Update request ${status} successfully`,
      data: updateRequest
    });
  } catch (error) {
    console.error('❌ Review update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all places (Admin only)
app.get('/api/admin/places', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    console.log('🏙️ Admin places list requested by:', req.user.email);
    
    const { city, category } = req.query;
    
    // Build query
    const query = {};
    if (city && city !== 'all') {
      query.city = city;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const places = await Place.find(query)
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: places
    });
  } catch (error) {
    console.error('❌ Get places error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete place (Admin only)
app.delete('/api/admin/places/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    console.log(`🗑️ Admin deleting place ${req.params.id} by:`, req.user.email);
    
    const place = await Place.findByIdAndDelete(req.params.id);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    // Also delete related favorites
    await Favorite.deleteMany({ placeId: req.params.id });
    
    // Also delete related reviews
    await Review.deleteMany({ placeId: req.params.id });
    
    res.json({
      success: true,
      message: 'Place deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete place error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// USER PROPERTY ROUTES (My Places)
// ============================================

// Get user's owned places (approved submissions)
app.get('/api/my-places', authenticateToken, async (req, res) => {
  try {
    console.log('🏠 My places requested by:', req.user.email);
    
    const myPlaces = await Place.find({ ownerId: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: myPlaces
    });
  } catch (error) {
    console.error('❌ Get my places error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user's place
app.patch('/api/my-places/:id', authenticateToken, async (req, res) => {
  try {
    const { name, category, description, image } = req.body;
    console.log(`✏️ Update request for place ${req.params.id} by:`, req.user.email);
    
    const place = await Place.findOne({
      _id: req.params.id,
      ownerId: req.user.userId
    });
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found or you do not have permission to edit'
      });
    }
    
    // Create update request instead of directly updating
    const updateRequest = await PlaceUpdate.create({
      placeId: req.params.id,
      placeName: place.name,
      submittedBy: req.user.userId,
      updates: {
        name: name || place.name,
        category: category || place.category,
        description: description || place.description,
        image: image || place.image
      },
      status: 'pending'
    });
    
    console.log('✅ Update request submitted for admin approval');
    
    res.json({
      success: true,
      message: 'Update request submitted for admin approval',
      data: updateRequest
    });
  } catch (error) {
    console.error('❌ Update place error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's update requests
app.get('/api/my-updates', authenticateToken, async (req, res) => {
  try {
    console.log('📝 My update requests by:', req.user.email);
    
    const updates = await PlaceUpdate.find({ submittedBy: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: updates
    });
  } catch (error) {
    console.error('❌ Get updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// REVIEW ROUTES
// ============================================

// Add review to a place
app.post('/api/places/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const placeId = req.params.id;
    
    console.log(`⭐ Add review to place ${placeId} by:`, req.user.email);
    
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const place = await Place.findById(placeId);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    // Check if user already reviewed
    const existingReview = await Review.findOne({
      placeId: placeId,
      userId: req.user.userId
    });
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this place'
      });
    }
    
    // Get user info
    const user = await User.findById(req.user.userId);
    
    // Create review
    const review = await Review.create({
      placeId: placeId,
      userId: req.user.userId,
      userName: user.name,
      rating: parseInt(rating),
      comment: comment.trim()
    });
    
    // Update place statistics
    const allReviews = await Review.find({ placeId: placeId });
    place.totalReviews = allReviews.length;
    const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
    place.averageRating = totalRating / place.totalReviews;
    place.rating = place.averageRating; // Update main rating field
    
    await place.save();
    
    console.log('✅ Review added successfully');
    
    // Return place with reviews for backward compatibility
    const reviews = await Review.find({ placeId: placeId }).sort({ createdAt: -1 });
    const placeData = place.toObject();
    placeData.reviews = reviews;
    
    res.json({
      success: true,
      message: 'Review added successfully',
      data: placeData
    });
  } catch (error) {
    console.error('❌ Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get reviews for a place
app.get('/api/places/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    // Get reviews from Review collection
    const reviews = await Review.find({ placeId: req.params.id }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        reviews: reviews,
        totalReviews: place.totalReviews,
        averageRating: place.averageRating
      }
    });
  } catch (error) {
    console.error('❌ Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Owner reply to review
app.post('/api/places/:placeId/reviews/:reviewId/reply', authenticateToken, async (req, res) => {
  try {
    const { placeId, reviewId } = req.params;
    const { reply } = req.body;
    
    console.log(`💬 Owner reply to review ${reviewId} on place ${placeId} by:`, req.user.email);
    
    if (!reply || reply.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required'
      });
    }
    
    const place = await Place.findById(placeId);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }
    
    // Check if user is the owner
    if (place.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the place owner can reply to reviews'
      });
    }
    
    // Find the review in Review collection
    const review = await Review.findOne({
      _id: reviewId,
      placeId: placeId
    });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Add or update reply
    review.ownerReply = reply.trim();
    review.ownerReplyAt = new Date();
    
    await review.save();
    
    console.log('✅ Owner reply added successfully');
    
    // Return place with reviews for backward compatibility
    const reviews = await Review.find({ placeId: placeId }).sort({ createdAt: -1 });
    const placeData = place.toObject();
    placeData.reviews = reviews;
    
    res.json({
      success: true,
      message: 'Reply added successfully',
      data: placeData
    });
  } catch (error) {
    console.error('❌ Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Owner delete their place
app.delete('/api/my-places/:id', authenticateToken, async (req, res) => {
  try {
    const placeId = req.params.id;
    console.log(`🗑️ Owner deleting place ${placeId} by:`, req.user.email);
    
    const place = await Place.findOne({
      _id: placeId,
      ownerId: req.user.userId
    });
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found or you do not have permission to delete'
      });
    }
    
    // Delete the place
    await Place.findByIdAndDelete(placeId);
    
    // Also delete related favorites
    await Favorite.deleteMany({ placeId: placeId });
    
    // Also delete related reviews
    await Review.deleteMany({ placeId: placeId });
    
    console.log('✅ Place deleted successfully by owner');
    
    res.json({
      success: true,
      message: 'Place deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete place error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log('='.repeat(50));
  console.log('🚀 CityGuide Production Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 JWT Authentication: ENABLED`);
  console.log(`⏰ Token Expiry: ${JWT_EXPIRY}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  console.log('');
  
  // Show database stats
  try {
    const userCount = await User.countDocuments();
    const placeCount = await Place.countDocuments();
    const favoriteCount = await Favorite.countDocuments();
    
    console.log('📊 Database Statistics:');
    console.log(`👥 Registered Users: ${userCount}`);
    console.log(`🏙️  Total Places: ${placeCount}`);
    console.log(`❤️  Total Favorites: ${favoriteCount}`);
  } catch (error) {
    console.log('⚠️  Could not fetch database statistics');
  }
  
  console.log('');
  console.log('Ready to accept requests! 🎉');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
