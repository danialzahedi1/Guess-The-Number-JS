/* ========================================
   GUESS THE NUMBER - GAME LOGIC
   ======================================== */

// --- State ---

let currentUser = null;         // { username, userId } or null
let currentMode = null;         // 'easy' | 'classic' | 'hard' | 'sandbox'
let gameSettings = {};           // { min, max, time, tries }
let targetNumber = null;
let triesLeft = 0;
let timeLeft = 0;
let timerInterval = null;
let guessHistory = [];
let pendingScore = null;         // stored if guest wins (for retroactive submit)
let submitFromWin = false;       // flag for register-from-win flow

const PRESETS = {
  easy:    { min: 1, max: 50,  time: 120, tries: 10 },
  classic: { min: 1, max: 100, time: 60,  tries: 7 },
  hard:    { min: 1, max: 200, time: 30,  tries: 5 }
};

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  selectMode('classic');

  document.getElementById('guess-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitGuess();
  });
});

// --- Auth ---

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.loggedIn) {
      currentUser = { username: data.username, userId: data.userId };
      updateNavAuth();
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
}

function updateNavAuth() {
  const userEl = document.getElementById('nav-user');
  const loginBtn = document.getElementById('nav-login-btn');
  const registerBtn = document.getElementById('nav-register-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const deleteBtn = document.getElementById('nav-delete-btn');

  if (currentUser) {
    userEl.textContent = currentUser.username;
    userEl.classList.remove('hidden');
    loginBtn.classList.add('hidden');
    registerBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    deleteBtn.classList.remove('hidden');
  } else {
    userEl.classList.add('hidden');
    loginBtn.classList.remove('hidden');
    registerBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    deleteBtn.classList.add('hidden');
  }
}

function showAuthModal(mode, fromWin = false) {
  submitFromWin = fromWin;
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchText = document.getElementById('auth-switch-text');
  const switchLink = document.getElementById('auth-switch-link');

  modal.dataset.mode = mode;

  const usernameHint = document.getElementById('username-hint');
  const confirmGroup = document.getElementById('confirm-password-group');

  if (mode === 'login') {
    title.textContent = 'Log In';
    submitBtn.textContent = 'Log In';
    switchText.textContent = "Don't have an account?";
    switchLink.textContent = 'Register';
    usernameHint.classList.add('hidden');
    confirmGroup.style.display = 'none';
  } else {
    title.textContent = 'Register';
    submitBtn.textContent = 'Register';
    switchText.textContent = 'Already have an account?';
    switchLink.textContent = 'Log In';
    usernameHint.classList.remove('hidden');
    confirmGroup.style.display = 'block';
  }

  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-confirm-password').value = '';
  hideError('auth-error');
  modal.classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  submitFromWin = false;
}

function toggleAuthMode(e) {
  e.preventDefault();
  const modal = document.getElementById('auth-modal');
  const current = modal.dataset.mode;
  showAuthModal(current === 'login' ? 'register' : 'login', submitFromWin);
}

async function handleAuth(e) {
  e.preventDefault();
  const modal = document.getElementById('auth-modal');
  const mode = modal.dataset.mode;
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const submitBtn = document.getElementById('auth-submit-btn');

  if (!username || !password) {
    showError('auth-error', 'Fill in both fields.');
    return;
  }

  if (mode === 'register') {
    if (username.length < 3 || username.length > 20) {
      showError('auth-error', 'Username must be 3-20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      showError('auth-error', 'Username can only contain letters, numbers, underscores, and hyphens. No spaces.');
      return;
    }
    const confirmPassword = document.getElementById('auth-confirm-password').value;
    if (password !== confirmPassword) {
      showError('auth-error', 'Passwords do not match.');
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Loading...';

  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showError('auth-error', data.error);
      return;
    }

    currentUser = { username: data.username };
    updateNavAuth();

    // save this before closeAuthModal() resets it to false
    const wasFromWin = submitFromWin;
    closeAuthModal();

    // if registering from win screen, auto-submit pending score
    if (wasFromWin && pendingScore) {
      await submitScoreToServer(pendingScore);
      pendingScore = null;
      refreshWinScreen();
    }
  } catch (err) {
    showError('auth-error', 'Connection error. Try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'login' ? 'Log In' : 'Register';
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateNavAuth();
  } catch (err) {
    console.error('Logout failed:', err);
  }
}

// --- Mode Selection ---

function selectMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === mode);
  });

  const minEl = document.getElementById('setting-min');
  const maxEl = document.getElementById('setting-max');
  const timeEl = document.getElementById('setting-time');
  const triesEl = document.getElementById('setting-tries');

  if (PRESETS[mode]) {
    const p = PRESETS[mode];
    minEl.value = p.min;
    maxEl.value = p.max;
    timeEl.value = p.time;
    triesEl.value = p.tries;
    minEl.disabled = true;
    maxEl.disabled = true;
    timeEl.disabled = true;
    triesEl.disabled = true;
  } else {
    minEl.disabled = false;
    maxEl.disabled = false;
    timeEl.disabled = false;
    triesEl.disabled = false;
  }

  hideError('setup-error');
}

