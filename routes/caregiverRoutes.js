const express = require('express');
const caregiverController = require('../controllers/caregiverController'); 
const {authenticate} = require('../utils/sessionMiddleware')

const router = express.Router();

// Caregiver Routes
router.get('/:id/appointments',authenticate, caregiverController.viewAppointments); // Get appointments assigned to a caregiver
router.put('/:id/appointment', authenticate,caregiverController.updateAppointment); // Update an appointment completion

// Define the route for fetching a caregiver profile
router.get('/:id',authenticate, caregiverController.getCaregiverProfile);

module.exports = router;
