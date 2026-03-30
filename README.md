# Guess the Number - Arcade Web Game

## Prerequisites
- XAMPP with MySQL running
- Node.js installed

## Database Setup
1. Open phpMyAdmin
2. Paste and run this SQL:

```sql
CREATE DATABASE IF NOT EXISTS guessgame;
USE guessgame;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mode ENUM('easy', 'classic', 'hard') NOT NULL,
  score INT NOT NULL,
  tries_used INT NOT NULL,
  time_used INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Install & Run
```bash
npm install
node server/server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Notes
- XAMPP MySQL must be running before starting the server
- Edit `.env` to change database credentials or port