// --- Start Game ---

function startGame() {
  const min = parseInt(document.getElementById('setting-min').value);
  const max = parseInt(document.getElementById('setting-max').value);
  const time = parseInt(document.getElementById('setting-time').value);
  const tries = parseInt(document.getElementById('setting-tries').value);

  if (isNaN(min) || isNaN(max) || isNaN(time) || isNaN(tries)) {
    showError('setup-error', 'All fields must be valid numbers.');
    return;
  }

  if (min >= max) {
    showError('setup-error', 'Max must be greater than Min.');
    return;
  }

  if (time < 5) {
    showError('setup-error', 'Time must be at least 5 seconds.');
    return;
  }

  if (tries < 1) {
    showError('setup-error', 'Must allow at least 1 try.');
    return;
  }

  gameSettings = { min, max, time, tries };
  targetNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  triesLeft = tries;
  timeLeft = time;
  guessHistory = [];
  pendingScore = null;

  // update HUD
  document.getElementById('hud-mode').textContent = capitalize(currentMode);
  document.getElementById('hud-time').textContent = timeLeft;
  document.getElementById('hud-time').classList.remove('danger');
  document.getElementById('hud-tries').textContent = triesLeft;
  document.getElementById('game-min').textContent = min;
  document.getElementById('game-max').textContent = max;
  document.getElementById('guess-input').value = '';
  document.getElementById('guess-input').disabled = false;
  document.getElementById('guess-btn').disabled = false;
  document.getElementById('game-feedback').classList.add('hidden');
  document.getElementById('guess-history').innerHTML = '';

  showScreen('game');
  document.getElementById('guess-input').focus();
  startTimer();
}

// --- Timer ---

function startTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;

    const timeEl = document.getElementById('hud-time');
    timeEl.textContent = timeLeft;

    if (timeLeft <= 10) {
      timeEl.classList.add('danger');
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame('time');
    }
  }, 1000);
}

// --- Guess ---

function submitGuess() {
  const input = document.getElementById('guess-input');
  const val = parseInt(input.value);

  if (isNaN(val)) return;

  if (val < gameSettings.min || val > gameSettings.max) {
    showFeedback(`Enter a number between ${gameSettings.min} and ${gameSettings.max}`, 'too-high');
    triggerShake(input);
    return;
  }

  triesLeft--;
  document.getElementById('hud-tries').textContent = triesLeft;

  if (val === targetNumber) {
    clearInterval(timerInterval);
    winGame();
    return;
  }

  const direction = val > targetNumber ? 'high' : 'low';
  const label = val > targetNumber ? 'Too high!' : 'Too low!';

  guessHistory.push({ val, direction });
  addHistoryChip(val, direction);
  showFeedback(label, direction === 'high' ? 'too-high' : 'too-low');
  triggerShake(input);

  input.value = '';
  input.focus();

  if (triesLeft <= 0) {
    clearInterval(timerInterval);
    endGame('tries');
  }
}

function showFeedback(text, className) {
  const fb = document.getElementById('game-feedback');
  fb.textContent = text;
  fb.className = 'feedback ' + className;
  fb.classList.remove('hidden');
}

function addHistoryChip(val, direction) {
  const chip = document.createElement('span');
  chip.className = 'history-chip ' + direction;
  chip.textContent = val;
  document.getElementById('guess-history').appendChild(chip);
}

function triggerShake(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('shake');
}

// --- Win ---

function winGame() {
  const timeTaken = gameSettings.time - timeLeft;
  const triesUsed = gameSettings.tries - triesLeft;
  const score = Math.floor((triesLeft * 100) + (timeLeft * 10));

  document.getElementById('win-mode').textContent = capitalize(currentMode);
  document.getElementById('win-time').textContent = timeTaken + 's';
  document.getElementById('win-tries').textContent = triesUsed;
  document.getElementById('win-score').textContent = score;

  const leaderboardSection = document.getElementById('win-leaderboard-section');
  const guestPrompt = document.getElementById('win-guest-prompt');
  const submitBtn = document.getElementById('win-submit-btn');
  const submitMsg = document.getElementById('win-submit-msg');

  submitMsg.classList.add('hidden');
  submitMsg.className = 'hidden';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit to Leaderboard';

  if (currentMode === 'sandbox') {
    leaderboardSection.classList.add('hidden');
    guestPrompt.classList.add('hidden');
  } else if (currentUser) {
    leaderboardSection.classList.remove('hidden');
    guestPrompt.classList.add('hidden');
  } else {
    leaderboardSection.classList.add('hidden');
    guestPrompt.classList.remove('hidden');
    pendingScore = {
      mode: currentMode,
      score,
      triesUsed,
      timeUsed: timeTaken
    };
  }

  // store score data for submit
  document.getElementById('win-submit-btn').dataset.score = JSON.stringify({
    mode: currentMode,
    score,
    triesUsed,
    timeUsed: timeTaken
  });

  showScreen('win');
}

