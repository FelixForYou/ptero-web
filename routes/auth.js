const express = require('express');
const { db, logActivity } = require('../db');
const { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username 3-20 karakter, huruf/angka/underscore saja' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username sudah dipakai, pilih yang lain' });
  }

  const hash = hashPassword(password);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  db.prepare('INSERT INTO configs (user_id, protected_ids) VALUES (?, ?)').run(info.lastInsertRowid, '1');

  const user = { id: info.lastInsertRowid, username };
  const token = signToken(user);
  setAuthCookie(res, token);
  logActivity(user.id, 'register', 'Akun dibuat');

  res.json({ ok: true, username });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  logActivity(user.id, 'login', 'Login berhasil');

  res.json({ ok: true, username: user.username });
});

router.post('/logout', requireAuth, (req, res) => {
  logActivity(req.user.uid, 'logout', '');
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, username: req.user.username });
});

module.exports = router;
