const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const Appointment = require('../models/appointment');
const Caregiver = require('../models/caregiver');
const nodemailer = require('../config/nodemailerConfig');
const Patient = require('../models/patient');
const ActionLog = require('../models/action')


// Helper function to format time to 12-hour AM/PM format
const formatTime = (timeString) => {
  const date = new Date(timeString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid date:', timeString);
    return 'Invalid time'; // Return a fallback if the date is invalid
  }

  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  const strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
};


//done
// Admin registration attach to frontend adminmodal
exports.registerAdmin = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  console.log(req.user);

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      // Log failed admin registration attempt (admin already exists)
      await ActionLog.create({
        userId: req.user ? req.user._id : null,  // User ID if available, otherwise null
        userRole: req.user ? req.user.role : 'error', // Log role if available, otherwise error
        action: 'register_admin',
        description: `Admin with this email ${email} already exists`,
        entity: 'admin',  // The entity being affected
        entityId: null,  // No specific entity ID for failed registration
        status: 'failed',
      });

      return res.status(400).json({ message: 'An Admin with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      firstName,
      lastName,
      email, 
      password: hashedPassword,
      role: 'admin'
    });
    await newAdmin.save();

    // Log successful admin registration
    await ActionLog.create({
      userId: newAdmin._id,  // User ID of the new admin
      userRole: 'admin',  // The role of the user
      action: 'register_admin',
      description: `New admin with email ${email} registered successfully`,
      entity: 'admin',  // The entity being created
      entityId: newAdmin._id,  // The entity ID for the new admin
      status: 'success',
    });

    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (error) {
    console.log(error);

    // Log failure due to error during registration
    await ActionLog.create({
      userId: req.user ? req.user._id : null,  // Log the current user if available, otherwise null
      userRole: req.user ? req.user.role : 'error',  // Log the role if available, otherwise 'error'
      action: 'register_admin',
      description: 'Error during admin registration: ' + error.message,
      entity: 'admin',  // The entity where the error occurred
      entityId: null,  // No specific entity ID for failed registration
      errorDetails: error.stack,  // Log the stack trace for debugging
      status: 'failed',
    });

    res.status(500).json({ message: 'Error registering admin', error });
  }
};



