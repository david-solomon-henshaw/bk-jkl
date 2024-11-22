// controllers/patientController.js
const Patient = require('../models/patient');
const Appointment = require('../models/appointment');
const bcrypt = require('bcrypt');
const ActionLog = require('../models/action')

// Patient registration
exports.registerPatient = async (req, res) => {
  const { firstName, lastName, email, password, dateOfBirth, phoneNumber, gender } = req.body;

  try {
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      // Log failure when patient already exists
      await ActionLog.create({
        userId: null,  // No user since it's a guest action (patient self-registering)
        userRole: 'patient',  // The role performing the action is a patient
        action: 'attempted_patient_registration',
        description: `A registration attempt was made for the patient with email ${email}, but the email is already associated with an existing account.`,
        entity: 'patient',
        entityId: existingPatient._id,  // Link to the existing patient
        status: 'failed',
        errorDetails: 'Patient with the given email already exists.',  // Specify the exact issue
      });

      return res.status(400).json({ message: 'Patient already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newPatient = new Patient({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      dateOfBirth,
      gender,
    });

    await newPatient.save();

    // Log successful patient registration
    await ActionLog.create({
      userId: null,  // No user ID for self-registration
      userRole: 'patient',  // The role performing the action is a patient
      action: 'successful_patient_registration',
      description: `A new patient was successfully registered with the email address ${email}.`,
      entity: 'patient',
      entityId: newPatient._id,  // Link to the newly created patient
      status: 'success',
    });

    res.status(201).json({ message: 'Patient registered successfully' });
  } catch (error) {
    // Log error during patient registration
    await ActionLog.create({
      userId: null,  // No user ID for self-registration
      userRole: 'patient',  // The role performing the action is a patient
      action: 'failed_patient_registration',
      description: `An error occurred while registering the patient with email ${email}. Error: ${error.message}`,
      entity: 'error',  // Entity is 'error' due to failure
      entityId: null,  // No patient created if an error occurs
      status: 'failed',
      errorDetails: error.message,  // Log the specific error message
    });

    res.status(500).json({ message: 'Error registering patient', error });
  }
};


exports.getPatientAppointments = async (req, res) => {
  const patientId = req.user.id;

  try {
    // Find all appointments associated with the patient
    const appointments = await Appointment.find({ patient: patientId })
      .populate('caregiver', 'firstName lastName') // Populate caregiver details (optional)
      .sort({ appointmentDate: -1 }); // Sort by the latest appointment first

    if (!appointments.length) {
      // Log the failed action (no appointments found)
      await ActionLog.create({
        userId: patientId,
        userRole: 'patient',
        action: 'view_appointments',
        description: `No appointments found for patient ID ${patientId}`,
        entity: 'patient',
        entityId: patientId,
        status: 'failed',
      });

      return res.status(404).json({ message: 'No appointments found for this patient.' });
    }

    // Log the successful action (appointments retrieved)
    await ActionLog.create({
      userId: patientId,
      userRole: 'patient',
      action: 'view_appointments',
      description: `Retrieved ${appointments.length} appointments for patient ID ${patientId}`,
      entity: 'appointment',
      entityId: patientId,
      status: 'success',
    });

    res.status(200).json(appointments);
  } catch (error) {
    // Log the error action
    await ActionLog.create({
      userId: patientId,
      userRole: 'patient',
      action: 'view_appointments',
      description: `Error fetching appointments for patient ID ${patientId}: ${error.message}`,
      entity: 'error',
      entityId: patientId,
      status: 'failed',
    });

    res.status(500).json({
      message: 'Error fetching appointments for the patient.',
      error: error.message,
    });
  }
};


