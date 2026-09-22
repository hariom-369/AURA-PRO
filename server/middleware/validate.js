import ApiError from '../utils/ApiError.js';

// Validates req.body (or another part of the request) against a Zod schema,
// replacing it with the parsed/coerced value on success.
export const validate = (schema, part = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Validation failed', errors));
  }
  req[part] = result.data;
  next();
};