exports.getAllAppointments = async (req, res) => {
  const adminId = req.query.adminId || req.user?._id;  // Fallback to authenticated user if adminId is not provided

  try {
    const appointments = await Appointment.find()
      .populate('caregiver', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    
    // Action Log: Admin views all appointments
    await ActionLog.create({
      userId: adminId,  // Assuming the user is authenticated and available in req.user
      userRole: 'admin',  // The role of the user performing the action
      action: 'view_appointments',
      description: `Admin viewed all appointments`,
      entity: 'appointment',  // Entity being affected (appointments)
      entityId: null,  // No specific appointment entity affected
      status: 'success',  // Assuming the action is successful
    });

    res.status(200).json({ appointments });
  } catch (error) {
    // Log failed action when error occurs while fetching appointments
    await ActionLog.create({
      userId: adminId || null, // Log the user if authenticated; otherwise, set to null
      userRole: adminId ? 'admin' : null, // Set role if user is authenticated, otherwise null
      action: 'view_appointments',
      description: `Error fetching appointments: ${error.message}`, // Include the error message in the log
      entity: 'error', // Set to 'error' for general errors not tied to a specific entity
      entityId: null, // No specific entity ID for this error
      errorDetails: error.stack,  // Log the stack trace for debugging
      status: 'failed', // Log as a failure
    });

    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments. Please try again later.' });
  }
};


exports.updateAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, caregiverId, appointmentDate, startTime } = req.body;
    const storedValue = req.body.storedValue || req.user?._id; // Use authenticated user's ID if available

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);

    // In case appointment is not found
    if (!appointment) {
      // Log failed action due to appointment not being found
      await ActionLog.create({
        userId: storedValue,
        userRole: 'admin', // Dynamically assign role if available
        action: 'update_appointment',
        description: `Failed to update appointment. Appointment with ID ${appointmentId || 'N/A'} not found.`,
        entity: 'appointment',
        entityId: appointmentId || null,
        status: 'failed',
      });

      return res.status(404).json({ message: 'Appointment not found' });
    }

    // In case caregiver is not found
    if (caregiverId) {
      const caregiver = await Caregiver.findById(caregiverId);
      if (!caregiver) {
        // Log failed action due to caregiver not being found
        await ActionLog.create({
          userId: storedValue,
          userRole: 'admin',
          action: 'update_appointment',
          description: `Caregiver with ID ${caregiverId} not found`,
          entity: 'caregiver',
          entityId: caregiverId,
          status: 'failed',
        });
        return res.status(404).json({ message: 'Caregiver not found' });
      }
    }

    // Update appointment fields
    if (status) appointment.status = status;
    if (appointmentDate) appointment.appointmentDate = appointmentDate;
    if (startTime) appointment.startTime = startTime;

    // Set the approval timestamp if status is changed to 'approved'
    if (status === 'approved' && !appointment.approvedAt) {
      appointment.approvedAt = Date.now();
    }

    // Update caregiver if provided
    if (caregiverId) {
      appointment.caregiver = caregiverId;
    }

    // Save the updated appointment
    await appointment.save();

    // Log success after updating the appointment
    await ActionLog.create({
      userId: storedValue,
      userRole: 'admin',
      action: 'update_appointment',
      description: `Successfully updated appointment with ID ${appointmentId}`,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'success',
    });

    // Find the patient and caregiver to send the emails
    const patient = await Patient.findById(appointment.patient);
    const caregiver = await Caregiver.findById(appointment.caregiver);

    let patientSubject = '';
    let caregiverSubject = '';
    let patientMessage = '';
    let caregiverMessage = '';

    // Basic email styling and structure
    const emailStyle = `
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .email-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
        }
        .email-header {
          background-color: #007bff;
          color: white;
          padding: 10px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .email-body {
          padding: 20px;
          text-align: left;
          line-height: 1.6;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #555;
        }
        .btn {
          background-color: #28a745;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 4px;
          display: inline-block;
          margin-top: 20px;
        }
      </style>
    `;

    // Customize email content based on appointment status
    if (status === 'approved') {
      patientSubject = 'Appointment Approved';
      patientMessage = `
        <div class="email-container">
          <div class="email-header">
            <h2>Appointment Approved</h2>
          </div>
          <div class="email-body">
            <p>Dear ${patient.firstName},</p>
            <p>Your appointment on <strong>${appointment.appointmentDate}</strong> at <strong>${formatTime(appointment.startTime)}</strong> has been approved.</p>
            <p><strong>Caregiver:</strong> ${caregiver.firstName} ${caregiver.lastName}</p>
            <p>Please be on time.</p>
            <a href="#" class="btn">View Appointment Details</a>
          </div>
          <div class="footer">
            <p>Best regards,<br/>Admin</p>
          </div>
        </div>
      `;
      caregiverSubject = 'New Appointment Assignment';
      caregiverMessage = `
        <div class="email-container">
          <div class="email-header">
            <h2>New Appointment Assignment</h2>
          </div>
          <div class="email-body">
            <p>Dear ${caregiver.firstName},</p>
            <p>You have been assigned to an appointment with ${patient.firstName} ${patient.lastName}.</p>
            <p><strong>Appointment Date:</strong> ${appointment.appointmentDate}</p>
            <p><strong>Start Time:</strong> ${formatTime(appointment.startTime)}</p>
            <p>Please ensure to attend the appointment on time.</p>
            <a href="#" class="btn">View Appointment Details</a>
          </div>
          <div class="footer">
            <p>Best regards,<br/>Admin</p>
          </div>
        </div>
      `;
    }

    // Send email to patient and caregiver
    if (patient.email) {
      await nodemailer.sendMail({
        from: process.env.EMAIL, 
        to: patient.email,
        subject: patientSubject,
        html: emailStyle + patientMessage,
      });
    }

    if (caregiver && caregiver.email) {
      await nodemailer.sendMail({
        from: process.env.EMAIL, 
        to: caregiver.email,
        subject: caregiverSubject,
        html: emailStyle + caregiverMessage,
      });
    }

    // Respond with the updated appointment
    res.status(200).json({ message: 'Appointment updated successfully', appointment });
  } catch (error) {
    // Log failed action if an error occurs during appointment update
    await ActionLog.create({
      userId: storedValue,
      userRole: 'admin',
      action: 'update_appointment',
      description: `Error updating appointment with ID ${appointmentId}: ${error.message}`,
      entity: 'error',
      entityId: appointmentId,
      status: 'failed',
    });

    // Send error response
    res.status(500).json({ message: 'Error updating appointment', error });
  }
};


exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body; // Default status to 'cancelled'
    const { storedValue } = req.body;

    // Ensure storedValue exists
    const userId = storedValue || null;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      // Log the failed action
      await ActionLog.create({
        userId,
        userRole: 'admin',
        action: 'cancel_appointment',
        description: `Failed to cancel appointment: Appointment with ID ${appointmentId} not found`,
        entity: 'appointment',
        entityId: appointmentId || null,
        status: 'failed',
      });
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if the current status is already 'cancelled'
    if (appointment.status === 'canceled') {
      // Log the redundant action
      await ActionLog.create({
        userId,
        userRole: 'admin',
        action: 'cancel_appointment',
        description: `Attempted to cancel already cancelled appointment with ID ${appointmentId}`,
        entity: 'appointment',
        entityId: appointmentId,
        status: 'failed',
      });
      return res.status(400).json({ message: 'Appointment is already cancelled' });
    }

    // Update the appointment status to 'cancelled'
    appointment.status = status;

    // Save the updated appointment
    await appointment.save();

    // Find the patient to send the email
    const patient = await Patient.findById(appointment.patient);

    // Define email subject and message for the patient
    const patientSubject = 'Appointment Canceled';
    const emailStyle = `
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .email-container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; }
        .email-header { background-color: #007bff; color: white; padding: 10px; text-align: center; border-radius: 8px 8px 0 0; }
        .email-body { padding: 20px; text-align: left; line-height: 1.6; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #555; }
        .btn { background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 20px; }
      </style>
    `;

    const patientMessage = `
      <div class="email-container">
        <div class="email-header"><h2>Appointment Cancelled</h2></div>
        <div class="email-body">
          <p>Dear ${patient.firstName},</p>
          <p>We regret to inform you that your appointment that you booked on  <strong>${appointment.patientRequestedDate}</strong> at <strong>${formatTime(appointment.patientRequestedTime)}</strong> has been cancelled.</p>
          <p>Please contact us for rescheduling or further assistance.</p>
          <a href="#" class="btn">Contact Support</a>
        </div>
        <div class="footer"><p>Best regards,<br/>JKL Healthcare System</p></div>
      </div>
    `;

    // Send email to patient and handle failure
    if (patient.email) {
      try {
        await nodemailer.sendMail({
          from: process.env.EMAIL, // Use the email in your Nodemailer config
          to: patient.email,
          subject: patientSubject,
          html: emailStyle + patientMessage,
        });
      } catch (emailError) {
        // Log email failure
        await ActionLog.create({
          userId,
          userRole: 'admin',
          action: 'cancel_appointment',
          description: `Failed to send cancellation email to patient with ID ${patient._id} for appointment ${appointmentId}: ${emailError.message}`,
          entity: 'appointment',
          entityId: appointmentId,
          status: 'failed',
        });

        return res.status(500).json({ message: 'Error sending cancellation email', error: emailError });
      }
    }

    // Log the successful action
    await ActionLog.create({
      userId,
      userRole: 'admin',
      action: 'cancel_appointment',
      description: `Successfully cancelled appointment with ID ${appointmentId}`,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'success',
    });

    // Respond with the updated appointment
    res.status(200).json({ message: 'Appointment canceled successfully', appointment });
  } catch (error) {
    // Log the error
    console.log(error);

    // Log the failed action
    await ActionLog.create({
      userId: storedValue || null,
      userRole: 'admin',
      action: 'cancel_appointment',
      description: `Error canceling appointment with ID ${appointmentId}: ${error.message}`,
      entity: 'error',
      entityId: appointmentId,
      status: 'failed',
    });

    res.status(500).json({ message: 'Error canceling appointment', error });
  }
};


