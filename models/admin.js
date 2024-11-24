
// models/Admin.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // This will be hashed
  role: { type: String, default: 'admin' },
  otp: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
  token: { type: String } // for session management
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);