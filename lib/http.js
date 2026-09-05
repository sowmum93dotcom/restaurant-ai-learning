function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function persistenceError(res, error) {
  console.error("Persistence error:", error);
  return sendError(res, 503, "Your saved data is still available on this device. Online saving is temporarily unavailable.");
}

module.exports = { persistenceError, sendError };
