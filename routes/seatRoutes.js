const express = require('express');
const router = express.Router();
const seatController = require('../controllers/seatController');

// Lock a seat
router.post('/lock', seatController.lockSeat);

// Unlock a seat
router.post('/unlock', seatController.unlockSeat);

// Get available seats for a show
router.get('/available/:showId', seatController.getAvailableSeats);

// Get all seats for a show
router.get('/all/:showId', seatController.getAllSeats);

module.exports = router;
