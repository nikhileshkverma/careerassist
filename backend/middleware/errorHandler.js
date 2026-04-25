module.exports = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Validation failed', details: Object.values(err.errors).map(e=>e.message) });
  if (err.code === 11000) return res.status(409).json({ error: `${Object.keys(err.keyValue)[0]} already exists.` });
  res.status(err.status || 500).json({ error: err.message || 'Server error.' });
};
