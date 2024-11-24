const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const Appointment = require('../models/appointment');
const Caregiver = require('../models/caregiver');
const nodemailer = require('../config/nodemailerConfig');
const Patient = require('../models/patient');
const ActionLog = require('../models/action')


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
    
    

    res.status(200).json(appointmentsArray );
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

  const user = req.user

  try {
    // Check if the caregiver exists and is available
    const caregiverExists = await Caregiver.findById(caregiver);
    if (!caregiverExists || !caregiverExists.available) {
      return res.status(400).json({ message: "Caregiver not available or does not exist" });
    }

    // Update the appointment with the new caregiver
    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { caregiver }, // Optionally update status to approved
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

// Log successful admin registration
await ActionLog.create({
  userId: user.id,  // User ID of the new admin
  userRole: user.role,  // The role of the user
  action: 'reassigned caregiver to an appointment',
  description: `The admin reassigned the caregiver assigned to this appointment`,
  entity: 'caregiver',  // The entity being created
  entityId: user.id,  // The entity ID for the new admin
  status: 'success',
});

    res.status(200).json(appointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while reassigning caregiver" });
  }
};



exports.cancelAppointment = async (req, res) => {
  const { appointmentId } = req.params;
  const user = req.user

  try {
    // Update the appointment status to canceled
    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: 'canceled' },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Log successful admin registration
await ActionLog.create({
  userId: user.id,  // User ID of the new admin
  userRole: user.role,  // The role of the user
  action: 'reassigned caregiver to an appointment',
  description: `The Admin canceled the appointment`,
  entity: 'caregiver',  // The entity being created
  entityId: user.id,  // The entity ID for the new admin
  status: 'success',
});

    res.status(200).json(appointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while canceling appointment" });
  }
};


exports.approveAppointment = async (req, res) => {

  const user = req.user
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
      updateData.caregiver = caregiver;
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

    // Log successful admin registration
await ActionLog.create({
  userId: user.id,  // User ID of the new admin
  userRole: user.role,  // The role of the user
  action: 'Approved apointment',
  description: `The Admin approved an appointment`,
  entity: 'caregiver',  // The entity being created
  entityId: user.id,  // The entity ID for the new admin
  status: 'success',
});
    
    return res.status(200).json({ 
      message: "Appointment approved", 
      appointment: updatedAppointment 
    });

  } catch (error) {
    console.error("Error in approveAppointment:", error);
    return res.status(500).json({ message: "Error approving appointment" });
  }
};