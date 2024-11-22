// const express = require('express');
// const { loginUser, verifyOtp } = require('../utils/userAuthController');

// const router = express.Router();

// // Unified login route with logger
// router.post('/login',  loginUser);

// // OTP Verification Route with logger
// router.post('/verify-otp',  verifyOtp);


// module.exports = router;

const express = require('express');
const { loginUser, verifyOtp, refreshAccessToken } = require('../utils/userAuthController');
const router = express.Router();

// Unified login route with logger
router.post('/login', loginUser);

// OTP Verification Route with logger
router.post('/verify-otp', verifyOtp);

// New refresh token route
router.post('/refresh-token', refreshAccessToken);

module.exports = router;