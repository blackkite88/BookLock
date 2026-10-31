# Concurrent Ticket Booking System

A scalable, robust Node.js and Express backend designed for high-concurrency ticket reservations. It implements an atomic seat-locking mechanism and multi-document ACID transactions in MongoDB to guarantee zero double-bookings during peak traffic and flash-sale events.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture & Concurrency Strategy](#system-architecture--concurrency-strategy)
  - [1. Atomic Seat Locking](#1-atomic-seat-locking)
  - [2. Multi-Document ACID Transactions](#2-multi-document-acid-transactions)
- [Tech Stack](#tech-stack)
- [Data Models](#data-models)
- [API Documentation](#api-documentation)
  - [Base URL](#base-url)
  - [Seat Management](#seat-management)
  - [Booking Management](#booking-management)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
- [End-to-End Booking Flow](#end-to-end-booking-flow)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

In high-demand ticketing platforms (such as cinema or concert booking), multiple users frequently attempt to reserve the same seats simultaneously. This project addresses the classic concurrency challenge with:

- **Distributed seat locking**: Seats are temporarily reserved with a time-to-live (5-minute TTL) so customers can safely review order details and complete checkout.
- **Race condition prevention**: Utilizes MongoDB's atomic `findOneAndUpdate` operations to ensure only one user can acquire a lock on an available seat.
- **Transactional integrity**: Finalizing bookings uses MongoDB replica set transactions (`mongoose.startSession()`), ensuring seat status updates, show counter decrements, and booking records are committed atomically or rolled back completely on error.

---

## Key Features

- **Atomic Seat Lock & Unlock**: Prevents race conditions at the database level when simultaneous requests target the same seat.
- **Lock Expiration Window**: Default 5-minute lock expiration allows seats to be reclaimed if checkout is abandoned.
- **ACID Transaction Support**: Multi-document transactional consistency across `Booking`, `Seat`, and `Show` collections.
- **Compound Unique Constraints**: Database-level unique indexing on `(showId, seatNumber)` prevents duplicate seat generation.
- **Detailed Booking Records**: Generates unique cryptographic booking reference codes (`BK...`) with full seat association and pricing history.
- **RESTful API**: Clean, intuitive endpoints for checking seat availability, locking seats, and retrieving user order histories.

---

## System Architecture & Concurrency Strategy

```
           [ Client A ]                       [ Client B ]
                │                                  │
    POST /api/seats/lock               POST /api/seats/lock
     (Seat 12, User A)                  (Seat 12, User B)
                │                                  │
                ▼                                  ▼
   ┌─────────────────────────────────────────────────────────┐
   │             Atomic `findOneAndUpdate` Query             │
   │           { showId, seatNumber, status: 'available' }   │
   └─────────────────────────────────────────────────────────┘
                │                                  │
         Acquires Lock (200 OK)             Fails with 409 Conflict
                │
                ▼
      5-Minute Hold Window
                │
      POST /api/bookings/create
                │
   ┌─────────────────────────────────────────────────────────┐
   │             MongoDB Transaction Session                 │
   │  1. Validate seat is locked by User A                   │
   │  2. Create Booking document & generate bookingReference │
   │  3. Transition Seat status: 'locked' -> 'booked'        │
   │  4. Update Show counters (available/booked/locked)      │
   │  5. Commit Transaction                                  │
   └─────────────────────────────────────────────────────────┘
                │
        201 Created (Confirmed)
```

### 1. Atomic Seat Locking
When a customer clicks a seat, the system executes an atomic update:
```javascript
Seat.findOneAndUpdate(
  { showId, seatNumber, status: 'available' },
  { status: 'locked', lockedBy: userId, lockedAt: new Date(), lockExpiry },
  { new: true }
);
```
If two requests arrive at the exact same millisecond, MongoDB's single-document atomicity guarantees only one query matches `status: 'available'`. The second query receives `null` and responds with `409 Conflict`.

### 2. Multi-Document ACID Transactions
During checkout finalization (`/api/bookings/create`):
1. Verifies that all requested seats are currently locked by the requesting user.
2. Creates the `Booking` document.
3. Updates seat records to `status: 'booked'`, linking `bookingId` and clearing lock fields.
4. Decrements `availableSeats` and updates seat aggregates in the `Show` document.
5. If any validation fails or an error occurs, `session.abortTransaction()` reverts all writes.

> **Note**: MongoDB Transactions require a Replica Set (standard for MongoDB Atlas or local replica sets).

---

## Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v16+)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **ODM**: [Mongoose](https://mongoosejs.com/) (v7.0.0)
- **Environment Management**: [dotenv](https://www.npmjs.com/package/dotenv)
- **CORS & Parsing**: `cors`, `body-parser`
- **Development Utility**: `nodemon`

---

## Data Models

### 1. Show (`models/Show.js`)
Represents an event or movie screening:
- `movieTitle` (String, required)
- `showDateTime` (Date, required, indexed)
- `theaterName` (String, required)
- `location` (String, required)
- `totalSeats`, `availableSeats`, `bookedSeats`, `lockedSeats` (Number)
- `pricePerSeat` (Number, default 100)
- `status` (`'upcoming'`, `'available'`, `'full'`, `'cancelled'`)

### 2. Seat (`models/Seat.js`)
Represents individual seats for a specific show:
- `showId` (ObjectId -> Show, required, indexed)
- `seatNumber` (String, required, e.g., `"A1"`, `"B12"`)
- `status` (`'available'`, `'locked'`, `'booked'`)
- `lockedBy` (String userId)
- `lockedAt`, `lockExpiry` (Date)
- `bookedBy` (String userId)
- `bookingId` (ObjectId -> Booking)
- `price` (Number)
- **Index**: Unique compound index `{ showId: 1, seatNumber: 1 }`

### 3. Booking (`models/Booking.js`)
Represents confirmed or pending reservation records:
- `showId` (ObjectId -> Show, required)
- `userId` (String, required, indexed)
- `seats` (Array of ObjectId -> Seat)
- `seatNumbers` (Array of Strings)
- `totalPrice` (Number, required)
- `status` (`'pending'`, `'confirmed'`, `'cancelled'`)
- `paymentStatus` (`'pending'`, `'completed'`, `'failed'`)
- `bookingReference` (String, unique indexed alphanumeric reference)
- `email`, `phone` (String, required)
- `transactionId`, `confirmedAt` (Date)

---

## API Documentation

### Base URL
```
http://localhost:3000
```

### Health Check
- **`GET /`**
  - **Response**: `200 OK`
  - ```json
    { "message": "Concurrent Ticket Booking System API" }
    ```

---

### Seat Management

#### 1. Lock a Seat
Atomically acquires a 5-minute lock on a seat.
- **Route**: `POST /api/seats/lock`
- **Body**:
  ```json
  {
    "showId": "654321098765432109876543",
    "seatNumber": "A1",
    "userId": "user_1001"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Seat locked successfully",
      "seat": {
        "_id": "654321098765432109876544",
        "showId": "654321098765432109876543",
        "seatNumber": "A1",
        "status": "locked",
        "lockedBy": "user_1001",
        "lockExpiry": "2026-10-31T16:50:00.000Z"
      }
    }
    ```
  - `409 Conflict`:
    ```json
    {
      "success": false,
      "message": "Seat not available for locking. Already locked or booked."
    }
    ```

#### 2. Unlock a Seat
Releases a locked seat back to available status (e.g. user de-selected seat or cancelled).
- **Route**: `POST /api/seats/unlock`
- **Body**:
  ```json
  {
    "showId": "654321098765432109876543",
    "seatNumber": "A1",
    "userId": "user_1001"
  }
  ```
- **Responses**:
  - `200 OK`: Seat status reset to `'available'`.
  - `404 Not Found`: Seat not found or not locked by this user.

#### 3. Get Available Seats for a Show
Returns all unreserved seats for a show.
- **Route**: `GET /api/seats/available/:showId`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Available seats retrieved",
    "seats": [
      { "_id": "...", "seatNumber": "A1", "price": 100 },
      { "_id": "...", "seatNumber": "A2", "price": 100 }
    ]
  }
  ```

#### 4. Get All Seats for a Show
Returns all seats and their current status (`available`, `locked`, `booked`).
- **Route**: `GET /api/seats/all/:showId`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "All seats retrieved",
    "seats": [
      { "_id": "...", "seatNumber": "A1", "status": "available", "price": 100 },
      { "_id": "...", "seatNumber": "A2", "status": "booked", "price": 100 }
    ]
  }
  ```

---

### Booking Management

#### 1. Create a Booking
Confirms booking for locked seats within an atomic transaction.
- **Route**: `POST /api/bookings/create`
- **Body**:
  ```json
  {
    "showId": "654321098765432109876543",
    "seatNumbers": ["A1", "A2"],
    "userId": "user_1001",
    "email": "customer@example.com",
    "phone": "+1234567890"
  }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Booking created successfully",
      "booking": {
        "_id": "654321098765432109876550",
        "bookingReference": "BK4E8A9C12FD3456",
        "showId": "654321098765432109876543",
        "userId": "user_1001",
        "seatNumbers": ["A1", "A2"],
        "totalPrice": 200,
        "status": "pending",
        "paymentStatus": "pending",
        "email": "customer@example.com",
        "phone": "+1234567890"
      }
    }
    ```
  - `409 Conflict`: Seats not locked by user or locks expired.
  - `400 Bad Request`: Missing seat numbers or invalid payload.

#### 2. Get Booking Details
Retrieves booking with populated seat and show documents.
- **Route**: `GET /api/bookings/:bookingId`
- **Response**: `200 OK`

#### 3. Get User Bookings
Retrieves all bookings made by a specific user.
- **Route**: `GET /api/bookings/user/:userId`
- **Response**: `200 OK`

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.x or higher)
- [MongoDB](https://www.mongodb.com/) (v5.0+ with Replica Set enabled for transaction support, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)

### Installation

1. Clone or navigate to the repository directory:
   ```bash
   cd lokal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ticket-booking?replicaSet=rs0
```

> **Replica Set Note**: To use MongoDB transactions locally, initiate a single-node replica set:
> ```bash
> mongod --replSet rs0 --dbpath /data/db
> # In mongo shell / mongosh:
> rs.initiate()
> ```
> Alternatively, connect directly to a cloud MongoDB Atlas connection URI.

### Running the Application

- **Development Mode** (with automatic reload via nodemon):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

The server will start listening at `http://localhost:3000`.

---

## End-to-End Booking Flow

1. **Browse Available Seats**:
   ```bash
   curl -X GET http://localhost:3000/api/seats/available/<SHOW_ID>
   ```

2. **Acquire Seat Lock**:
   ```bash
   curl -X POST http://localhost:3000/api/seats/lock \
     -H "Content-Type: application/json" \
     -d '{
       "showId": "<SHOW_ID>",
       "seatNumber": "A1",
       "userId": "user_42"
     }'
   ```

3. **Confirm Booking within 5 Minutes**:
   ```bash
   curl -X POST http://localhost:3000/api/bookings/create \
     -H "Content-Type: application/json" \
     -d '{
       "showId": "<SHOW_ID>",
       "seatNumbers": ["A1"],
       "userId": "user_42",
       "email": "alex@example.com",
       "phone": "9876543210"
     }'
   ```

4. **Verify Booking**:
   ```bash
   curl -X GET http://localhost:3000/api/bookings/<BOOKING_ID>
   ```

---

## Project Structure

```
.
├── app.js                      # Application entry point & Express configuration
├── package.json                # Project dependencies and npm scripts
├── models/                     # Mongoose Schemas & Models
│   ├── Booking.js              # Booking schema & index configuration
│   ├── Seat.js                 # Seat schema with compound uniqueness
│   └── Show.js                 # Event/Screening metadata schema
├── controllers/                # Business logic & transaction handlers
│   ├── bookingController.js    # Atomic booking confirmation & history
│   └── seatController.js       # Atomic seat locking & unlocking logic
└── routes/                     # API routes & endpoint definitions
    ├── bookingRoutes.js        # /api/bookings endpoints
    └── seatRoutes.js           # /api/seats endpoints
```

---

## License

This project is licensed under the [MIT License](LICENSE).
# BookLock
