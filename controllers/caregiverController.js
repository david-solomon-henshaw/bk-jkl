const Appointment = require('../models/appointment');
const Caregiver = require('../models/caregiver')
const Patient = require('../models/patient')
const ActionLog = require('../models/action')


// View appointments assigned to a caregiver 
exports.viewAppointments = async (req, res) => {
  const caregiverId = req.user.id;

  try {
    // Find appointments associated with the caregiver
    const appointments = await Appointment.find({ caregiver: caregiverId });

    if (!appointments.length) {
      // Log the failed action (no appointments found)
      await ActionLog.create({
        userId: caregiverId,
        userRole: 'caregiver',
        action: 'view_appointments',
        description: `No appointments found for caregiver ID ${caregiverId}`,
        entity: 'caregiver',
        entityId: caregiverId,
        status: 'success',
      });

      return res.status(404).json({ message: 'No appointments has been assigned to this caregiver' });
    }

     // Log the successful action (appointments retrieved)
     await ActionLog.create({
      userId: caregiverId,
      userRole: 'caregiver',
      action: 'view_appointments',
      description: `Retrieved ${appointments.length} appointments for caregiver ID ${caregiverId}`,
      entity: 'caregiver',
      entityId: caregiverId,
      status: 'success',
    });

    res.status(200).json(appointments);
  } catch (error) {

      // Log the error action
      await ActionLog.create({
        userId: caregiverId,
        userRole: 'caregiver',
        action: 'view_appointments',
        description: `Error viewing appointments for caregiver ID ${caregiverId}: ${error.message}`,
        entity: 'error',
        entityId: caregiverId,
        status: 'failed',
      });
    res.status(500).json({ message: error.message });
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
      await ActionLog.create({
        userId: caregiverId,
        userRole: 'caregiver',
        action: 'update_appointment',
        description: `Appointment with ID ${appointmentId} not found`,
        entity: 'appointment',
        entityId: appointmentId,
        status: 'failed',
      });

      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Find the caregiver by ID to update availability
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      await ActionLog.create({
        userId: caregiverId,
        userRole: 'caregiver',
        action: 'update_appointment',
        description: `Caregiver with ID ${caregiverId} not found`,
        entity: 'caregiver',
        entityId: caregiverId,
        status: 'failed',
      });

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
        await ActionLog.create({
          userId: caregiverId, // Logged-in user's ID
          userRole: 'caregiver',
          action: 'update_appointment',
          description: `Patient associated with appointment ID ${appointmentId} not found`,
          entity: 'error',
          entityId: appointment.patient || null, // Reference the patient ID from the appointment
          status: 'failed',
        });

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
    await ActionLog.create({
      userId: caregiverId, // Logged-in user's ID
      userRole: 'caregiver',
      action: 'update_appointment',
      description: `Error updating appointment with ID ${appointmentId}: ${error.message}`,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'failed',
    });

    res.status(500).json({ message: error.message });
  }
};



// exports.updateAppointment = async (req, res) => {
//   const  appointmentId = req.params.id;
//   const caregiverId = req.user.id
//   const { status, endTime} = req.body;

//   try {
//     // Find the appointment by ID
//     const appointment = await Appointment.findById(appointmentId);
//     if (!appointment) {
//       await ActionLog.create({
//         userId: caregiverId, // Assuming you have the logged-in user's ID
//         userRole: 'caregiver',    // Or the correct role of the user
//         action: 'update_appointment',
//         description: `Appointment with ID ${appointmentId} not found`,
//         entity: 'appointment',
//         entityId: appointmentId,
//         status: 'failed',
//       });
    
//       return res.status(404).json({ message: 'Appointment not found' });
//     }
    