// exports.createCaregiver = async (req, res) => {
//   try {
//     const { firstName, lastName, email, phoneNumber, password, department, available, storedValue } = req.body;

//     const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
//     const newCaregiver = new Caregiver({
//       firstName,
//       lastName,
//       email,
//       phoneNumber,
//       password: hashedPassword, // Store the hashed password
//       department,
//       available: available !== undefined ? available : true, // Default to true if not provided
//     });

//     await newCaregiver.save();


//     // Log successful caregiver creation
//     await ActionLog.create({
//       userId: storedValue,  // Log the admin's ID from the request
//       userRole: 'admin',  // Admin is creating the caregiver
//       action: 'create_caregiver',
//       description: `New caregiver created: ${firstName} ${lastName} in department ${department}`,
//       entity: 'caregiver',
//       entityId: newCaregiver._id,  // Reference to the newly created caregiver
//       status: 'success',
//     });

//     res.status(201).json({ message: 'Caregiver created successfully', caregiver: newCaregiver });
//   } catch (error) {
//     // Log failure due to error during caregiver creation
//     await ActionLog.create({
//       userId: req.user ? storedValue : null,  // Admin's ID if logged in, else null
//       userRole: 'admin',  // Admin attempting to create caregiver
//       action: 'create_caregiver',
//       description: `Error creating caregiver: ${error.message}`,
//       entity: 'error',  // Entity is 'error' due to failure
//       entityId: null,  // No caregiver to reference due to failure
//       status: 'failed',
//     });

//     res.status(500).json({ message: error.message });
//   }
// };



// Admin can get all caregivers

exports.createCaregiver = async (req, res) => {
  const adminId = req.user.id; // Get admin ID from the token

  try {
    // Fetch admin details from the Admin collection
    const admin = await Admin.findById(adminId).select('firstName lastName');
    const adminName = admin ? `${admin.firstName} ${admin.lastName}` : 'Unknown Admin';

    const { firstName, lastName, email, phoneNumber, password, department, available } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const newCaregiver = new Caregiver({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword, // Store the hashed password
      department,
      available, // Optional field, handled in model defaults if not provided
    });

    await newCaregiver.save();

    // Log successful caregiver creation
    await ActionLog.create({
      userId: adminId,
      userRole: 'admin',
      action: 'create_caregiver',
      description: `New caregiver created by ${adminName}: ${firstName} ${lastName} in department ${department}`,
      entity: 'caregiver',
      entityId: newCaregiver._id,
      status: 'success',
    });

    res.status(201).json({ message: 'Caregiver created successfully', caregiver: newCaregiver });
  } catch (error) {
    // Log failure
    await ActionLog.create({
      userId: adminId,
      userRole: 'admin',
      action: 'create_caregiver',
      description: `Error creating caregiver by admin with ID ${adminId}: ${error.message}`,
      entity: 'error',
      entityId: null,
      status: 'failed',
    });

    res.status(500).json({ message: error.message });
  }
};


exports.getAllCaregivers = async (req, res) => {
  try {
    const caregivers = await Caregiver.find();
    res.status(200).json(caregivers);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};


//not implemented this to the frontend yet
// Admin can update a caregiver by ID
exports.updateCaregiver = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedCaregiver = await Caregiver.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedCaregiver) {
      return res.status(404).json({ message: 'Caregiver not found' });
    }
    res.status(200).json({ message: 'Caregiver updated successfully', caregiver: updatedCaregiver });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//not implemented to ui yet
