const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/db');

/**
 * Generates a signed JWT token for the authenticated user.
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_12345_67890';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: userId }, secret, { expiresIn });
};

/**
 * POST /register
 * Registers a new user. Handles input validation, password hashing, and user creation.
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    // 3. Hash password using bcryptjs (rounds: 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create user in database
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    // 5. Generate authentication token
    const token = generateToken(user.id);

    return res.status(201).json({
      message: 'Registration successful.',
      user,
      token
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ error: 'An error occurred during registration.' });
  }
};

/**
 * POST /login
 * Authenticates user credentials. Returns JWT token if credentials are valid.
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Lookup user by email
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 3. Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Generate JWT
    const token = generateToken(user.id);

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'An error occurred during login.' });
  }
};
