const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters.' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens. No spaces.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);

    req.session.userId = result.insertId;
    req.session.username = username;

    res.json({ message: 'Registered successfully.', username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ message: 'Logged in successfully.', username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username, userId: req.session.userId });
  } else {
    res.json({ loggedIn: false });
  }
});

router.delete('/account', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in to delete your account.' });
  }

  const userId = req.session.userId;

  try {
    await pool.query('DELETE FROM scores WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Account deleted but session could not be cleared.' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Account deleted successfully.' });
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
