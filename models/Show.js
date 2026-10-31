const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movieTitle: {
    type: String,
    required: true,
  },
  showDateTime: {
    type: Date,
    required: true,
    index: true,
  },
  theaterName: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  totalSeats: {
    type: Number,
    required: true,
  },
  availableSeats: {
    type: Number,
    required: true,
  },
  bookedSeats: {
    type: Number,
    default: 0,
  },
  lockedSeats: {
    type: Number,
    default: 0,
  },
  pricePerSeat: {
    type: Number,
    required: true,
    default: 100,
  },
  status: {
    type: String,
    enum: ['upcoming', 'available', 'full', 'cancelled'],
    default: 'upcoming',
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

module.exports = mongoose.model('Show', showSchema);
