const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
    index: true,
  },
  seatNumber: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'locked', 'booked'],
    default: 'available',
    index: true,
  },
  lockedBy: {
    type: String,
    default: null,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  lockExpiry: {
    type: Date,
    default: null,
  },
  bookedBy: {
    type: String,
    default: null,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
  bookedAt: {
    type: Date,
    default: null,
  },
  price: {
    type: Number,
    required: true,
    default: 100,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index for show and seat number for uniqueness
seatSchema.index({ showId: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model('Seat', seatSchema);
