const express = require('express');
const { db, logActivity } = require('../db');
const { requireAuth } = require('../middleware/auth');
const ptla = require('../lib/pterodactyl');

const router = express.Router();
router.use(requireAuth);

function getCfg(uid) {
  const cfg = db.prepare('SELECT * FROM configs WHERE user_id = ?').get(uid);
  if (!cfg || !cfg.panel_url || !cfg.ptla_key) return null;
  return cfg;
}

function protectedSet(cfg) {
  return new Set((cfg.protected_ids || '1').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n)));
}

router.get('/config-status', (req, res) => {
  const cfg = getCfg(req.user.uid);
  res.json({ configured: !!cfg, has_client_key: !!cfg?.ptlc_key });
});

// ---- List servers (dengan status power kalau ptlc_key ada) ----
router.get('/servers', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi. Buka menu Pengaturan dulu.' });

  try {
    const servers = await ptla.getAllServers(cfg);
    const protectedIds = protectedSet(cfg);

    let states = new Map();
    if (cfg.ptlc_key) {
      states = await ptla.getPowerStates(cfg, servers, 5);
    }

    const data = servers.map((s) => {
      const a = s.attributes;
      return {
        id: a.id,
        identifier: a.identifier,
        name: a.name,
        suspended: a.suspended,
        node: a.relationships?.node?.attributes?.name || a.node,
        protected: protectedIds.has(a.id),
        power_state: cfg.ptlc_key ? states.get(a.id) || 'unknown' : 'unknown',
      };
    });

    res.json({ servers: data, has_client_key: !!cfg.ptlc_key });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil data dari panel. Cek URL panel & Application API key di Pengaturan.' });
  }
});

router.get('/nodes', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  try {
    const nodes = await ptla.getNodes(cfg);
    res.json({ nodes: nodes.map((n) => ({
      id: n.attributes.id,
      name: n.attributes.name,
      memory: n.attributes.memory,
      disk: n.attributes.disk,
      maintenance: n.attributes.maintenance_mode,
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil daftar node.' });
  }
});

router.get('/stats', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  try {
    const [servers, nodes, users] = await Promise.all([
      ptla.getAllServers(cfg),
      ptla.getNodes(cfg),
      ptla.getUsers(cfg).catch(() => []),
    ]);
    const suspended = servers.filter((s) => s.attributes.suspended).length;

    let online = null;
    let offline = null;
    if (cfg.ptlc_key) {
      const states = await ptla.getPowerStates(cfg, servers, 5);
      const values = Array.from(states.values());
      online = values.filter((v) => v === 'running').length;
      offline = values.filter((v) => v === 'offline').length;
    }

    res.json({
      total_servers: servers.length,
      suspended,
      online,
      offline,
      total_nodes: nodes.length,
      total_users: users.length,
      protected_ids: cfg.protected_ids,
      has_client_key: !!cfg.ptlc_key,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil statistik.' });
  }
});

router.get('/activity', (req, res) => {
  const rows = db.prepare('SELECT action, detail, created_at FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.uid);
  res.json({ activity: rows });
});

// ---- Aksi per-server ----
router.post('/servers/:id/suspend', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  try {
    await ptla.suspendServer(cfg, req.params.id);
    logActivity(req.user.uid, 'suspend', `Server #${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal suspend server.' });
  }
});

router.post('/servers/:id/unsuspend', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  try {
    await ptla.unsuspendServer(cfg, req.params.id);
    logActivity(req.user.uid, 'unsuspend', `Server #${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal unsuspend server.' });
  }
});

router.post('/servers/:id/reinstall', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  try {
    await ptla.reinstallServer(cfg, req.params.id);
    logActivity(req.user.uid, 'reinstall', `Server #${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal reinstall server.' });
  }
});

router.delete('/servers/:id', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  const protectedIds = protectedSet(cfg);
  if (protectedIds.has(parseInt(req.params.id, 10))) {
    return res.status(403).json({ error: 'Server ini dilindungi, tidak bisa dihapus.' });
  }
  try {
    await ptla.deleteServer(cfg, req.params.id);
    logActivity(req.user.uid, 'delete', `Server #${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal hapus server.' });
  }
});

// ---- Hapus banyak server sekaligus (dipilih manual dari checklist) ----
router.post('/servers/bulk-delete', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((n) => parseInt(n, 10)) : [];
  const protectedIds = protectedSet(cfg);
  const targets = ids.filter((id) => !protectedIds.has(id));

  let success = 0;
  const failed = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const id of targets) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ptla.deleteServer(cfg, id);
      success += 1;
    } catch (e) {
      failed.push(id);
    }
  }
  logActivity(req.user.uid, 'bulk_delete', `${success} server dihapus manual`);
  res.json({ ok: true, success, failed, skipped_protected: ids.length - targets.length });
});

// ---- Bersihkan SEMUA server kecuali yang dilindungi ----
router.post('/servers/clean-all', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  const protectedIds = protectedSet(cfg);

  try {
    const servers = await ptla.getAllServers(cfg);
    const targets = servers.filter((s) => !protectedIds.has(s.attributes.id));

    let success = 0;
    const failed = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const s of targets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await ptla.deleteServer(cfg, s.attributes.id);
        success += 1;
      } catch (e) {
        failed.push(s.attributes.id);
      }
    }
    logActivity(req.user.uid, 'clean_all', `${success} server dihapus (bersihkan semua)`);
    res.json({ ok: true, total_target: targets.length, success, failed });
  } catch (err) {
    res.status(500).json({ error: 'Gagal proses pembersihan.' });
  }
});

// ---- Bersihkan HANYA server yang OFFLINE (butuh ptlc_key untuk akurat) ----
router.post('/servers/clean-offline', async (req, res) => {
  const cfg = getCfg(req.user.uid);
  if (!cfg) return res.status(400).json({ error: 'Konfigurasi panel belum diisi.' });
  if (!cfg.ptlc_key) {
    return res.status(400).json({
      error: 'Deteksi offline butuh Client API key (ptlc_...). Application API tidak menyediakan status hidup/mati server secara akurat — ini biasanya penyebab pembersihan offline sebelumnya tidak mendeteksi apa-apa. Tambahkan Client API key di Pengaturan.',
    });
  }

  const protectedIds = protectedSet(cfg);
  try {
    const servers = await ptla.getAllServers(cfg);
    const candidates = servers.filter((s) => !protectedIds.has(s.attributes.id));
    const states = await ptla.getPowerStates(cfg, candidates, 5);

    const offlineTargets = candidates.filter((s) => states.get(s.attributes.id) === 'offline');
    const unknownCount = candidates.filter((s) => !states.get(s.attributes.id)).length;

    let success = 0;
    const failed = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const s of offlineTargets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await ptla.deleteServer(cfg, s.attributes.id);
        success += 1;
      } catch (e) {
        failed.push(s.attributes.id);
      }
    }
    logActivity(req.user.uid, 'clean_offline', `${success} server offline dihapus`);
    res.json({
      ok: true,
      total_offline_found: offlineTargets.length,
      success,
      failed,
      unknown_status_skipped: unknownCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal proses pembersihan server offline.' });
  }
});

module.exports = router;
