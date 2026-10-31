const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  seats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seat',
  }],
  seatNumbers: [{
    type: String,
  }],
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  transactionId: {
    type: String,
    default: null,
  },
  bookingReference: {
    type: String,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  lockedUntil: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
