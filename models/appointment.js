const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  patientRequestedDate: {
    type: Date,
    required: true
  },
  patientRequestedTime: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: Date,
    required: false
  },
  startTime: {
    type: String, // e.g., "09:00"
    required: false
  },
  endTime: {
    type: String, // To be updated by caregiver, e.g., "10:00"
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'in-progress', 'completed', 'canceled'],
    default: 'pending'
  },
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Caregiver'
  },
  approvedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Appointment', appointmentSchema);