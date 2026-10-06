/**
 * Zod validation middleware.
 * Usage: validate({ body: schema, query: schema, params: schema })
 * Rejects malformed input with 400 and field-level details.
 */
const { ApiError } = require('../utils/ApiError');

function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body ?? {});
        if (!parsed.success) {
          throw ApiError.badRequest('Validation failed', formatIssues(parsed.error.issues));
        }
        req.body = parsed.data;
      }
      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query ?? {});
        if (!parsed.success) {
          throw ApiError.badRequest('Invalid query parameters', formatIssues(parsed.error.issues));
        }
        // Express 5 keeps req.query read-only; merge validated values in place.
        Object.assign(req.query, parsed.data);
      }
      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params ?? {});
        if (!parsed.success) {
          throw ApiError.badRequest('Invalid parameters', formatIssues(parsed.error.issues));
        }
        req.validatedParams = parsed.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function formatIssues(issues) {
  return issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
}

module.exports = { validate, formatIssues };
