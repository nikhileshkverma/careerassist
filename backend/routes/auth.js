const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ActivityLog } = require('../models/index');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name||!email||!password) return res.status(400).json({ error: 'All fields required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    await ActivityLog.create({ userId: user._id, action: 'REGISTER' });
    res.status(201).json({ message: 'Account created.' });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error: 'Email and password required.' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user||!(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    await ActivityLog.create({ userId: user._id, action: 'LOGIN' });
    res.json({ token, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.get('/me', authenticateToken, (req, res) => res.json(req.user.toSafeObject()));

module.exports = router;
