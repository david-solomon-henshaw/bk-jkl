const mongoose = require('mongoose');
const { Schema } = mongoose;

// Action Log Schema to track actions and errors for all users
const actionLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId, // Reference to the User who performed the action (Admin, Patient, or Caregiver)
    required: false,  // Nullable in case of system-level actions or errors without a specific user
  },
  userRole: {
    type: String,
    
    required: true  // Ensures the role is always specified for the log
  },
  action: {
    type: String,
    required: true  // Description of the action taken (e.g., 'login', 'update appointment', etc.)
  },

  description: {
    type: String, // Detailed description of the action or error (e.g., 'User logged in', 'Appointment created', etc.)
    required: true  // Ensures a detailed description is always provided
  },

  entity: {
    type: String,
    required: true,
    enum: ['admin', 'appointment', 'caregiver', 'patient', 'error'], // The entity being acted upon or involved in the log (e.g., 'appointment' for actions related to appointments)
  },

  entityId: {
    type: Schema.Types.ObjectId,
    required: false, // Nullable for error logs or actions that don't relate to a specific entity
    default: null,   // Default to null if no entity is involved (e.g., system-level actions or errors)
  },

  timestamp: {
    type: Date,
    default: Date.now,  // Automatically set the current timestamp when the log is created
  },

  errorDetails: {
    type: String,  // Stores detailed error message or stack trace if the action failed
    required: false, // Only required if the action is a failed one
  },

  status: {
    type: String,
    enum: ['success', 'failed'],  // Tracks whether the action was successful or failed
    required: true,  // Ensures the status is always recorded (e.g., 'success' if the action completed without errors)
  },
});

// Define ActionLog model based on the schema
const ActionLog = mongoose.model('ActionLog', actionLogSchema);

module.exports = ActionLog;
