export const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message || err);
  if (err.cause) console.error("   Cause:", err.cause);
  if (err.stack) console.error(err.stack);

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
