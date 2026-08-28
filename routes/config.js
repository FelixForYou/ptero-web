const express = require('express');
const { db, logActivity } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const cfg = db.prepare('SELECT * FROM configs WHERE user_id = ?').get(req.user.uid);
  if (!cfg) return res.json({ panel_url: '', ptla_key: '', ptlc_key: '', protected_ids: '1' });
  // Jangan kirim key penuh ke frontend demi keamanan, cuma indikasi "sudah diisi" + beberapa karakter akhir
  res.json({
    panel_url: cfg.panel_url || '',
    ptla_key_set: !!cfg.ptla_key,
    ptla_key_preview: cfg.ptla_key ? `...${cfg.ptla_key.slice(-4)}` : '',
    ptlc_key_set: !!cfg.ptlc_key,
    ptlc_key_preview: cfg.ptlc_key ? `...${cfg.ptlc_key.slice(-4)}` : '',
    protected_ids: cfg.protected_ids || '1',
  });
});

router.post('/', (req, res) => {
  const { panel_url, ptla_key, ptlc_key, protected_ids } = req.body || {};

  if (!panel_url || !/^https?:\/\//.test(panel_url)) {
    return res.status(400).json({ error: 'URL panel tidak valid (harus diawali http:// atau https://)' });
  }

  const existing = db.prepare('SELECT * FROM configs WHERE user_id = ?').get(req.user.uid);
  const cleanProtected = (protected_ids || '1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');

  db.prepare(
    `INSERT INTO configs (user_id, panel_url, ptla_key, ptlc_key, protected_ids)
     VALUES (@uid, @panel_url, @ptla_key, @ptlc_key, @protected_ids)
     ON CONFLICT(user_id) DO UPDATE SET
       panel_url = @panel_url,
       ptla_key = COALESCE(NULLIF(@ptla_key, ''), ptla_key),
       ptlc_key = CASE WHEN @ptlc_key = '__CLEAR__' THEN NULL ELSE COALESCE(NULLIF(@ptlc_key, ''), ptlc_key) END,
       protected_ids = @protected_ids`
  ).run({
    uid: req.user.uid,
    panel_url: panel_url.replace(/\/+$/, ''),
    ptla_key: ptla_key || '',
    ptlc_key: ptlc_key || '',
    protected_ids: cleanProtected || '1',
  });

  logActivity(req.user.uid, 'update_config', 'Konfigurasi panel diperbarui');
  res.json({ ok: true });
});

module.exports = router;