function refreshWinScreen() {
  const leaderboardSection = document.getElementById('win-leaderboard-section');
  const guestPrompt = document.getElementById('win-guest-prompt');
  const submitMsg = document.getElementById('win-submit-msg');

  if (currentUser && currentMode !== 'sandbox') {
    guestPrompt.classList.add('hidden');
    leaderboardSection.classList.remove('hidden');

    submitMsg.textContent = 'Score submitted!';
    submitMsg.className = 'success';
    submitMsg.classList.remove('hidden');

    document.getElementById('win-submit-btn').disabled = true;
  }
}

async function submitScore() {
  const btn = document.getElementById('win-submit-btn');
  const msg = document.getElementById('win-submit-msg');
  const scoreData = JSON.parse(btn.dataset.score);

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const success = await submitScoreToServer(scoreData);

  if (success) {
    msg.textContent = 'Score submitted!';
    msg.className = 'success';
    btn.textContent = 'Submitted';
  } else {
    msg.textContent = 'Failed to submit. Try again.';
    msg.className = 'error';
    btn.disabled = false;
    btn.textContent = 'Submit to Leaderboard';
  }

  msg.classList.remove('hidden');
}

async function submitScoreToServer(scoreData) {
  try {
    const res = await fetch('/api/game/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData)
    });

    return res.ok;
  } catch (err) {
    console.error('Score submission error:', err);
    return false;
  }
}

// --- Game Over ---

function endGame(reason) {
  document.getElementById('guess-input').disabled = true;
  document.getElementById('guess-btn').disabled = true;

  const reasonText = reason === 'time' ? 'You ran out of time!' : 'You ran out of tries!';
  document.getElementById('gameover-reason').textContent = reasonText;
  document.getElementById('gameover-number').textContent = targetNumber;

  showScreen('gameover');
}

// --- Navigation ---

function playAgain() {
  startGame();
}

function backToSetup() {
  clearInterval(timerInterval);
  showScreen('setup');
}

function showScreen(name) {
  clearInterval(timerInterval);

  // don't kill timer if switching to the game screen
  if (name === 'game') {
    // timer started by startGame
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const screen = document.getElementById('screen-' + name);
  if (screen) {
    screen.classList.add('active');
    // force re-trigger animation
    screen.style.animation = 'none';
    void screen.offsetWidth;
    screen.style.animation = '';
  }

  if (name === 'leaderboard') {
    loadLeaderboard('easy');
  }
}

// --- Leaderboard ---

let currentLBMode = 'easy';

function switchLeaderboardTab(mode) {
  currentLBMode = mode;

  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  loadLeaderboard(mode);
}

async function loadLeaderboard(mode) {
  const body = document.getElementById('lb-body');
  const table = document.getElementById('lb-table');
  const loading = document.getElementById('lb-loading');
  const empty = document.getElementById('lb-empty');
  const error = document.getElementById('lb-error');

  body.innerHTML = '';
  table.classList.add('hidden');
  empty.classList.add('hidden');
  error.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const res = await fetch(`/api/leaderboard/${mode}`);

    if (!res.ok) throw new Error('Failed to load');

    const data = await res.json();
    loading.classList.add('hidden');

    if (data.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    data.forEach((row, i) => {
      const tr = document.createElement('tr');
      if (i < 3) tr.className = `rank-${i + 1}`;

      const date = new Date(row.created_at).toLocaleDateString();

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHTML(row.username)}</td>
        <td>${row.score}</td>
        <td>${row.tries_used}</td>
        <td>${row.time_used}s</td>
        <td>${date}</td>
      `;

      body.appendChild(tr);
    });

    table.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    showError('lb-error', 'Could not load leaderboard.');
    error.classList.remove('hidden');
  }
}

// --- Helpers ---

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(id) {
  document.getElementById(id).classList.add('hidden');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Delete Account ---

function showDeleteModal() {
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('delete-confirm-btn').disabled = true;
  hideError('delete-error');
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
}

function checkDeleteInput() {
  const val = document.getElementById('delete-confirm-input').value;
  document.getElementById('delete-confirm-btn').disabled = val !== 'DELETE';
}

async function deleteAccount() {
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const res = await fetch('/api/auth/account', { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showError('delete-error', data.error);
      btn.disabled = false;
      btn.textContent = 'Delete My Account';
      return;
    }

    currentUser = null;
    updateNavAuth();
    closeDeleteModal();
    backToSetup();
  } catch (err) {
    showError('delete-error', 'Connection error. Try again.');
    btn.disabled = false;
    btn.textContent = 'Delete My Account';
  }
}
