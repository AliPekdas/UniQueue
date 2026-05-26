const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db/pool');
const { verifyPassword } = require('../utils/password');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(100), email.trim().toLowerCase())
      .query(`
        SELECT userID, name, email, role, passwordHash
        FROM Users WHERE LOWER(email) = @email
      `);

    const user = result.recordset[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.userID, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        userId: user.userID,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { login };
