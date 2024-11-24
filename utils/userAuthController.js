const Admin = require('../models/admin');
const Patient = require('../models/patient');
const Caregiver = require('../models/caregiver')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const generateOtp = require('./generateOtp');
const transporter = require('../config/nodemailerConfig');
const ActionLog = require('../models/action');  // Assuming ActionLog model is correctly defined


// Unified login function
exports.loginUser = async (req, res) => {

  const { email, password } = req.body;
  

  try {
    let user;
    let role;
    let department

    // Check if the user is an admin
    user = await Admin.findOne({ email });
    role = 'admin';


 
    if (!user) {
    //  If not admin, check if the user is a patient
      user = await Patient.findOne({ email });
      role = 'patient';

    }
    // Check if the user is a caregiver if not found as admin or patient
    if (!user) {
      user = await Caregiver.findOne({ email });
      role = 'caregiver';

    }

    if (!user) {
      // Log failed login attempt for non-existing user
      await ActionLog.create({
        userId: null,  // No valid user found, userId will be null for failed logins
        userRole: 'error',
        action: 'login',
        description: 'User not found',
        entity: 'error',
        entityId: null,
        status: 'failed',
      });
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
  
    if (!isPasswordValid) {
      // Log failed login attempt for invalid password
      await ActionLog.create({
        userId: user._id,
        userRole: user.role,
        action: 'login',
        description: 'Invalid password',
        entity: user.role,
        entityId: user._id,
        status: 'failed',
      });
      return res.status(400).json({ message: 'Invalid credentials' });
    } 

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
    await user.save();

    const htmlContent =
      ` <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
            <h2 style="color: #4CAF50; text-align: center;">OTP Verification</h2>
            <p style="font-size: 16px; color: #333;">
                Hello, please use the following OTP to complete your login:
            </p>
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 24px; font-weight: bold; color: #333;">${otp}</p>
            </div>
            <p style="font-size: 14px; color: #555;">
                This OTP is valid for a short time. If you didn't request this, please ignore this email or contact support.
            </p>
            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
                Thank you for using eMed!<br>
                The eMed Team
            </p>
        </div> `
      ;

    const info = await transporter.sendMail({
      from: 'Emed',
      to: user.email,
      subject: 'Your OTP Code',
      html: htmlContent,
    });

      // Log successful login
  await ActionLog.create({
    userId: user._id,
    userRole: user.role,
    action: 'login',
    description: 'User logged in successfully',
    entity: user.role,
    entityId: user._id,
    status: 'success',
  });

    res.status(200).json({ message: 'OTP sent to email', role });

  } catch (error) {
    console.log(error)
    
    // Log the error action in ActionLog
    await ActionLog.create({
      userId: null,  // No user context available as it's an error
      userRole: 'error',  // Role is 'error' for system-level failures
      action: 'login',
      description: 'Error logging in: ' + error.message,  // Log the error message
      entity: 'error',  // The entity will be 'error' in case of system issues
      entityId: null,  // No entity ID in case of error
      errorDetails: error.stack,  // Stack trace for debugging
      status: 'failed',
    });
    res.status(500).json({ message: 'Error logging in', error });
  } 
};
 


const generateTokens = (user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.REFRESH_TOKEN_SECRET, // Use a different secret for refresh tokens
    { expiresIn: '7d' }
  );

  return { token, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// New refresh token endpoint
exports.refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Find user based on the decoded token
    let user;
    switch (decoded.role) {
      case 'admin':
        user = await Admin.findById(decoded.id);
        break;
      case 'patient':
        user = await Patient.findById(decoded.id);
        break;
      case 'caregiver':
        user = await Caregiver.findById(decoded.id);
        break;
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new tokens
    const { token, refreshToken: newRefreshToken } = generateTokens(user);

    // Set the new refresh token as an HTTP-only cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error refreshing token' });
  }
};

// Modified verifyOtp to include secure cookie handling
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    let user = await Admin.findOne({ email }) || 
               await Patient.findOne({ email }) || 
               await Caregiver.findOne({ email });

    if (!user) {
      await ActionLog.create({
        userId: null,
        userRole: 'error',
        action: 'verify_otp',
        description: 'User not found',
        entity: 'error',
        entityId: null,
        status: 'failed',
      });
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.otp || !user.otpExpiresAt) {
      await ActionLog.create({
        userId: user._id,
        userRole: user.role,
        action: 'verify_otp',
        description: 'No OTP request found',
        entity: user.role,
        entityId: user._id,
        status: 'failed',
      });
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    const isOtpExpired = Date.now() > user.otpExpiresAt;
    const isOtpValid = user.otp === otp;

    if (!isOtpValid || isOtpExpired) {
      await ActionLog.create({
        userId: user._id,
        userRole: user.role,
        action: 'verify_otp',
        description: isOtpExpired ? 'OTP has expired' : 'Invalid OTP',
        entity: user.role,
        entityId: user._id,
        status: 'failed',
      });
      return res.status(400).json({ message: isOtpExpired ? 'OTP has expired' : 'Invalid OTP' });
    }

    const { token, refreshToken } = generateTokens(user);

    // Clear OTP data
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    await ActionLog.create({
      userId: user._id,
      userRole: user.role,
      action: 'verify_otp',
      description: 'OTP verified successfully',
      entity: user.role,
      entityId: user._id,
      status: 'success',
    });

    // Only send access token in response body
    res.status(200).json({ 
      message: 'OTP verified successfully', 
      token,
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
};