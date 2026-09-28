(() => {
  'use strict';
  const ROTATION_SECONDS = 15;
  const pages = ['system', 'mirakurun', 'epgstation', 'jellyfin'];
  let activeIndex = 0;
  let secondsLeft = ROTATION_SECONDS;

  const byId = (id) => document.getElementById(id);
  const pad = (number) => String(number).padStart(2, '0');

  function updateClock() {
    const now = new Date();
    byId('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.querySelectorAll('.last-update').forEach((item) => { item.textContent = byId('clock').textContent; });
  }

  function makePath(values, offset) {
    const width = 500 / (values.length - 1);
    return values.map((value, index) => `${index ? 'L' : 'M'}${(index * width).toFixed(1)},${(88 - value + offset).toFixed(1)}`).join(' ');
  }

  function renderSystem(data) {
    const coreBars = byId('coreBars');
    const cores = data.cores || [];
    coreBars.innerHTML = cores.map((value, index) => `<div><small>C${index}</small><span><i style="height:${value}%"></i></span><b>${value}%</b></div>`).join('') || 'NO CPU SAMPLE';
    byId('cpuTotal').textContent = data.cpu_percent ?? 'N/A';
    byId('cpuTemp').textContent = data.temperature_c == null ? 'N/A' : `${data.temperature_c.toFixed(1)}°C`;
    byId('loadAvg').textContent = (data.load || []).join(' / ') || 'N/A';
    const m = data.memory || {}; byId('memUsed').textContent = bytes(m.used); byId('memAvail').textContent = bytes(m.available); byId('memPct').textContent = `${m.percent ?? 'N/A'}%`; byId('memBar').style.width = `${m.percent || 0}%`;
    byId('netRx').textContent = rate(data.network?.rx); byId('netTx').textContent = rate(data.network?.tx);
    setDisk('rootDisk', 'rootDiskBar', data.storage?.root); setDisk('recordDisk', 'recordDiskBar', data.storage?.recording);
    const playback = data.current_playback; const logo = byId('nowPlayingLogo');
    byId('nowPlayingState').textContent = playback?.state || 'JELLYFIN STATUS'; byId('nowPlayingTitle').textContent = playback?.channel || 'NO ACTIVE PLAYBACK'; byId('nowPlayingClient').textContent = playback ? `${playback.user} · ${playback.client}` : '—';
    if (playback?.item_id) { logo.src = `/api/jellyfin-image/${playback.item_id}`; logo.hidden = false; } else { logo.removeAttribute('src'); logo.hidden = true; }
  }

  function renderTuners(data) {
    byId('tunerGrid').innerHTML = (data.tuners || []).map((tuner) => `<article class="tuner ${tuner.state.toLowerCase()}"><div class="tuner-top"><span>${tuner.types.join(' / ')}</span><b><i></i>${tuner.state}</b></div><h2>${tuner.name}</h2><p>CURRENT CHANNEL</p><strong>${tuner.channel}</strong></article>`).join('') || '<p>CONNECTION LOST</p>';
  }

  const bytes = (value) => value == null ? 'N/A' : `${(value / 1024 ** 3).toFixed(1)} GiB`;
  const rate = (value) => value == null ? 'SAMPLING…' : value > 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MB/s` : `${(value / 1024).toFixed(1)} KB/s`;
  const setDisk = (label, bar, data) => { byId(label).textContent = data ? `${bytes(data.free)} FREE` : 'UNAVAILABLE'; byId(bar).style.width = `${data?.percent || 0}%`; };
  const formatTime = (value) => value ? new Date(value).toLocaleString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'UNAVAILABLE';
  function renderEpg(data) {
    const current = data.recordings?.[0]; const next = data.next_recording;
    byId('recordingState').textContent = current ? 'RECORDING' : (data.status === 'ONLINE' ? 'RECORDING IDLE' : 'CONNECTION LOST');
    byId('recordingDetail').textContent = current ? `${current.title} · ${current.channel}` : (data.error || 'NO ACTIVE EPGSTATION RECORDING');
    byId('recordingTime').textContent = current ? `${formatTime(current.start_at)} — ${formatTime(current.end_at)}` : '—';
    byId('nextChannel').textContent = next?.channel || 'UNAVAILABLE'; byId('nextTitle').textContent = next?.title || 'NO UPCOMING RECORDINGS'; byId('nextTime').textContent = next ? `${formatTime(next.start_at)} — ${formatTime(next.end_at)}` : '—'; byId('reserveState').textContent = next ? 'READY' : 'N/A';
    byId('epgDiskPct').textContent = data.storage?.percent ?? '—'; byId('epgDiskBar').style.width = `${data.storage?.percent || 0}%`; byId('epgDiskFree').textContent = data.storage ? `${bytes(data.storage.free)} FREE · ${data.storage.path}` : 'UNAVAILABLE';
  }
  function renderJellyfin(data) {
    const session = data.sessions?.[0]; byId('jellyStatus').textContent = data.status; byId('jellyUpdate').textContent = data.last_update || '—'; byId('sessionCount').textContent = data.sessions?.length ?? '—';
    byId('playState').textContent = session?.state || (data.status === 'ONLINE' ? 'NO ACTIVE PLAYBACK' : 'UNAVAILABLE'); byId('sessionUser').textContent = session ? `${session.user} · ${session.device}` : '—'; byId('sessionTitle').textContent = session?.title || '—'; byId('sessionClient').textContent = session?.client || data.error || '—';
    const hasDuration = Boolean(session?.runtime_ticks); const percent = hasDuration ? Math.round(100 * session.position_ticks / session.runtime_ticks) : null;
    byId('sessionProgress').style.width = `${percent ?? 0}%`; byId('sessionElapsed').textContent = session ? (hasDuration ? `${percent}% ELAPSED` : 'LIVE STREAM') : '—'; byId('sessionTotal').textContent = session ? (hasDuration ? 'TOTAL DURATION' : 'DURATION UNAVAILABLE') : '—'; byId('jellyNote').textContent = data.error || 'SESSION DATA IS READ-ONLY';
  }

  async function refresh() {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      byId('dataMode').textContent = 'LIVE LOCAL DATA';
      renderSystem(data.system); renderTuners(data.mirakurun); renderEpg(data.epgstation); renderJellyfin(data.jellyfin);
      document.querySelectorAll('.last-update').forEach((item) => { item.textContent = data.mirakurun.last_update || 'UNAVAILABLE'; });
    } catch (_) { byId('dataMode').textContent = 'LOCAL API UNAVAILABLE'; }
  }

  function showPage(index) {
    activeIndex = (index + pages.length) % pages.length;
    const page = pages[activeIndex];
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === page));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.target === page));
    byId('pageName').textContent = page.toUpperCase();
    secondsLeft = ROTATION_SECONDS;
    byId('countdown').textContent = secondsLeft;
  }

  function tick() {
    secondsLeft -= 1;
    if (secondsLeft <= 0) showPage(activeIndex + 1);
    else byId('countdown').textContent = secondsLeft;
  }

  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showPage(pages.indexOf(button.dataset.target))));
  updateClock();
  refresh();
  setInterval(updateClock, 1000);
  setInterval(tick, 1000);
  setInterval(refresh, 5000);
})();
