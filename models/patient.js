const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phoneNumber: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  dateOfBirth: { type: Date, required: true },
  medicalHistory: { type: String }, // Optional field for medical history
  password: { type: String, required: true }, // hashed password
  otp: { type: String, default: "" },
  otpExpiresAt: { type: Date, default: null },
  role: { type: String, default: 'patient' },
  appointments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }
  ], // Tracks all appointments related to the patient
  totalPrescriptions: { type: Number, default: 0 } // Optional field to track prescription counts
});

module.exports = mongoose.model('Patient', patientSchema);