const jwt = require('jsonwebtoken');
const prisma = require('../utils/db');

/**
 * Authentication middleware that verifies JWT and loads the authenticated user.
 * This middleware protects endpoints and makes the user identity available to downstream controllers.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ error: 'Access token required. Please log in.' });
    }

    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_12345_67890';
    
    // Verify JWT
    jwt.verify(token, secret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
      }

      // Check if user exists in the database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'Authenticated user not found.' });
      }

      // Attach user object to the request
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Authentication Middleware Error:', error);
    res.status(500).json({ error: 'Server authentication failure.' });
  }
};

module.exports = authenticateToken;
