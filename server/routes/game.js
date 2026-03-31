const express = require('express');
const pool = require('../db');

const router = express.Router();

router.post('/score', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in to submit a score.' });
  }

  const { mode, score, triesUsed, timeUsed } = req.body;
  const validModes = ['easy', 'classic', 'hard'];

  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid game mode.' });
  }

  if (typeof score !== 'number' || typeof triesUsed !== 'number' || typeof timeUsed !== 'number') {
    return res.status(400).json({ error: 'Invalid score data.' });
  }

  try {
    await pool.query(
      'INSERT INTO scores (user_id, mode, score, tries_used, time_used) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, mode, score, triesUsed, timeUsed]
    );

    res.json({ message: 'Score submitted successfully.' });
  } catch (err) {
    console.error('Score submit error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
