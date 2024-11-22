const express = require('express');
const { registerAdmin } = require('../controllers/adminAuthController');
const adminController = require('../controllers/adminAuthController'); // Import the updated admin controller
const actionLogController = require('../controllers/actionLogController');
const {authenticate} = require('../utils/sessionMiddleware')
const router = express.Router();
 

// Admin Registration Route
router.post('/register', authenticate,registerAdmin);

router.get('/action-logs', actionLogController.getActionLogs);
 
// Admin Routes for Caregivers
router.post('/caregivers', authenticate,adminController.createCaregiver); // Create a caregiver
router.get('/caregivers', adminController.getAllCaregivers); // Get all caregivers
router.put('/caregivers/:id', adminController.updateCaregiver); // Update a caregiver
router.delete('/caregivers/:id', adminController.deleteCaregiver); // Delete a caregiver
 
// Admin Routes for Appointments
router.put('/appointments/:appointmentId', adminController.updateAppointment); // Update an appointment
router.get('/appointments/all', adminController.getAllAppointments); // Update an appointment

router.put('/appointments/cancle/:appointmentId', adminController.cancelAppointment); // Update an appointment
 

// New Analytics Routes
// Dashboard Overview
router.get('/dashboard/stats', adminController.getDashboardStats);

// Appointment Analytics
router.get('/appointments/analytics', adminController.getAppointmentAnalytics);

// Caregiver Analytics
router.get('/caregivers/analytics', adminController.getCaregiverAnalytics);

// Patient Analytics
router.get('/patients/analytics', adminController.getPatientAnalytics);

module.exports = router;
