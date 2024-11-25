const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const Appointment = require('../models/appointment');
const Caregiver = require('../models/caregiver');
const Patient = require('../models/patient');
const ActionLog = require('../models/action')
const transporter = require('../config/nodemailerConfig');


// Admin registration attach to frontend adminmodal
exports.registerAdmin = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;


  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {


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


    res.status(500).json({ message: 'Error registering admin', error });
  }
};

exports.getAllAppointments = async (req, res) => {

  try {
    const appointmentsArray = await Appointment.find()
      .populate('caregiver', 'firstName lastName')
      .populate('patient', 'firstName lastName');



    res.status(200).json(appointmentsArray);
  } catch (error) {

    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments. Please try again later.' });
  }
};


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
      description: `A new caregiver was created with name: ${firstName} ${lastName} email: ${email} by ${adminName} in department ${department}`,
      entity: 'caregiver',
      entityId: newCaregiver._id,
      status: 'success',
    });

    res.status(201).json({ message: 'Caregiver created successfully', caregiver: newCaregiver });
  } catch (error) {


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


// Admin can update a caregiver by ID
exports.updateCaregiver = async (req, res) => {
  const { id } = req.params;
  const user = req.user
  try {
    const updatedCaregiver = await Caregiver.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedCaregiver) {
      return res.status(404).json({ message: 'Caregiver not found' });
    }

    // Log successful admin registration
    await ActionLog.create({
      userId: user.id,  // User ID of the new admin
      userRole: user.role,  // The role of the user
      action: 'update_caregiver',
      description: `The admin updated the caregiver  with name: ${updatedCaregiver.firstName} ${updatedCaregiver.lastName}  with email ${updatedCaregiver.email} Availability`,
      entity: 'caregiver',  // The entity being created
      entityId: user.id,  // The entity ID for the new admin
      status: 'success',
    });

    res.status(200).json({ message: 'Caregiver updated successfully', caregiver: updatedCaregiver });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin can delete a caregiver by ID
exports.deleteCaregiver = async (req, res) => {
  const { id } = req.params;

  const user = req.user
  try {
    const deletedCaregiver = await Caregiver.findByIdAndDelete(id);
    if (!deletedCaregiver) {
      return res.status(404).json({ message: 'Caregiver not found' });
    }

    // Log successful admin registration
    await ActionLog.create({
      userId: user.id,  // User ID of the new admin
      userRole: user.role,  // The role of the user
      action: 'deleted_caregiver',
      description: `The admin deleted the caregiver account with name: ${deletedCaregiver.firstName} ${deletedCaregiver.lastName}  with email ${deletedCaregiver.email} Availability`,
      entity: 'caregiver',  // The entity being created
      entityId: user.id,  // The entity ID for the new admin
      status: 'success',
    });
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

exports.reassignCaregiver = async (req, res) => {
  const { appointmentId } = req.params;
  const { caregiver } = req.body;

  const user = req.user;

  try {
    // Check if the caregiver exists and is available
    const caregiverExists = await Caregiver.findById(caregiver);
    if (!caregiverExists || !caregiverExists.available) {
      return res.status(400).json({ message: "Caregiver not available or does not exist" });
    }

    // Fetch the existing appointment to see if a caregiver was already assigned
    const existingAppointment = await Appointment.findById(appointmentId);
    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // If the appointment already has a caregiver, reset their availability to true
    let previousCaregiver = null;
    if (existingAppointment.caregiver) {
      previousCaregiver = await Caregiver.findById(existingAppointment.caregiver);
      if (previousCaregiver) {
        previousCaregiver.available = true; // Set the previous caregiver's availability to true
        await previousCaregiver.save(); // Save the updated caregiver's availability
      }
    }

    // Update the caregiver availability to false for the new caregiver
    caregiverExists.available = false;
    await caregiverExists.save(); // Save caregiver's updated availability

    // Update the appointment with the new caregiver
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { caregiver }, // Assign the new caregiver
      { new: true }
    );

    // Fetch patient details for email notification
    const patient = await Patient.findById(updatedAppointment.patient);

    // Prepare the email content
    const subject = `Caregiver Reassigned to Your Appointment`;

    // Caregiver email content (New caregiver)
    const caregiverMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; background-color: #d1ecf1;">
        <h2 style="color: #0c5460; text-align: center;">Caregiver Reassigned</h2>
        <p style="font-size: 16px; color: #333;">
          Dear <strong>${caregiverExists.firstName} ${caregiverExists.lastName}</strong>,
        </p>
        <p style="font-size: 16px; color: #333;">
          You have been reassigned to the appointment with <strong>${patient.firstName} ${patient.lastName}</strong> scheduled for <strong>${updatedAppointment.appointmentDate}</strong> at <strong>${updatedAppointment.appointmentTime}</strong>.
        </p>
        <p style="font-size: 14px; color: #555;">
          Please confirm your availability for this appointment. If you have any questions or need further assistance, please don't hesitate to reach out.
        </p>
        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          Thank you,<br>
          JKL Healthcare Team
        </p>
      </div>
    `;

    // Patient email content
    const patientMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; background-color: #d1ecf1;">
        <h2 style="color: #0c5460; text-align: center;">Caregiver Reassigned to Your Appointment</h2>
        <p style="font-size: 16px; color: #333;">
          Dear <strong>${patient.firstName} ${patient.lastName}</strong>,
        </p>
        <p style="font-size: 16px; color: #333;">
          The caregiver for your appointment scheduled on <strong>${updatedAppointment.appointmentDate}</strong> at <strong>${updatedAppointment.appointmentTime}</strong> has been reassigned to <strong>${caregiverExists.firstName} ${caregiverExists.lastName}</strong>.
        </p>
        <p style="font-size: 14px; color: #555;">
          Please contact us if you have any questions or need further information.
        </p>
        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          Thank you,<br>
          JKL Healthcare Team
        </p>
      </div>
    `;

    // Previous caregiver email content (if applicable)
    let previousCaregiverMessage = null;
    if (previousCaregiver) {
      previousCaregiverMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; background-color: #d1ecf1;">
          <h2 style="color: #0c5460; text-align: center;">Caregiver Reassignment Notification</h2>
          <p style="font-size: 16px; color: #333;">
            Dear <strong>${previousCaregiver.firstName} ${previousCaregiver.lastName}</strong>,
          </p>
          <p style="font-size: 16px; color: #333;">
            We regret to inform you that you have been removed from the appointment scheduled with <strong>${patient.firstName} ${patient.lastName}</strong> on <strong>${updatedAppointment.appointmentDate}</strong> at <strong>${updatedAppointment.appointmentTime}</strong>.
          </p>
          <p style="font-size: 14px; color: #555;">
            Please reach out if you have any questions or need further clarification.
          </p>
          <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
            Thank you,<br>
            JKL Healthcare Team
          </p>
        </div>
      `;
    }

    // Send email to the new caregiver
    await sendEmail(caregiverExists.email, subject, caregiverMessage);

    // Send email to the patient
    await sendEmail(patient.email, subject, patientMessage);

    // If there was a previous caregiver, send them an email as well
    if (previousCaregiver && previousCaregiver.email) {
      await sendEmail(previousCaregiver.email, 'Caregiver Reassignment Notification', previousCaregiverMessage);
    }

    // Log the successful caregiver reassignment
    await ActionLog.create({
      userId: user.id,  // User ID of the admin
      userRole: user.role,  // The role of the user
      action: 'Reassigned caregiver to an appointment',
      description: `The admin reassigned the caregiver ${caregiverExists.firstName} ${caregiverExists.lastName} to this appointment`,
      entity: 'appointment',  // The entity being updated
      entityId: updatedAppointment._id,  // The ID of the appointment
      status: 'success',
    });

    // Return the updated appointment
    res.status(200).json(updatedAppointment);

  } catch (error) {
    console.error("Error in reassignCaregiver:", error);

    // Log the error action in ActionLog
    await ActionLog.create({
      userId: user.id || null,
      userRole: user ? user.role : 'error',
      action: 'Reassign caregiver to appointment',
      description: 'Error reassigning caregiver: ' + error.message,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'failed',
      errorDetails: error.stack,
    });

    res.status(500).json({ message: "Server error while reassigning caregiver" });
  }
};

exports.cancelAppointment = async (req, res) => {
  const { appointmentId } = req.params;
  const user = req.user;

  try {
    // Update the appointment status to 'canceled'
    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: 'canceled' },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Fetch caregiver and patient details for email notification
    const caregiver = appointment.caregiver ? await Caregiver.findById(appointment.caregiver) : null;
    const patient = await Patient.findById(appointment.patient);

    // Prepare email content with styling
    const subject = `Appointment Canceled: ${appointment.appointmentDate}`;

    // Caregiver email content (only if a caregiver is assigned)
    const patientMessage = caregiver ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; background-color: #f8d7da;">
        <h2 style="color: #721c24; text-align: center;">Appointment Canceled</h2>
        <p style="font-size: 16px; color: #333;">
          Dear <strong>${patient.firstName} ${patient.lastName}</strong>,
        </p>
        <p style="font-size: 16px; color: #333;">
      Unfortunately, your appointment ${caregiver ? `with caregiver <strong>${caregiver.firstName} ${caregiver.lastName}</strong>` : ''} scheduled for <strong>${appointment.RequestedDate}</strong> at <strong>${appointment.RequestedTime}</strong> time has been <span style="color: #d9534f; font-weight: bold;">canceled</span>.
    </p
        <p style="font-size: 14px; color: #555;">
          If you have any questions or need further assistance, please don't hesitate to reach out.
        </p>
        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          Thank you,<br>
          JKL Healthcare Team
        </p>
      </div>
    ` : null;

    // Patient email content (always sent, even if no caregiver is attached)
    const caregiverMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; background-color: #f8d7da;">
      <h2 style="color: #721c24; text-align: center;">Appointment Canceled</h2>
      <p style="font-size: 16px; color: #333;">
        Dear <strong>${caregiver ? caregiver.firstName + ' ' + caregiver.lastName : 'Caregiver'}</strong>,
      </p>
      <p style="font-size: 16px; color: #333;">
        Unfortunately, your appointment with Patient <strong>${patient ? patient.firstName + ' ' + patient.lastName : 'Patient'}</strong> scheduled for <strong>${appointment.appointmentDate}</strong> at <strong>${appointment.appointmentTime}</strong> has been <span style="color: #d9534f; font-weight: bold;">canceled</span>.
      </p>
      <p style="font-size: 14px; color: #555;">
        If you have any questions or need further assistance, please don't hesitate to reach out.
      </p>
      <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
        Thank you,<br>
        JKL Healthcare Team
      </p>
    </div>  
    `;

    // Send email to caregiver if a caregiver is attached
    if (caregiver) {
      await sendEmail(caregiver.email, subject, caregiverMessage);
    }

    // Send email to patient
    await sendEmail(patient.email, subject, patientMessage);

    // Log successful cancellation action
    await ActionLog.create({
      userId: user._id,
      userRole: user.role,
      action: 'cancel appointment',
      description: `The Admin canceled appointment with ID: ${appointment._id}`,
      entity: 'appointment',
      entityId: appointment._id,
      status: 'success',
    });

    res.status(200).json({ message: "Appointment canceled", appointment });

  } catch (error) {
    console.error("Error in cancelAppointment:", error);

    // Log the error action in ActionLog
    await ActionLog.create({
      userId: user._id || null,
      userRole: user ? user.role : 'error',
      action: 'cancel appointment',
      description: 'Error canceling appointment: ' + error.message,
      entity: 'appointment',
      entityId: appointmentId,
      status: 'failed',
      errorDetails: error.stack,
    });

    res.status(500).json({ message: 'Error canceling appointment', error });
  }
};
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: 'your_email_address',
      to,
      subject,
      html  // Changed from text to html
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error('Error sending email');
  }
};


// Email template generator functions
const generateCaregiverEmail = (caregiver, patient, appointment) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0056b3; margin: 0;">Appointment Confirmation</h1>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 15px;">Dear <strong style="color: #2c3e50;">${caregiver.firstName}</strong>,</p>
        
        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0056b3;">
          <p style="margin: 0;">Your appointment has been approved with:</p>
          <ul style="list-style: none; padding: 0; margin: 10px 0;">
            <li style="margin: 5px 0;">
              <span style="color: #666;">Patient:</span> 
              <strong style="color: #2c3e50;">${patient.firstName} ${patient.lastName}</strong>
            </li>
            <li style="margin: 5px 0;">
              <span style="color: #666;">Date:</span> 
              <strong style="color: #2c3e50;">${appointment.appointmentDate}</strong>
            </li>
            <li style="margin: 5px 0;">
              <span style="color: #666;">Time:</span> 
              <strong style="color: #2c3e50;">${appointment.appointmentTime}</strong>
            </li>
          </ul>
        </div>

        <p style="font-size: 16px;">Please mark this in your calendar.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; color: #666;">Thank you,</p>
          <p style="margin: 5px 0; color: #0056b3; font-weight: bold;">JKL Healthcare</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generatePatientEmail = (patient, caregiver, appointment) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0056b3; margin: 0;">Appointment Confirmation</h1>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 15px;">Dear <strong style="color: #2c3e50;">${patient.firstName}</strong>,</p>
        
        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0056b3;">
          <p style="margin: 0;">Your appointment has been approved with:</p>
          <ul style="list-style: none; padding: 0; margin: 10px 0;">
            <li style="margin: 5px 0;">
              <span style="color: #666;">Caregiver:</span> 
              <strong style="color: #2c3e50;">${caregiver.firstName} ${caregiver.lastName}</strong>
            </li>
            <li style="margin: 5px 0;">
              <span style="color: #666;">Date:</span> 
              <strong style="color: #2c3e50;">${appointment.appointmentDate}</strong>
            </li>
            <li style="margin: 5px 0;">
              <span style="color: #666;">Time:</span> 
              <strong style="color: #2c3e50;">${appointment.appointmentTime}</strong>
            </li>
          </ul>
        </div>

        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #0056b3;">
            <strong>Note:</strong> Please arrive 5 minutes before your scheduled appointment time.
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; color: #666;">Thank you for choosing</p>
          <p style="margin: 5px 0; color: #0056b3; font-weight: bold;">JKL Healthcare</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

exports.approveAppointment = async (req, res) => {
  const user = req.user;

  try {
    const { appointmentId } = req.params;
    const { caregiver, appointmentDate, startTime, status } = req.body;

    // First check if appointment exists
    const existingAppointment = await Appointment.findById(appointmentId);
    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Prepare update object
    const updateData = {
      appointmentDate,
      appointmentTime: startTime,
      status,
      approvedAt: Date.now()
    };

    // Handle caregiver assignment
    if (caregiver) {
      // Check caregiver availability if needed
      const selectedCaregiver = await Caregiver.findById(caregiver);
      if (!selectedCaregiver) {
        return res.status(400).json({ message: "Caregiver not found" });
      }
      if (!selectedCaregiver.available) {
        return res.status(400).json({ message: "Caregiver is not available" });
      }

      // Assign caregiver and set availability to false
      updateData.caregiver = caregiver;
      selectedCaregiver.available = false; // Update availability
      await selectedCaregiver.save(); // Save caregiver update
    } else if (!existingAppointment.caregiver) {
      return res.status(400).json({ message: "Caregiver must be selected" });
    }

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      updateData,
      {
        new: true,  // Return the updated document
        runValidators: true  // Run schema validators
      }
    );
    const subject = `Appointment Approved: ${updatedAppointment.appointmentDate}`;
    // Fetch caregiver and patient details for email notification
    const selectedCaregiver = await Caregiver.findById(updatedAppointment.caregiver);
    const patient = await Patient.findById(updatedAppointment.patient);

    const caregiverHtml = generateCaregiverEmail(selectedCaregiver, patient, updatedAppointment);
    const patientHtml = generatePatientEmail(patient, selectedCaregiver, updatedAppointment);


    // Send HTML emails
    await sendEmail(selectedCaregiver.email, subject, caregiverHtml);
    await sendEmail(patient.email, subject, patientHtml);


    // Log successful admin registration
    await ActionLog.create({
      userId: user.id,  // User ID of the admin
      userRole: user.role,  // The role of the user
      action: 'Approved appointment',
      description: `The Admin approved an appointment`,
      entity: 'appointment',  // The entity being updated
      entityId: updatedAppointment._id,  // The ID of the appointment
      status: 'success',
    });

    return res.status(200).json({
      message: "Appointment approved and caregiver marked unavailable",
      appointment: updatedAppointment
    });

  } catch (error) {
    console.error("Error in approveAppointment:", error);
    return res.status(500).json({ message: "Error approving appointment" });
  }
};
// Updated sendEmail function to handle HTML content
