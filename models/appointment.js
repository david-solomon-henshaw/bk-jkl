const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  caregiver: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver', required: false }, // Optional
  RequestedDate: { type: String, required: true }, // YYYY-MM-DD
  RequestedTime: { type: String, required: true }, // HH:mm
  department: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'in-progress', 'completed', 'canceled'], default: 'pending' },
  bookedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'bookedByRole', required: true },
  bookedByRole: { type: String, enum: ['patient', 'caregiver'], required: true },
  appointmentDate: { type: String, default:  ''}, // Default current date in YYYY-MM-DD
  appointmentTime: { type: String, default: '' }, // Default time in HH:mm (24-hour clock)
  startTime: { type: String, default: ' ' }, // Default time in HH:mm (24-hour clock)
  endTime: { type: String, default: ' ' }, // Default time in HH:mm (24-hour clock)
  approvedAt: { type: String, default: null }, // Format YYYY-MM-DD or null
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
