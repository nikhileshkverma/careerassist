const mongoose = require('mongoose');

async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas connected successfully');
    await seedAdminUser();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

async function seedAdminUser() {
  const { User } = require('./models');
  const bcrypt = require('bcryptjs');

  const adminExists = await User.findOne({ email: 'admin@careerassist.com' });
  if (!adminExists) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    await User.create({
      email: 'admin@careerassist.com',
      password: hash,
      name: 'Admin User',
      role: 'admin',
    });
    console.log('✅ Admin user seeded: admin@careerassist.com / Admin@123');
  }
}

module.exports = { initializeDatabase };
