const mongoose = require('mongoose');

const placeSubmissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Place name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    enum: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  address: {
    type: String,
    required: [true, 'Address is required']
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/400x300?text=Place+Image'
  },
  contactNumber: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  noteForAdmin: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PlaceSubmission', placeSubmissionSchema);
