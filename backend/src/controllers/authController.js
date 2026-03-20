const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { validateSignup, validateLogin, validateProfileUpdate } = require('../utils/validators');

// Generate response helper
const generateResponse = (success, message, data = null) => {
  return { success, message, data };
};

// Signup
const signup = async (req, res) => {
  try {
    const { error } = validateSignup(req.body);
    if (error) {
      return res.status(400).json(generateResponse(false, error.details[0].message));
    }

    const { username, email, password, profile = {} } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json(generateResponse(false, 'User with this email or username already exists'));
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      profile
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json(generateResponse(true, 'User created successfully', {
      user: user.toProfileJSON(),
      token
    }));
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json(generateResponse(false, 'Server error during signup'));
  }
};

// Login
const login = async (req, res) => {
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json(generateResponse(false, error.details[0].message));
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json(generateResponse(false, 'Invalid email or password'));
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(generateResponse(false, 'Invalid email or password'));
    }

    // Generate token
    const token = generateToken(user._id);

    res.json(generateResponse(true, 'Login successful', {
      user: user.toProfileJSON(),
      token
    }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(generateResponse(false, 'Server error during login'));
  }
};

// Get profile
const getProfile = async (req, res) => {
  try {
    res.json(generateResponse(true, 'Profile retrieved successfully', {
      user: req.user.toProfileJSON()
    }));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving profile'));
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { error } = validateProfileUpdate(req.body);
    if (error) {
      return res.status(400).json(generateResponse(false, error.details[0].message));
    }

    const { profile, preferences } = req.body;
    const user = req.user;

    // Update profile
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    // Update preferences
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json(generateResponse(true, 'Profile updated successfully', {
      user: user.toProfileJSON()
    }));
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(generateResponse(false, 'Server error updating profile'));
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(generateResponse(false, 'Current password and new password are required'));
    }

    if (newPassword.length < 6) {
      return res.status(400).json(generateResponse(false, 'New password must be at least 6 characters long'));
    }

    const user = req.user;

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json(generateResponse(false, 'Current password is incorrect'));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json(generateResponse(true, 'Password changed successfully'));
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(generateResponse(false, 'Server error changing password'));
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword
};
