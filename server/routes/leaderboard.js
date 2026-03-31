const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/:mode', async (req, res) => {
  const { mode } = req.params;
  const validModes = ['easy', 'classic', 'hard'];

  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT u.username, s.score, s.tries_used, s.time_used, s.created_at
       FROM scores s
       JOIN users u ON s.user_id = u.id
       WHERE s.mode = ?
       ORDER BY s.score DESC, s.time_used ASC
       LIMIT 50`,
      [mode]
    );

    res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
