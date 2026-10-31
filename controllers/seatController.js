const Seat = require('../models/Seat');
const Show = require('../models/Show');
const Booking = require('../models/Booking');

// Lock a seat atomically to prevent double-booking
exports.lockSeat = async (req, res) => {
  try {
    const { showId, seatNumber, userId } = req.body;
    const lockDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    const lockExpiry = new Date(Date.now() + lockDuration);

    // Atomic update using findOneAndUpdate to ensure lock is acquired
    const lockedSeat = await Seat.findOneAndUpdate(
      {
        showId,
        seatNumber,
        status: 'available', // Only lock if currently available
      },
      {
        status: 'locked',
        lockedBy: userId,
        lockedAt: new Date(),
        lockExpiry,
      },
      { new: true }
    );

    if (!lockedSeat) {
      return res.status(409).json({
        success: false,
        message: 'Seat not available for locking. Already locked or booked.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Seat locked successfully',
      seat: lockedSeat,
    });
  } catch (error) {
    console.error('Error locking seat:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Unlock a seat if lock has expired or user cancels
exports.unlockSeat = async (req, res) => {
  try {
    const { showId, seatNumber, userId } = req.body;

    const unlockedSeat = await Seat.findOneAndUpdate(
      {
        showId,
        seatNumber,
        status: 'locked',
        lockedBy: userId,
      },
      {
        status: 'available',
        lockedBy: null,
        lockedAt: null,
        lockExpiry: null,
      },
      { new: true }
    );

    if (!unlockedSeat) {
      return res.status(404).json({
        success: false,
        message: 'Locked seat not found or unauthorized',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Seat unlocked successfully',
      seat: unlockedSeat,
    });
  } catch (error) {
    console.error('Error unlocking seat:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get available seats for a show
exports.getAvailableSeats = async (req, res) => {
  try {
    const { showId } = req.params;

    const seats = await Seat.find({
      showId,
      status: 'available',
    }).select('seatNumber price');

    return res.status(200).json({
      success: true,
      message: 'Available seats retrieved',
      seats,
    });
  } catch (error) {
    console.error('Error fetching available seats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all seats for a show
exports.getAllSeats = async (req, res) => {
  try {
    const { showId } = req.params;

    const seats = await Seat.find({ showId }).select('seatNumber status price');

    return res.status(200).json({
      success: true,
      message: 'All seats retrieved',
      seats,
    });
  } catch (error) {
    console.error('Error fetching seats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
