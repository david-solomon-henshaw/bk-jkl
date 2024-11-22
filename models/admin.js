// const mongoose = require('mongoose');
// const { Schema } = mongoose;
// const { encryptFieldsMiddleware, decryptFieldsMiddleware } = require('../utils/encryptionMiddleware');

// const adminSchema = new Schema({
//   firstName: { type: String, required: true },
//   lastName: { type: String, required: true },
//   email: { type: String, unique: true, required: true },
//   password: { type: String, required: true }, // This will be hashed
//   role: { type: String, default: 'admin' },
//   otp: {
//     type: String,
//   },
//   otpExpiresAt: {
//     type: Date,
//   },
//   token: { type: String } // for session management
// }, { timestamps: true });

// // Fields to encrypt (otp and token in this case)
// const fieldsToEncrypt = ['otp', 'token']; 

// // Apply encryption middleware before saving the document
// adminSchema.pre('save', encryptFieldsMiddleware(fieldsToEncrypt));

// // Apply decryption middleware after retrieving the document
// adminSchema.post('findOne', function (doc) {
//   return decryptFieldsMiddleware(fieldsToEncrypt)(doc);
// });

// adminSchema.post('find', function (docs) {
//   return docs.map(doc => decryptFieldsMiddleware(fieldsToEncrypt)(doc));
// });

// module.exports = mongoose.model('Admin', adminSchema);


// models/Admin.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // This will be hashed
  role: { type: String, default: 'admin' },
  otp: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
  token: { type: String } // for session management
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);