// app.js
const express = require('express');
const mongoose = require('mongoose');
const adminAuthRoutes = require('./routes/adminAuth');
const patientRoutes = require('./routes/patientRoutes'); // Import patient routes
const authRoutes = require('./routes/authRoutes'); // Import unified auth routes
const appointmentRoutes = require('./routes/appointmentRoutes'); // Import appointment routes
const caregiverRoutes = require('./routes/caregiverRoutes'); // Adjust the path as necessary
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');

 
const app = express()
app.use(cookieParser());
app.use(express.json()); // Middleware for parsing JSON 
app.use(cors({
  origin: 'http://localhost:3000' // or your frontend URL
}));
// Routes
app.use('/api/admin', adminAuthRoutes);
app.use('/api/patient', patientRoutes); // Use patient routes

// Routes
app.use('/api/auth', authRoutes); // Use unified auth routes
app.use('/api/appointments', appointmentRoutes); // Use appointment routes

// Use caregiver routes
app.use('/api/caregivers', caregiverRoutes);
 
// MongoDB Connection
mongoose.connect(process.env.MONGO_DB_STRING_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');

    // Start the server if the DB connection is successful
    const PORT = process.env.PORT;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1); // Exit the process if the connection fails
  });
 