const Appointment = require('../models/appointment');
const Caregiver = require('../models/caregiver')
const Patient = require('../models/patient')
const ActionLog = require('../models/action')


// View appointments assigned to a caregiver 
exports.viewAppointments = async (req, res) => {
  const caregiverId = req.user.id;

  try {
    // Find appointments associated with the caregiver
    const appointments = await Appointment.find({ caregiver: caregiverId })
    .populate('patient', 'firstName lastName')
    .exec();

    if (!appointments.length) {
     

      return res.status(404).json({ message: 'No appointments has been assigned to this caregiver' });
    }

    

    res.status(200).json(appointments);
  } catch (error) {

      
    res.status(500).json({ message: error.message });
  }
};
 
// Add an appointment (for patient or caregiver)
exports.addAppointment = async (req, res) => {
  const { patientId, patientRequestedDate, patientRequestedTime, department } = req.body;

  try {
    // Validate required fields
    if (!patientRequestedDate || !patientRequestedTime || !department) {
      return res.status(400).json({ message: 'Appointment date, time, and department are required' });
    }

    // Get user details from the token
    const { id: userId, role: userRole } = req.user;
    

    // If a caregiver is booking, ensure patientId is provided
    if (userRole === 'caregiver' && !patientId) {
      return res.status(400).json({ message: 'Patient ID is required when a caregiver books an appointment' });
    }

    // Directly use the patientId from the body
    const targetPatientId = patientId;

    // Validate the target patient
    const patient = await Patient.findById(targetPatientId);
    if (!patient) {
      
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if requested date and time are in the future
    const requestedDateTime = new Date(`${patientRequestedDate}T${patientRequestedTime}`);
    if (requestedDateTime <= Date.now()) {
      return res.status(400).json({ message: 'Appointment date and time must be in the future' });
    }

    // Create the new appointment
    const newAppointment = new Appointment({
      patient: targetPatientId,
      caregiver: userRole === 'caregiver' ? userId : null, // Set caregiver if booked by caregiver
      RequestedDate: patientRequestedDate,
      RequestedTime: patientRequestedTime,
      department,
      status: 'pending', // Default status
      bookedBy: userId,
      bookedByRole: userRole,
      createdAt: Date.now(),
    });

    await newAppointment.save();

    // Push the appointment to the patient's appointments array
    patient.appointments.push(newAppointment._id);
    await patient.save();

    // Log successful appointment creation
    await ActionLog.create({
      userId,
      userRole,
      action: 'add_appointment',
      description: `Appointment requested by ${userRole} (ID: ${userId}) for patient (ID: ${targetPatientId}) in department ${department} on ${patientRequestedDate} at ${patientRequestedTime}`,
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


// Get all patients
exports.getAllPatients = async (req, res) => {

  
  try {
    const patients = await Patient.find(); // Fetch all patients

    res.status(200).json(patients); // Return list of patients

  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Error fetching patients' });
  }
};



exports.updateAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  const caregiverId = req.user.id;
  const { status, endTime } = req.body;

  try {
    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Find the caregiver by ID to update availability
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {

      return res.status(404).json({ message: 'Caregiver not found' });
    }

    // Update appointment's status and endTime
    if (status === 'in-progress') {
      appointment.status = 'in-progress';
      appointment.startTime = new Date().toISOString(); // Set start time to current time when status is 'in-progress'

      // Set caregiver's availability to false (unavailable) when appointment is in progress
      caregiver.available = false;
      await caregiver.save();
    } else if (status === 'completed') {
      appointment.status = 'completed';
      appointment.endTime = endTime || new Date().toISOString(); // Set endTime if provided, else use current time

      // Reset caregiver's availability to true (available) when appointment is completed
      caregiver.available = true;
      await caregiver.save();
    }

    // Save the updated appointment
    await appointment.save();

    // If the appointment is completed, update the patient's totalPrescriptions
    if (status === 'completed') {
      const patientId = appointment.patient;  // The patient ID is already stored in the appointment

      // Find the patient by ID and update their totalPrescriptions
      const patient = await Patient.findById(patientId);
      if (!patient) {
       

        return res.status(404).json({ message: 'Patient not found' });
      }

      // Increment the totalPrescriptions count
      patient.totalPrescriptions += 1;

      // Save the updated patient
      await patient.save();
    }

    await ActionLog.create({
      userId: caregiverId, // Logged-in user's ID
      userRole: 'caregiver',
      action: 'update_appointment',
      description: `Appointment with ID ${appointmentId} updated successfully. Status: ${status}`,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'success',
    });

    res.status(200).json({ message: 'Appointment and caregiver availability updated successfully', appointment });
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
};




exports.getCaregiverProfile = async (req, res) => {
  const caregiverId = req.user.id;  // Assuming the ID is passed as a parameter

  try {
    // Find the caregiver by ID
    const caregiver = await Caregiver.findById(caregiverId) // Populate the appointments if needed

    if (!caregiver) {
     
    
      return res.status(404).json({ message: 'Caregiver not found' });
    }

    
    
    

    // Return caregiver profile data
    res.status(200).json(caregiver);
  } catch (error) {
    
    
    res.status(500).json({ message: error.message });
  }
};
