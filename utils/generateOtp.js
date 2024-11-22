const randomize = require('randomatic');

const generateOtp = () => randomize('0', 6);  // Generates a 6-digit OTP

module.exports = generateOtp;
