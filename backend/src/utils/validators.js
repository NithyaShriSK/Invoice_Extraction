const Joi = require('joi');

// Signup validation
const validateSignup = (data) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    profile: Joi.object({
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      phone: Joi.string().optional(),
      company: Joi.string().optional()
    }).optional()
  });

  return schema.validate(data);
};

// Login validation
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  return schema.validate(data);
};

// Profile update validation
const validateProfileUpdate = (data) => {
  const schema = Joi.object({
    profile: Joi.object({
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      phone: Joi.string().optional(),
      company: Joi.string().optional()
    }).optional(),
    preferences: Joi.object({
      language: Joi.string().optional(),
      emailNotifications: Joi.boolean().optional(),
      theme: Joi.string().optional()
    }).optional()
  });

  return schema.validate(data);
};

// Invoice update validation
const validateInvoiceUpdate = (data) => {
  const schema = Joi.object({
    correctedData: Joi.object().required(),
    extractedFields: Joi.object().optional()
  });

  return schema.validate(data);
};

module.exports = {
  validateSignup,
  validateLogin,
  validateProfileUpdate,
  validateInvoiceUpdate
};
