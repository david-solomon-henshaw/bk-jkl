const express = require('express');
const { registerPatient, addAppointment,getPatientProfile, getPatientAppointments } = require('../controllers/patientController');
const {authenticate} = require('../utils/sessionMiddleware')

const router = express.Router();

// Patient Registration Route
router.post('/register', registerPatient);
 

// Add Appointment Route
router.post('/appointments', authenticate,addAppointment); // New route for adding appointments

router.get('/appointments', authenticate,getPatientAppointments); // New route for adding appointments


 
// Get Patient Profile Route
router.get('/:id', authenticate,getPatientProfile);  // Route to get the patient profile by ID


module.exports = router;
