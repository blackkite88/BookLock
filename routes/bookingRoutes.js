const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Create a new booking
router.post('/create', bookingController.createBooking);

// Get booking details
router.get('/:bookingId', bookingController.getBooking);

// Get all bookings for a user
router.get('/user/:userId', bookingController.getUserBookings);

module.exports = router;