//     // Update the appointment's status and endTime
//     if (status === 'in-progress') {
//       appointment.status = 'in-progress';
//       // We don't need to set endTime for in-progress status
//       appointment.startTime = new Date().toISOString(); // Set start time to current time when status is 'in-progress'
//     } else if (status === 'completed') {
//       appointment.status = 'completed';
//       appointment.endTime = endTime || new Date().toISOString(); // Set endTime if provided, else use current time
//     }

//     // Save the updated appointment
//     await appointment.save();

//     // If the appointment is completed, update the patient's totalPrescriptions
//     if (status === 'completed') {
//       const patientId = appointment.patient;  // The patient ID is already stored in the appointment

//       // Find the patient by ID and update their totalPrescriptions
//       const patient = await Patient.findById(patientId);
//       if (!patient) {
//         await ActionLog.create({
//           userId: caregiverId, // Logged-in user's ID
//           userRole: 'caregiver',    // Or appropriate role
//           action: 'update_appointment',
//           description: `Patient associated with appointment ID ${appointmentId} not found`,
//           entity: 'error',
//           entityId: appointment.patient || null, // Reference the patient ID from the appointment
//           status: 'failed',
//         });
      
//         return res.status(404).json({ message: 'Patient not found' });
//       }
      

//       // Increment the totalPrescriptions count
//       patient.totalPrescriptions += 1;

//       // Save the updated patient
//       await patient.save();
//     }

//     await ActionLog.create({
//       userId: caregiverId, // Logged-in user's ID
//       userRole: 'caregiver',    // Or appropriate role
//       action: 'update_appointment',
//       description: `Appointment with ID ${appointmentId} updated successfully. Status: ${status}`,
//       entity: 'appointment',
//       entityId: appointmentId,
//       status: 'success',
//     });
    

//     res.status(200).json({ message: 'Appointment and patient updated successfully', appointment });
//   } catch (error) {
    
//     await ActionLog.create({
//       userId: caregiverId, // Logged-in user's ID
//       userRole: 'caregiver',    // Or appropriate role
//       action: 'update_appointment',
//       description: `Error updating appointment with ID ${appointmentId}: ${error.message}`,
//       entity: 'appointment',
//       entityId: appointmentId,
//       status: 'failed',
//     });
    
//     res.status(500).json({ message: error.message });
//   }
// };


// Get caregiver profile by ID
console.log('fix caregiver statisctocs text caregiver availability too like the patient one');

exports.getCaregiverProfile = async (req, res) => {
  const caregiverId = req.user.id;  // Assuming the ID is passed as a parameter

  try {
    // Find the caregiver by ID
    const caregiver = await Caregiver.findById(caregiverId) // Populate the appointments if needed

    if (!caregiver) {
      await ActionLog.create({
        userId: caregiverId, // Use the caregiver ID as the user
        userRole: 'caregiver', // Role is 'caregiver'
        action: 'view_profile',
        description: `Caregiver with ID ${caregiverId} not found`,
        entity: 'error',
        entityId: caregiverId, // The profile we attempted to retrieve
        status: 'failed',
      });
    
      return res.status(404).json({ message: 'Caregiver not found' });
    }

    await ActionLog.create({
      userId: caregiverId, // Caregiver retrieving their profile
      userRole: 'caregiver', // Role is 'caregiver'
      action: 'view_profile',
      description: `Caregiver profile with ID ${caregiverId} retrieved successfully`,
      entity: 'caregiver',
      entityId: caregiverId, // The profile retrieved
      status: 'success',
    });
    
    

    // Return caregiver profile data
    res.status(200).json(caregiver);
  } catch (error) {
    await ActionLog.create({
      userId: caregiverId, // Caregiver's ID for the attempted action
      userRole: 'caregiver', // Role is 'caregiver'
      action: 'view_profile',
      description: `Error retrieving caregiver profile with ID ${caregiverId}: ${error.message}`,
      entity: 'error',
      entityId: caregiverId, // The profile being acted on
      status: 'failed',
    });
    
    res.status(500).json({ message: error.message });
  }
};
