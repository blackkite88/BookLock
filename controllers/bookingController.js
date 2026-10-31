const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const crypto = require('crypto');

// Create booking with locked seats
exports.createBooking = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    const { showId, seatNumbers, userId, email, phone } = req.body;

    if (!seatNumbers || seatNumbers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'No seats provided' });
    }

    // Verify all seats are locked by the user
    const seats = await Seat.find({
      showId,
      seatNumber: { $in: seatNumbers },
      status: 'locked',
      lockedBy: userId,
    }).session(session);

    if (seats.length !== seatNumbers.length) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Some seats are not locked or have expired locks',
      });
    }

    // Calculate total price
    const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);

    // Create booking reference
    const bookingRef = 'BK' + crypto.randomBytes(8).toString('hex').toUpperCase();

    // Create booking
    const booking = new Booking({
      showId,
      userId,
      seats: seats.map(s => s._id),
      seatNumbers,
      totalPrice,
      email,
      phone,
      bookingReference: bookingRef,
      status: 'pending',
      paymentStatus: 'pending',
    });

    await booking.save({ session });

    // Update seats to booked
    await Seat.updateMany(
      {
        _id: { $in: seats.map(s => s._id) },
      },
      {
        status: 'booked',
        bookingId: booking._id,
        bookedBy: userId,
        bookedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lockExpiry: null,
      },
      { session }
    );

    // Update show available seats
    await Show.findByIdAndUpdate(
      showId,
      {
        $inc: {
          availableSeats: -seatNumbers.length,
          bookedSeats: seatNumbers.length,
          lockedSeats: -seatNumbers.length,
        },
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating booking:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// Get booking details
exports.getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate('seats')
      .populate('showId');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Booking retrieved',
      booking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all bookings for a user
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await Booking.find({ userId })
      .populate('showId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'User bookings retrieved',
      bookings,
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
