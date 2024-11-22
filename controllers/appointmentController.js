const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Caregiver = require('../models/caregiver');


exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('caregiver', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    res.status(200).json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments. Please try again later.' });
  }
};
// Get appointments by patient ID
exports.getAppointmentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const appointments = await Appointment.find({ patient: patientId }).populate('caregiver');
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving patient appointments', error });
  }
};

// Get appointments by status
exports.getAppointmentsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const appointments = await Appointment.find({ status }).populate('patient caregiver');
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving appointments by status', error });
  }
};


exports.updateAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, caregiverId, appointmentDate, appointmentTime } = req.body;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Assign a caregiver if provided
    if (caregiverId) {
      const caregiver = await Caregiver.findById(caregiverId);
      if (!caregiver) return res.status(404).json({ message: 'Caregiver not found' });
      appointment.caregiver = caregiverId;
    }

    // Update the appointment fields
    if (status) appointment.status = status;
    if (appointmentDate) appointment.appointmentDate = appointmentDate;
    if (appointmentTime) appointment.appointmentTime = appointmentTime;

    // If the appointment is approved, add the approvedAt field
    if (status === 'approved' && !appointment.approvedAt) {
      appointment.approvedAt = Date.now();
    }

    // Save the updated appointment
    await appointment.save();
    res.status(200).json({ message: 'Appointment updated successfully', appointment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating appointment', error });
  }
};


// Delete an appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findByIdAndDelete(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    // Remove appointment reference from the patient
    await Patient.findByIdAndUpdate(appointment.patient, {
      $pull: { appointments: appointmentId }
    });

    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting appointment', error });
  }
};