// Admin can delete a caregiver by ID
exports.deleteCaregiver = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCaregiver = await Caregiver.findByIdAndDelete(id);
    if (!deletedCaregiver) {
      return res.status(404).json({ message: 'Caregiver not found' });
    }
    res.status(200).json({ message: 'Caregiver deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Helper function to calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};


// Main dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get counts
    const totalPatients = await Patient.countDocuments();
    const totalCaregivers = await Caregiver.countDocuments();
    const totalAppointments = await Appointment.countDocuments();

    // Get pending appointments
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });

    // Get active appointments (approved or in-progress)
    const activeAppointments = await Appointment.countDocuments({
      status: { $in: ['approved', 'in-progress'] }
    });

    // Get department stats
    const departmentStats = await Appointment.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      totalPatients,
      totalCaregivers,
      totalAppointments,
      pendingAppointments,
      activeAppointments,
      departmentStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
};

// Appointment analytics
exports.getAppointmentAnalytics = async (req, res) => {
  try {
    // Get appointments by status
    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get appointments by department
    const appointmentsByDepartment = await Appointment.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysAppointments = await Appointment.find({
      appointmentDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('patient caregiver', 'firstName lastName');

    // Get upcoming appointments (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingAppointments = await Appointment.find({
      appointmentDate: {
        $gt: tomorrow,
        $lte: nextWeek
      }
    }).populate('patient caregiver', 'firstName lastName');

    res.status(200).json({
      appointmentsByStatus,
      appointmentsByDepartment,
      todaysAppointments,
      upcomingAppointments
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointment analytics', error: error.message });
  }
};

// Caregiver analytics
exports.getCaregiverAnalytics = async (req, res) => {
  try {
    // Get available caregivers count
    const availableCaregivers = await Caregiver.countDocuments({ available: true });

    // Get department distribution
    const departmentDistribution = await Caregiver.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get workload distribution (appointments per caregiver)
    const workloadDistribution = await Appointment.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'in-progress'] }
        }
      },
      {
        $group: {
          _id: '$caregiver',
          appointmentCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'caregivers',
          localField: '_id',
          foreignField: '_id',
          as: 'caregiverInfo'
        }
      },
      {
        $unwind: '$caregiverInfo'
      },
      {
        $project: {
          caregiverName: {
            $concat: ['$caregiverInfo.firstName', ' ', '$caregiverInfo.lastName']
          },
          appointmentCount: 1,
          department: '$caregiverInfo.department'
        }
      }
    ]);

    res.status(200).json({
      availableCaregivers,
      departmentDistribution,
      workloadDistribution
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching caregiver analytics', error: error.message });
  }
};

// Patient analytics
exports.getPatientAnalytics = async (req, res) => {
  try {
    // Get gender distribution
    const genderDistribution = await Patient.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate age distribution
    const patients = await Patient.find({}, 'dateOfBirth');
    const ageDistribution = patients.reduce((acc, patient) => {
      const age = calculateAge(patient.dateOfBirth);
      const ageGroup = Math.floor(age / 10) * 10; // Group into decades
      acc[`${ageGroup}-${ageGroup + 9}`] = (acc[`${ageGroup}-${ageGroup + 9}`] || 0) + 1;
      return acc;
    }, {});

    // Get new patients (registered in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newPatients = await Patient.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get patients by department (based on their appointments)
    const patientsByDepartment = await Appointment.aggregate([
      {
        $group: {
          _id: {
            department: '$department',
            patient: '$patient'
          }
        }
      },
      {
        $group: {
          _id: '$_id.department',
          uniquePatients: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      genderDistribution,
      ageDistribution,
      newPatients,
      patientsByDepartment
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient analytics', error: error.message });
  }
};


