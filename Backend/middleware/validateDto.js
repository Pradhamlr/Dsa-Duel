import AppError from '../utils/AppError.js';

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : value
);

export const validateDto = (schema) => (req, res, next) => {
  const body = isPlainObject(req.body) ? req.body : {};
  const validated = {};
  const errors = {};

  for (const [field, rules] of Object.entries(schema)) {
    if (field === '__validate') continue;

    const rawValue = normalizeString(body[field]);
    const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== '';

    if (rules.required && !hasValue) {
      errors[field] = `${rules.label || field} is required`;
      continue;
    }

    if (!hasValue) {
      if (rules.default !== undefined) validated[field] = rules.default;
      continue;
    }

    if (rules.type && typeof rawValue !== rules.type) {
      errors[field] = `${rules.label || field} must be a ${rules.type}`;
      continue;
    }

    if (rules.validate) {
      const result = rules.validate(rawValue, validated, body);
      if (result !== true) {
        errors[field] = result || `${rules.label || field} is invalid`;
        continue;
      }
    }

    validated[field] = rawValue;
  }

  if (schema.__validate) {
    const result = schema.__validate(validated, body);
    if (result && result !== true) {
      Object.assign(errors, result);
    }
  }

  if (Object.keys(errors).length > 0) {
    return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedBody = validated;
  next();
};

export default validateDto;
