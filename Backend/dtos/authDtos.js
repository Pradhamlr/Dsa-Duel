import { validateEmail, validateOTP, validatePassword, validateUsername } from '../utils/validation.js';

const asValidationMessage = (validator) => (value) => {
  const result = validator(value);
  return result.valid ? true : result.error;
};

export const registerDto = {
  email: {
    type: 'string',
    required: true,
    label: 'Email',
    validate: asValidationMessage(validateEmail)
  },
  username: {
    type: 'string',
    required: false,
    label: 'Username',
    validate: asValidationMessage(validateUsername)
  },
  password: {
    type: 'string',
    required: true,
    label: 'Password',
    validate: asValidationMessage(validatePassword)
  },
  name: {
    type: 'string',
    required: false,
    label: 'Name',
    validate: (value) => value.length <= 80 || 'Name is too long'
  }
};

export const loginDto = {
  email: {
    type: 'string',
    required: false,
    label: 'Email',
    validate: asValidationMessage(validateEmail)
  },
  username: {
    type: 'string',
    required: false,
    label: 'Username',
    validate: asValidationMessage(validateUsername)
  },
  password: {
    type: 'string',
    required: true,
    label: 'Password'
  },
  __validate: (validated) => {
    if (!validated.email && !validated.username) {
      return { identifier: 'Email or username is required' };
    }
    return true;
  }
};

export const emailDto = {
  email: {
    type: 'string',
    required: true,
    label: 'Email',
    validate: asValidationMessage(validateEmail)
  }
};

export const otpDto = {
  email: {
    type: 'string',
    required: true,
    label: 'Email',
    validate: asValidationMessage(validateEmail)
  },
  otp: {
    type: 'string',
    required: true,
    label: 'OTP',
    validate: asValidationMessage(validateOTP)
  }
};

export const resetPasswordDto = {
  email: {
    type: 'string',
    required: true,
    label: 'Email',
    validate: asValidationMessage(validateEmail)
  },
  otp: {
    type: 'string',
    required: true,
    label: 'OTP',
    validate: asValidationMessage(validateOTP)
  },
  newPassword: {
    type: 'string',
    required: true,
    label: 'New password',
    validate: asValidationMessage(validatePassword)
  }
};

export const refreshTokenDto = {
  refreshToken: {
    type: 'string',
    required: true,
    label: 'Refresh token'
  }
};
