const axios = require('axios');

function appClient(cfg) {
  const base = (cfg.panel_url || '').replace(/\/+$/, '');
  return axios.create({
    baseURL: `${base}/api/application`,
    headers: {
      Authorization: `Bearer ${cfg.ptla_key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

function clientClient(cfg) {
  const base = (cfg.panel_url || '').replace(/\/+$/, '');
  return axios.create({
    baseURL: `${base}/api/client`,
    headers: {
      Authorization: `Bearer ${cfg.ptlc_key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

async function getAllServers(cfg) {
  const client = appClient(cfg);
  let servers = [];
  let page = 1;
  let totalPages = 1;
  do {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get('/servers', { params: { page, per_page: 100, include: 'node' } });
    servers = servers.concat(res.data.data);
    totalPages = res.data.meta?.pagination?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);
  return servers;
}

async function getServer(cfg, id) {
  const client = appClient(cfg);
  const res = await client.get(`/servers/${id}`, { params: { include: 'node,allocations' } });
  return res.data.data;
}

async function deleteServer(cfg, id, force = false) {
  const client = appClient(cfg);
  const endpoint = force ? `/servers/${id}/force` : `/servers/${id}`;
  await client.delete(endpoint);
}

async function suspendServer(cfg, id) {
  await appClient(cfg).post(`/servers/${id}/suspend`);
}

async function unsuspendServer(cfg, id) {
  await appClient(cfg).post(`/servers/${id}/unsuspend`);
}

async function reinstallServer(cfg, id) {
  await appClient(cfg).post(`/servers/${id}/reinstall`);
}

async function getNodes(cfg) {
  const res = await appClient(cfg).get('/nodes', { params: { per_page: 100 } });
  return res.data.data;
}

async function getUsers(cfg) {
  const client = appClient(cfg);
  let users = [];
  let page = 1;
  let totalPages = 1;
  do {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get('/users', { params: { page, per_page: 100 } });
    users = users.concat(res.data.data);
    totalPages = res.data.meta?.pagination?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);
  return users;
}

// Ambil status daya (online/offline) via Client API. Butuh PTLC key.
// Kalau tidak ada akses (403/404) atau tidak ada ptlc_key, return null ("tidak diketahui")
// daripada nebak - ini kenapa deteksi offline versi lama sering meleset.
async function getPowerState(cfg, identifier) {
  if (!cfg.ptlc_key) return null;
  try {
    const res = await clientClient(cfg).get(`/servers/${identifier}/resources`);
    return res.data?.attributes?.current_state || null; // running | offline | starting | stopping
  } catch (err) {
    return null;
  }
}

// Cek power state banyak server sekaligus, dibatasi concurrency biar gak spam panel
async function getPowerStates(cfg, servers, concurrency = 5) {
  const result = new Map();
  let idx = 0;
  async function worker() {
    while (idx < servers.length) {
      const i = idx;
      idx += 1;
      const s = servers[i];
      // eslint-disable-next-line no-await-in-loop
      const state = await getPowerState(cfg, s.attributes.identifier);
      result.set(s.attributes.id, state);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, servers.length) }, () => worker());
  await Promise.all(workers);
  return result;
}

module.exports = {
  getAllServers,
  getServer,
  deleteServer,
  suspendServer,
  unsuspendServer,
  reinstallServer,
  getNodes,
  getUsers,
  getPowerState,
  getPowerStates,
};
