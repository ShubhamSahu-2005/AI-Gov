import { ZodError } from "zod";

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      // Zod v4 uses .issues, older versions use .errors — handle both
      const issues = err.issues || err.errors || [];
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: issues.map((e) => ({
          path: Array.isArray(e.path) ? e.path.join(".") : String(e.path),
          message: e.message,
        })),
      });
    }
    next(err);
  }
};
