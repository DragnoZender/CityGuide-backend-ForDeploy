const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Place',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  ownerReply: {
    type: String,
    default: null
  },
  ownerReplyAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reviews from same user for same place
reviewSchema.index({ placeId: 1, userId: 1 }, { unique: true });

// Index for efficient queries
reviewSchema.index({ placeId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
