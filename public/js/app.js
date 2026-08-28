(function () {
  'use strict';

  // ---------------- API helper ----------------
  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
    return data;
  }

  // ---------------- Toast ----------------
  function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // ---------------- Modal ----------------
  function confirmModal({ title, body, confirmLabel = 'Ya, Lanjutkan' }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = body;
      const confirmBtn = document.getElementById('modal-confirm');
      const cancelBtn = document.getElementById('modal-cancel');
      confirmBtn.textContent = confirmLabel;
      overlay.classList.remove('hidden');

      function cleanup(result) {
        overlay.classList.add('hidden');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onConfirm() { cleanup(true); }
      function onCancel() { cleanup(false); }
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  // ---------------- Auth screen ----------------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
      }
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('login-msg');
    msg.textContent = '';
    msg.className = 'form-msg';
    try {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const data = await api('/auth/login', { method: 'POST', body: { username, password } });
      enterApp(data.username);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  // Password strength
  const regPassInput = document.getElementById('reg-password');
  const strengthFill = document.getElementById('strength-fill');
  const strengthLabel = document.getElementById('strength-label');

  function scorePassword(pw) {
    let score = 0;
    if (!pw) return 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
    return score; // 0-5
  }

  function updateStrengthUI(pw) {
    const score = scorePassword(pw);
    const pct = (score / 5) * 100;
    strengthFill.style.width = pct + '%';
    const colors = ['#eee', '#FF5B52', '#FF5B52', '#FFD447', '#8FE388', '#8FE388'];
    const labels = ['-', 'Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];
    strengthFill.style.backgroundColor = colors[score];
    strengthLabel.textContent = labels[score];
  }

  regPassInput.addEventListener('input', (e) => updateStrengthUI(e.target.value));

  document.getElementById('gen-pass-btn').addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    let pw = '';
    for (let i = 0; i < 14; i++) pw += chars[arr[i] % chars.length];
    regPassInput.value = pw;
    regPassInput.type = 'text';
    updateStrengthUI(pw);
    toast('Password disarankan sudah diisi otomatis — silakan dicatat', 'ok');
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('register-msg');
    msg.textContent = '';
    msg.className = 'form-msg';
    try {
      const username = document.getElementById('reg-username').value.trim();
      const password = regPassInput.value;
      const data = await api('/auth/register', { method: 'POST', body: { username, password } });
      enterApp(data.username);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.reload();
  });

  function enterApp(username) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('whoami').textContent = '@' + username;
    goToPage('dashboard');
  }

  // ---------------- Navigation ----------------
  const navBtns = document.querySelectorAll('.nav-btn');
  const pageTitleEl = document.getElementById('page-title');
  const titles = { dashboard: 'Dashboard', servers: 'Server', clean: 'Bersihkan Server', nodes: 'Node', settings: 'Pengaturan' };

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => goToPage(btn.dataset.page));
  });

  function goToPage(page) {
    navBtns.forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    pageTitleEl.textContent = titles[page] || '';
    const renderers = {
      dashboard: renderDashboard,
      servers: renderServers,
      clean: renderClean,
      nodes: renderNodes,
      settings: renderSettings,
    };
    (renderers[page] || renderDashboard)();
  }

  function content() { return document.getElementById('page-content'); }
  function loadingHtml() { return '<div class="spinner"></div>'; }

  // ---------------- Dashboard ----------------
  async function renderDashboard() {
    const el = content();
    el.innerHTML = loadingHtml();
    try {
      const status = await api('/config-status');
      if (!status.configured) {
        el.innerHTML = `
          <div class="card">
            <div class="section-title">👋 Mulai dulu yuk</div>
            <p>Konfigurasi panel kamu belum diisi. Isi URL panel dan Application API key di menu <b>Pengaturan</b> supaya dashboard bisa nampilin data server kamu.</p>
            <button class="btn btn-primary" onclick="document.querySelector('[data-page=settings]').click()">Buka Pengaturan →</button>
          </div>`;
        return;
      }

      const [stats, activity] = await Promise.all([
        api('/stats').catch((e) => ({ error: e.message })),
        api('/activity').catch(() => ({ activity: [] })),
      ]);

      if (stats.error) {
        el.innerHTML = `<div class="card"><div class="section-title">⚠️ Gagal ambil data</div><p>${stats.error}</p></div>`;
        return;
      }

      el.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card stat-yellow"><div class="num">${stats.total_servers}</div><div class="lbl">Total Server</div></div>
          <div class="stat-card stat-red"><div class="num">${stats.suspended}</div><div class="lbl">Suspended</div></div>
          <div class="stat-card stat-green"><div class="num">${stats.online ?? '?'}</div><div class="lbl">Online</div></div>
          <div class="stat-card stat-blue"><div class="num">${stats.offline ?? '?'}</div><div class="lbl">Offline</div></div>
          <div class="stat-card stat-purple"><div class="num">${stats.total_nodes}</div><div class="lbl">Node</div></div>
          <div class="stat-card stat-white"><div class="num">${stats.total_users}</div><div class="lbl">User Panel</div></div>
        </div>

        ${!stats.has_client_key ? `
        <div class="card">
          <div class="section-title">💡 Tips</div>
          <p class="help-text">Tambahkan Client API key (ptlc_...) di Pengaturan supaya status Online/Offline server bisa terdeteksi akurat, dan fitur "Bersihkan Server Offline" bisa dipakai.</p>
        </div>` : ''}

        <div class="card">
          <div class="section-title">📜 Aktivitas Terbaru <span class="badge">${activity.activity.length}</span></div>
          ${activity.activity.length === 0 ? '<div class="empty-state">Belum ada aktivitas.</div>' : `
            <div>${activity.activity.map((a) => `
              <div style="padding:8px 0;border-bottom:1.5px dashed #ddd;font-size:13px;">
                <b>${escapeHtml(a.action)}</b> ${a.detail ? '— ' + escapeHtml(a.detail) : ''}
                <div class="meta" style="color:#888;font-size:11px;">${a.created_at}</div>
              </div>`).join('')}
            </div>`}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="card"><div class="section-title">⚠️ Error</div><p>${err.message}</p></div>`;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------- Servers page ----------------
  let allServers = [];
  let selectedIds = new Set();

  async function renderServers() {
    const el = content();
    el.innerHTML = loadingHtml();
    try {
      const data = await api('/servers');
      allServers = data.servers;
      selectedIds = new Set();
      drawServerList('');
    } catch (err) {
      el.innerHTML = `<div class="card"><div class="section-title">⚠️ Gagal muat server</div><p>${err.message}</p></div>`;
    }
  }

  function drawServerList(filter) {
    const el = content();
    const q = filter.toLowerCase();
    const filtered = allServers.filter((s) => s.name.toLowerCase().includes(q) || String(s.id).includes(q));

    const rows = filtered.map((s) => {
      const stateClass = { running: 'status-running', offline: 'status-offline', starting: 'status-starting', stopping: 'status-stopping' }[s.power_state] || 'status-unknown';
      const stateLabel = { running: 'Online', offline: 'Offline', starting: 'Starting', stopping: 'Stopping', unknown: 'Tidak diketahui' }[s.power_state] || 'Tidak diketahui';
      return `
      <div class="server-row" data-id="${s.id}">
        <div class="checkbox-wrap">
          <input type="checkbox" class="row-check" data-id="${s.id}" ${s.protected ? 'disabled title="Server dilindungi"' : ''} ${selectedIds.has(s.id) ? 'checked' : ''}/>
        </div>
        <div class="info">
          <div class="name">${s.protected ? '🛡️ ' : ''}#${s.id} — ${escapeHtml(s.name)}</div>
          <div class="meta"><span class="status-dot ${stateClass}"></span>${stateLabel} ${s.suspended ? '· ⛔ Suspended' : ''} ${s.node ? '· ' + escapeHtml(s.node) : ''}</div>
        </div>
        <div class="server-actions">
          ${s.suspended
            ? `<button class="btn btn-sm btn-success act-unsuspend" data-id="${s.id}">Unsuspend</button>`
            : `<button class="btn btn-sm btn-ghost act-suspend" data-id="${s.id}">Suspend</button>`}
          <button class="btn btn-sm btn-info act-reinstall" data-id="${s.id}">Reinstall</button>
          <button class="btn btn-sm btn-danger act-delete" data-id="${s.id}" ${s.protected ? 'disabled' : ''}>Hapus</button>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div class="toolbar">
        <input type="text" id="search-input" placeholder="🔍 Cari server (nama/ID)..." value="${escapeHtml(filter)}"/>
        <button class="btn btn-ghost btn-sm" id="refresh-btn">🔄 Refresh</button>
        <button class="btn btn-ghost btn-sm" id="export-btn">⬇️ Export CSV</button>
      </div>
      <div class="toolbar">
        <button class="btn btn-danger btn-sm" id="bulk-delete-btn" disabled>🗑️ Hapus Terpilih (<span id="sel-count">0</span>)</button>
      </div>
      ${filtered.length === 0 ? '<div class="empty-state">Tidak ada server yang cocok.</div>' : rows}
    `;

    document.getElementById('search-input').addEventListener('input', (e) => drawServerList(e.target.value));
    document.getElementById('refresh-btn').addEventListener('click', renderServers);
    document.getElementById('export-btn').addEventListener('click', exportCsv);

    document.querySelectorAll('.row-check').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateBulkBtn();
      });
    });
    updateBulkBtn();

    document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);

    document.querySelectorAll('.act-suspend').forEach((b) => b.addEventListener('click', () => serverAction(b.dataset.id, 'suspend')));
    document.querySelectorAll('.act-unsuspend').forEach((b) => b.addEventListener('click', () => serverAction(b.dataset.id, 'unsuspend')));
    document.querySelectorAll('.act-reinstall').forEach((b) => b.addEventListener('click', () => serverAction(b.dataset.id, 'reinstall')));
    document.querySelectorAll('.act-delete').forEach((b) => b.addEventListener('click', () => deleteOne(b.dataset.id)));
  }

  function updateBulkBtn() {
    const btn = document.getElementById('bulk-delete-btn');
    const countEl = document.getElementById('sel-count');
    if (!btn) return;
    countEl.textContent = selectedIds.size;
    btn.disabled = selectedIds.size === 0;
  }

  async function serverAction(id, action) {
    try {
      await api(`/servers/${id}/${action}`, { method: 'POST' });
      toast(`Server #${id}: ${action} berhasil`, 'ok');
      renderServers();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  async function deleteOne(id) {
    const ok = await confirmModal({
      title: 'Hapus Server?',
      body: `Server <b>#${id}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
    });
    if (!ok) return;
    try {
      await api(`/servers/${id}`, { method: 'DELETE' });
      toast(`Server #${id} dihapus`, 'ok');
      renderServers();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    const ok = await confirmModal({
      title: `Hapus ${ids.length} Server?`,
      body: `Server terpilih akan dihapus permanen: <br><code>${ids.join(', ')}</code>`,
      confirmLabel: 'Ya, Hapus Semua',
    });
    if (!ok) return;
    try {
      const res = await api('/servers/bulk-delete', { method: 'POST', body: { ids } });
      toast(`${res.success} server dihapus${res.failed.length ? `, ${res.failed.length} gagal` : ''}`, 'ok');
      renderServers();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  function exportCsv() {
    const header = 'id,name,status,suspended,protected,node\n';
    const rows = allServers.map((s) => [s.id, `"${s.name}"`, s.power_state, s.suspended, s.protected, `"${s.node || ''}"`].join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'daftar-server.csv';
    a.click();
  }

  // ---------------- Clean page ----------------
  async function renderClean() {
    const el = content();
    el.innerHTML = `
      <div class="card">
        <div class="section-title">🧹 Bersihkan Semua Server</div>
        <p class="help-text">Menghapus SEMUA server kecuali ID yang dilindungi (diatur di Pengaturan). Gunakan hati-hati.</p>
        <button class="btn btn-danger btn-block" id="clean-all-btn">Bersihkan Semua Server</button>
      </div>
      <div class="card">
        <div class="section-title">📴 Bersihkan Server Offline Saja</div>
        <p class="help-text">Hanya menghapus server yang statusnya OFFLINE (butuh Client API key di Pengaturan biar deteksinya akurat — beda dari Application API yang tidak tahu status hidup/mati server).</p>
        <button class="btn btn-purple btn-block" id="clean-offline-btn">Bersihkan Server Offline</button>
      </div>
      <div id="clean-result"></div>
    `;

    document.getElementById('clean-all-btn').addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Bersihkan Semua Server?',
        body: 'Semua server akan dihapus PERMANEN kecuali server yang ID-nya dilindungi. Yakin lanjut?',
        confirmLabel: 'Ya, Bersihkan',
      });
      if (!ok) return;
      const resultEl = document.getElementById('clean-result');
      resultEl.innerHTML = loadingHtml();
      try {
        const res = await api('/servers/clean-all', { method: 'POST' });
        toast(`Selesai: ${res.success} server dihapus`, 'ok');
        resultEl.innerHTML = `<div class="card"><b>Hasil:</b> ${res.success} berhasil dihapus dari ${res.total_target} target. ${res.failed.length ? `Gagal: ${res.failed.join(', ')}` : ''}</div>`;
      } catch (err) {
        toast(err.message, 'err');
        resultEl.innerHTML = `<div class="card">⚠️ ${err.message}</div>`;
      }
    });

    document.getElementById('clean-offline-btn').addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Bersihkan Server Offline?',
        body: 'Server dengan status OFFLINE akan dihapus PERMANEN (server dilindungi tetap aman). Yakin lanjut?',
        confirmLabel: 'Ya, Bersihkan',
      });
      if (!ok) return;
      const resultEl = document.getElementById('clean-result');
      resultEl.innerHTML = loadingHtml();
      try {
        const res = await api('/servers/clean-offline', { method: 'POST' });
        toast(`Selesai: ${res.success} server offline dihapus`, 'ok');
        resultEl.innerHTML = `<div class="card"><b>Hasil:</b> ${res.success} server offline dihapus (ditemukan ${res.total_offline_found}). ${res.unknown_status_skipped ? `${res.unknown_status_skipped} server dilewati karena status tidak diketahui.` : ''} ${res.failed.length ? `Gagal: ${res.failed.join(', ')}` : ''}</div>`;
      } catch (err) {
        toast(err.message, 'err');
        resultEl.innerHTML = `<div class="card">⚠️ ${err.message}</div>`;
      }
    });
  }

  // ---------------- Nodes page ----------------
  async function renderNodes() {
    const el = content();
    el.innerHTML = loadingHtml();
    try {
      const data = await api('/nodes');
      if (data.nodes.length === 0) {
        el.innerHTML = '<div class="empty-state">Tidak ada node.</div>';
        return;
      }
      el.innerHTML = data.nodes.map((n) => `
        <div class="card">
          <div class="section-title">🗂️ ${escapeHtml(n.name)} ${n.maintenance ? '<span class="badge">Maintenance</span>' : ''}</div>
          <p class="help-text">RAM: ${n.memory} MB &nbsp;•&nbsp; Disk: ${n.disk} MB &nbsp;•&nbsp; ID: ${n.id}</p>
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = `<div class="card">⚠️ ${err.message}</div>`;
    }
  }

  // ---------------- Settings page ----------------
  async function renderSettings() {
    const el = content();
    el.innerHTML = loadingHtml();

    try {
      const cfg = await api('/config');

      el.innerHTML = `
        <div class="card">
          <div class="section-title">⚙️ Konfigurasi Panel Pterodactyl</div>
          <p class="help-text">Data ini cuma dipakai untuk akun kamu sendiri, tidak dibagikan ke user lain.</p>
          <form id="settings-form" class="form-grid">
            <label>URL Panel
              <input type="text" id="cfg-panel-url" placeholder="https://panel.domainkamu.com" value="${escapeHtml(cfg.panel_url || '')}" required/>
            </label>
            <label>Application API Key (ptla_...)
              <input type="password" id="cfg-ptla-key" placeholder="${cfg.ptla_key_set ? 'Terisi ' + cfg.ptla_key_preview + ' — isi ulang untuk ganti' : 'ptla_xxxxxxxx'}"/>
              <span class="help-text">Admin → Application API. Wajib diisi minimal sekali.</span>
            </label>
            <label>Client API Key (ptlc_...) — opsional tapi disarankan
              <input type="password" id="cfg-ptlc-key" placeholder="${cfg.ptlc_key_set ? 'Terisi ' + cfg.ptlc_key_preview + ' — isi ulang untuk ganti' : 'ptlc_xxxxxxxx'}"/>
              <span class="help-text">Dipakai untuk deteksi status Online/Offline server secara akurat.</span>
            </label>
            <label>ID Server yang Dilindungi
              <input type="text" id="cfg-protected" placeholder="1,2,5" value="${escapeHtml(cfg.protected_ids || '1')}"/>
              <span class="help-text">Pisahkan dengan koma. Server dengan ID ini tidak akan pernah ikut terhapus.</span>
            </label>
            <div class="form-msg" id="settings-msg"></div>
            <button type="submit" class="btn btn-primary btn-block">💾 Simpan Konfigurasi</button>
          </form>
        </div>
      `;

      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('settings-msg');
        msg.textContent = '';
        msg.className = 'form-msg';
        try {
          await api('/config', {
            method: 'POST',
            body: {
              panel_url: document.getElementById('cfg-panel-url').value.trim(),
              ptla_key: document.getElementById('cfg-ptla-key').value.trim(),
              ptlc_key: document.getElementById('cfg-ptlc-key').value.trim(),
              protected_ids: document.getElementById('cfg-protected').value.trim(),
            },
          });
          msg.textContent = 'Tersimpan!';
          msg.className = 'form-msg ok';
          toast('Konfigurasi tersimpan', 'ok');
        } catch (err) {
          msg.textContent = err.message;
          msg.className = 'form-msg error';
        }
      });
    } catch (err) {
      el.innerHTML = `<div class="card">⚠️ ${err.message}</div>`;
    }
  }

  // ---------------- Boot ----------------
  (async function boot() {
    try {
      const me = await api('/auth/me');
      enterApp(me.username);
    } catch (err) {
      // belum login, tampilkan auth screen (default)
    }
  })();
})();
