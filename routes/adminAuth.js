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
router.get('/caregivers', authenticate,adminController.getAllCaregivers); // Get all caregivers
router.put('/caregivers/:id', authenticate,adminController.updateCaregiver); // Update a caregiver
router.delete('/caregivers/:id', authenticate,adminController.deleteCaregiver); // Delete a caregiver
 



// Admin Routes for Appointments
//router.put('/appointments/:appointmentId', adminController.updateAppointment); // Update an appointment
router.get('/appointments/all', authenticate,adminController.getAllAppointments); // Update an appointment

router.put('/appointments/cancle/:appointmentId',authenticate, adminController.cancelAppointment); // Update an appointment
 

// Reassign caregiver to an appointment
router.put('/appointments/:appointmentId/reassign', authenticate,adminController.reassignCaregiver);

// Approve an appointment
router.put('/appointments/:appointmentId/approve',authenticate, adminController.approveAppointment);

// Cancel an appointment
router.put('/appointments/:appointmentId/cancel', authenticate,adminController.cancelAppointment);


// New Analytics Routes
// Dashboard Overview
router.get('/dashboard/stats',authenticate, adminController.getDashboardStats);

// Appointment Analytics
router.get('/appointments/analytics', authenticate,adminController.getAppointmentAnalytics);

// Caregiver Analytics
router.get('/caregivers/analytics', authenticate,adminController.getCaregiverAnalytics);

// Patient Analytics
router.get('/patients/analytics',authenticate, adminController.getPatientAnalytics);

module.exports = router;
