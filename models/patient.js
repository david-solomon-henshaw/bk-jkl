// const mongoose = require('mongoose');
// const { encryptFieldsMiddleware, decryptFieldsMiddleware } = require('../utils/encryptionMiddleware');

// const patientSchema = new mongoose.Schema({
//   firstName: { type: String, required: true },
//   lastName: { type: String, required: true },
//   email: { type: String, unique: true, required: true },
//   phoneNumber: { 
//     type: String, 
//     required: true,
//     match: [/^\d{10,15}$/, 'Please enter a valid phone number'] 
//   },
//   gender: { type: String, enum: ['male', 'female'], required: true },
//   dateOfBirth: { type: Date, required: true },
//   medicalHistory: { type: String }, // Optional field for medical history
//   password: { type: String, required: true }, // hashed password
//   otp: { type: String, default: "" },
//   otpExpiresAt: { type: Date, default: null },
//   role: { type: String, default: 'patient' },
//   appointments: [
//     {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Appointment'
//     }
//   ], // Tracks all appointments related to the patient
//   totalPrescriptions: { type: Number, default: 0 } // Optional field to track prescription counts
// });

// // Fields to encrypt
// const fieldsToEncrypt = ['phoneNumber', 'otp', 'totalPrescriptions'];

// // Apply encryption middleware before saving the document
// patientSchema.pre('save', encryptFieldsMiddleware(fieldsToEncrypt));

// // Apply decryption middleware after retrieving the document
// patientSchema.post('findOne', function (doc) {
//   return decryptFieldsMiddleware(fieldsToEncrypt)(doc);
// });

// patientSchema.post('find', function (docs) {
//   return docs.map(doc => decryptFieldsMiddleware(fieldsToEncrypt)(doc));
// });

// module.exports = mongoose.model('Patient', patientSchema);


const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phoneNumber: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  dateOfBirth: { type: Date, required: true },
  medicalHistory: { type: String }, // Optional field for medical history
  password: { type: String, required: true }, // hashed password
  otp: { type: String, default: "" },
  otpExpiresAt: { type: Date, default: null },
  role: { type: String, default: 'patient' },
  appointments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }
  ], // Tracks all appointments related to the patient
  totalPrescriptions: { type: Number, default: 0 } // Optional field to track prescription counts
});

module.exports = mongoose.model('Patient', patientSchema);