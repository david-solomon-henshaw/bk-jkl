const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Route to book a new appointment
//router.post('/book', appointmentController.bookAppointment);

// Route to get all appointments
router.get('/all', appointmentController.getAllAppointments);

// Route to get appointments by patient ID
router.get('/patient/:patientId', appointmentController.getAppointmentsByPatient);

// Route to get appointments by status (e.g., 'pending', 'approved')
router.get('/status/:status', appointmentController.getAppointmentsByStatus);

// Route to update an appointment status (approve, complete, cancel)
//router.patch('/:appointmentId/status', appointmentController.updateAppointmentStatus);

// Route to delete an appointment
router.delete('/:appointmentId', appointmentController.deleteAppointment);

module.exports = router;