// Add an appointment to a patient
exports.addAppointment = async (req, res) => {
  const { patientRequestedDate, patientRequestedTime, department } = req.body;

  try {
    // Validate required fields
    if (!patientRequestedDate || !department || !patientRequestedTime) {
      return res.status(400).json({ message: 'Appointment date, department, and time are required' });
    }

    // Get patientId from the token
    const patientId = req.user.id;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      // Log failure if patient is not found
      await ActionLog.create({
        userId: patientId,
        userRole: 'patient',
        action: 'add_appointment',
        description: `Patient with ID ${patientId} not found`,
        entity: 'appointment',
        entityId: patientId,
        status: 'failed',
      });
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if requested date and time are valid (future date)
    const requestedDateTime = new Date(`${patientRequestedDate}T${patientRequestedTime}`);
    if (requestedDateTime <= Date.now()) {
      return res.status(400).json({ message: 'Appointment date and time must be in the future' });
    }

    const newAppointment = new Appointment({
      patient: patientId,
      patientRequestedDate,
      patientRequestedTime,
      department,
      status: 'pending', // Default status for a new appointment
      createdAt: Date.now(),
    });

    await newAppointment.save();

    // Push the appointment reference to the patient's appointments array
    patient.appointments.push(newAppointment._id);
    await patient.save();

    // Log successful appointment creation
    await ActionLog.create({
      userId: patientId,
      userRole: 'patient',
      action: 'add_appointment',
      description: `Appointment requested by patient with ID ${patientId} for department ${department} on ${patientRequestedDate} at ${patientRequestedTime}`,
      entity: 'appointment',
      entityId: newAppointment._id,
      status: 'success',
    });

    res.status(201).json({ message: 'Appointment requested successfully', appointment: newAppointment });
  } catch (error) {
    const patientId = req.user.id;

    // Log error with stack trace for debugging purposes
    await ActionLog.create({
      userId: patientId,
      userRole: 'patient',
      action: 'add_appointment',
      description: `Error requesting appointment: ${error.message}\nStack trace: ${error.stack}`,
      entity: 'error',
      entityId: null,
      status: 'failed',
    });

    // Return error response
    res.status(500).json({ message: 'Error requesting appointment', error: error.message });
  }
};



console.log('check if logger matches the new logger');

// fix middlware token
exports.getPatientProfile = async (req, res) => {
  const patientId = req.user.id;

  try {
    // Find the patient by ID and populate the appointments
    const patient = await Patient.findById(patientId).populate('appointments');

    if (!patient) {
      // Log failure if patient is not found (admin role should be reflected)
      await ActionLog.create({
        userId: patientId,  // Admin's user ID
        userRole: 'patient',      // Role is 'admin' in this case
        action: 'view_patient_profile',
        description: `Patient with ID ${patientId} not found`,
        entity: 'patient',
        entityId: null,  // No patient found
        status: 'failed',
      });

      return res.status(404).json({ message: 'Patient not found' });
    }

    // 1. Total Appointments Booked
    const totalAppointments = patient.appointments.length;

    // 2. Total Caregivers (distinct caregivers associated with this patient's appointments)
    const caregiverCount = await Appointment.distinct('caregiver', {
      patient: patientId,
      caregiver: { $exists: true } // Only count assigned caregivers
    });
    const totalCaregivers = caregiverCount.length;

    // 3. Total Medications Prescribed (count completed appointments)
    const completedAppointmentsCount = await Appointment.countDocuments({
      patient: patientId,
      status: 'completed'
    });

    // Log successful retrieval of patient profile and statistics (correct user role)
    await ActionLog.create({
      userId: patientId,  // Admin's user ID
      userRole: 'patient',      // Role is 'admin' when an admin views patient profile
      action: 'view_patient_profile',
      description: `Successfully retrieved profile and statistics for patient with ID ${patientId}`,
      entity: 'patient',
      entityId: patientId,  // The patient ID
      status: 'success',
    });

    // Return both the profile data and statistics
    res.status(200).json({
      profile: patient,
      statistics: {
        totalAppointments,
        totalCaregivers,
        totalMedicationsPrescribed: completedAppointmentsCount,
      }
    });
  } catch (error) {
    // Log error with stack trace for debugging purposes
    await ActionLog.create({
      userId: patientId,  // Admin's user ID
      userRole: 'patient',     // Role is 'admin' for admin's view
      action: 'view_patient_profile',
      description: `Error retrieving patient profile and statistics: ${error.message}\nStack trace: ${error.stack}`,
      entity: 'patient',
      entityId: patientId,  // The patient ID in question
      status: 'failed',
    });

    // Return error response
    res.status(500).json({ message: 'Error fetching patient profile and statistics', error: error.message });
  }
};
