export function sendOk(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function sendError(res, status, code, message, details) {
  const body = { ok: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
