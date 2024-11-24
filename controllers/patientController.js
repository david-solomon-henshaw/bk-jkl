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

    res.status(201).json({ message: 'Patient registered successfully' });
  } catch (error) {
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
      return res.status(404).json({ message: 'No appointments found for this patient.' });
    }

   

    res.status(200).json(appointments);
  } catch (error) {
  
    res.status(500).json({
      message: 'Error fetching appointments for the patient.',
      error: error.message,
    });
  }
};


// Add an appointment to a patient
exports.addAppointment = async (req, res) => {
  const { patientRequestedDate, patientRequestedTime, department } = req.body;
  const { id: userId, role: userRole } = req.user;

  try {
    // Validate required fields
    if (!patientRequestedDate || !department || !patientRequestedTime) {
      return res.status(400).json({ message: 'Appointment date, department, and time are required' });
    }

    const patient = await Patient.findById(userId);
    if (!patient) {
      // Log failure if patient is not found
      await ActionLog.create({
        userId:  userId,
        userRole: 'patient',
        action: 'add_appointment',
        description: `Patient with ID ${ userId} not found`,
        entity: 'appointment',
        entityId: userId,
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
      patient: userId,
      RequestedDate: patientRequestedDate,
      RequestedTime: patientRequestedTime,
      department,
      bookedBy: userId,
      bookedByRole: userRole,
      createdAt: Date.now(),
    });

    await newAppointment.save();

    // Push the appointment reference to the patient's appointments array
    patient.appointments.push(newAppointment._id);
    await patient.save();

    // Log successful appointment creation
    await ActionLog.create({
      userId: userId,
      userRole: 'patient',
      action: 'add_appointment',
      description: `Appointment requested by patient with ID ${ userId} for department ${department} on ${patientRequestedDate} at ${patientRequestedTime}`,
      entity: 'appointment',
      entityId: newAppointment._id,
      status: 'success',
    });

    res.status(201).json({ message: 'Appointment requested successfully', appointment: newAppointment });
  } catch (error) {
  
    // Return error response
    res.status(500).json({ message: 'Error requesting appointment', error: error.message });
  }
};


// fix middlware token
exports.getPatientProfile = async (req, res) => {
  const patientId = req.user.id;

  try {
    // Find the patient by ID and populate the appointments
    const patient = await Patient.findById(patientId).populate('appointments');

    if (!patient) {
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
   
    // Return error response
    res.status(500).json({ message: 'Error fetching patient profile and statistics', error: error.message });
  }
};
