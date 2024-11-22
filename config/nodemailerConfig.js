const nodemailer = require('nodemailer');

// Set up your email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "davidsolomon230@gmail.com",         // email from .env
    pass: "eoak gseu bykm umhl"          // password from .env
  }
});

module.exports = transporter;
 