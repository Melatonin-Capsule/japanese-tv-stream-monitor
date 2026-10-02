(() => {
  'use strict';
  const configuredRotation = Number(window.LCARS_CONFIG?.PAGE_ROTATION_SECONDS);
  const ROTATION_SECONDS = Number.isFinite(configuredRotation) && configuredRotation >= 5
    ? configuredRotation
    : 30;
  const allPages = ['system', 'mirakurun', 'epgstation', 'jellyfin'];
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  let pages = [...allPages];
  let activeIndex = 0;
  let secondsLeft = ROTATION_SECONDS;
  const networkHistory = { rx: [], tx: [] };

  const byId = (id) => document.getElementById(id);
  const pad = (number) => String(number).padStart(2, '0');
  const temperatureClass = (value) => value >= 80 ? 'temperature-high' : value >= 60 ? 'temperature-medium' : 'temperature-low';

  function updateClock() {
    const now = new Date();
    byId('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.querySelectorAll('.last-update').forEach((item) => { item.textContent = byId('clock').textContent; });
  }

  function makePath(values, offset) {
    if (values.length < 2) return '';
    const width = 500 / (values.length - 1);
    return values.map((value, index) => `${index ? 'L' : 'M'}${(index * width).toFixed(1)},${(88 - value + offset).toFixed(1)}`).join(' ');
  }

  function renderNetworkGraph(rx, tx) {
    if (rx != null && tx != null) {
      networkHistory.rx.push(rx); networkHistory.tx.push(tx);
      if (networkHistory.rx.length > 45) { networkHistory.rx.shift(); networkHistory.tx.shift(); }
    }
    const all = [...networkHistory.rx, ...networkHistory.tx];
    if (!all.length) return;
    const maximum = Math.max(...all, 1);
    const scale = (values) => values.map((value) => 8 + (value / maximum) * 72);
    byId('rxPath').setAttribute('d', makePath(scale(networkHistory.rx), 0));
    byId('txPath').setAttribute('d', makePath(scale(networkHistory.tx), 0));
  }

  function renderCpuHistory(history) {
    const points = Array.isArray(history) ? history.filter((point) => Number.isFinite(Number(point.percent))) : [];
    const step = Math.max(1, Math.ceil(points.length / 180));
    const visible = points.filter((_, index) => index % step === 0 || index === points.length - 1);
    const values = visible.map((point) => Math.max(0, Math.min(100, Number(point.percent))));
    byId('cpuHistoryPath').setAttribute('d', makePath(values, 0));
    if (points.length > 1) {
      const seconds = Number(points.at(-1).timestamp) - Number(points[0].timestamp);
      byId('cpuHistorySpan').textContent = seconds >= 3540 ? 'LAST HOUR' : `${Math.max(1, Math.ceil(seconds / 60))} MIN`;
    }
  }

  function renderSystem(data) {
    const coreBars = byId('coreBars');
    const cores = data.cores || [];
    coreBars.innerHTML = cores.map((value, index) => `<div><small>C${index}</small><span><i style="height:${value}%"></i></span><b>${value}%</b></div>`).join('') || 'NO CPU SAMPLE';
    byId('cpuTotal').textContent = data.cpu_percent ?? 'N/A';
    renderCpuHistory(data.cpu_history);
    byId('cpuTemp').textContent = data.temperature_c == null ? 'N/A' : `${data.temperature_c.toFixed(1)}°C`;
    const packageTemperature = Number(data.temperature_c);
    const packageTempElement = byId('cpuPackageTemp');
    packageTempElement.textContent = Number.isFinite(packageTemperature) ? `${packageTemperature.toFixed(1)}°C` : 'N/A';
    packageTempElement.className = Number.isFinite(packageTemperature) ? temperatureClass(packageTemperature) : '';
    const temperatures = data.core_temperatures || [];
    byId('coreTemperatureBars').innerHTML = temperatures.map((reading) => {
      const value = Number(reading.temperature_c);
      const height = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
      const level = Number.isFinite(value) ? temperatureClass(value) : '';
      return `<div><small>${reading.label}</small><span><i class="${level}" style="height:${height}%"></i></span><b class="${level}">${Number.isFinite(value) ? `${value.toFixed(0)}°` : '—'}</b></div>`;
    }).join('') || '<span class="core-temperature-unavailable">SENSOR UNAVAILABLE</span>';
    byId('loadAvg').textContent = (data.load || []).join(' / ') || 'N/A';
    const m = data.memory || {}; byId('memUsed').textContent = bytes(m.used); byId('memAvail').textContent = bytes(m.available); byId('memPct').textContent = `${m.percent ?? 'N/A'}%`; byId('memBar').style.width = `${m.percent || 0}%`;
    byId('netRx').textContent = rate(data.network?.rx); byId('netTx').textContent = rate(data.network?.tx);
    renderNetworkGraph(data.network?.rx, data.network?.tx);
    setDisk('rootDisk', 'rootDiskPct', 'rootDiskBar', data.storage?.root);
    setDisk('recordDisk', 'recordDiskPct', 'recordDiskBar', data.storage?.recording);
  }

  function renderTuners(data) {
    byId('tunerGrid').innerHTML = (data.tuners || []).map((tuner) => `<article class="tuner ${tuner.state.toLowerCase()}"><div class="tuner-top"><span>${tuner.types.join(' / ')}</span><b><i></i>${tuner.state}</b></div><h2>${tuner.name}</h2><div class="tuner-channel">${tuner.logo_service_id ? `<img class="tuner-logo" src="/api/mirakurun-logo/${tuner.logo_service_id}" alt="">` : ''}<div><p>CURRENT CHANNEL</p><strong>${tuner.channel}</strong></div></div></article>`).join('') || '<p>CONNECTION LOST</p>';
  }

  const bytes = (value) => value == null ? 'N/A' : `${(value / 1024 ** 3).toFixed(1)} GiB`;
  const rate = (value) => value == null ? 'SAMPLING…' : value > 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MB/s` : `${(value / 1024).toFixed(1)} KB/s`;
  const setDisk = (label, percent, bar, data) => {
    byId(label).textContent = data ? `${bytes(data.free)} FREE` : 'UNAVAILABLE';
    byId(percent).textContent = data ? `${data.percent}%` : '—';
    byId(bar).style.width = `${data?.percent || 0}%`;
  };
  const formatTime = (value) => value ? new Date(value).toLocaleString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'UNAVAILABLE';
  function renderEpg(data) {
    const current = data.recordings?.find((recording) => recording.is_recording) || null; const next = data.next_recording;
    byId('recordingIndicator').hidden = !current;
    byId('recordingState').textContent = current ? 'RECORDING' : (data.status === 'ONLINE' ? 'RECORDING IDLE' : 'CONNECTION LOST');
    byId('recordingDetail').textContent = current ? `${current.title} · ${current.channel}` : (data.error || 'NO ACTIVE EPGSTATION RECORDING');
    byId('recordingTime').textContent = current ? `${formatTime(current.start_at)} — ${formatTime(current.end_at)}` : '—';
    byId('nextChannel').textContent = next?.channel || 'UNAVAILABLE'; byId('nextTitle').textContent = next?.title || 'NO UPCOMING RECORDINGS'; byId('nextTime').textContent = next ? `${formatTime(next.start_at)} — ${formatTime(next.end_at)}` : '—'; byId('reserveState').textContent = next ? 'READY' : 'N/A';
    byId('epgDiskPct').textContent = data.storage?.percent ?? '—'; byId('epgDiskBar').style.width = `${data.storage?.percent || 0}%`; byId('epgDiskFree').textContent = data.storage ? `${bytes(data.storage.free)} FREE · ${data.storage.path}` : 'UNAVAILABLE';
  }
  function renderJellyfin(data) {
    const session = data.sessions?.[0]; byId('jellyStatus').textContent = data.status; byId('jellyUpdate').textContent = data.last_update || '—'; byId('sessionCount').textContent = data.sessions?.length ?? '—';
    const jellyfinActive = Boolean(session);
    byId('railTelemetry').classList.toggle('is-transmitting', jellyfinActive);
    byId('dishOutboundRings').hidden = !jellyfinActive;
    byId('playState').textContent = session?.state || (data.status === 'ONLINE' ? 'NO ACTIVE PLAYBACK' : 'UNAVAILABLE'); byId('sessionUser').textContent = session?.user || '—'; byId('sessionDevice').textContent = session?.device || '—'; byId('sessionClient').textContent = session?.client || data.error || '—';
    byId('sessionContentLabel').textContent = session?.is_live ? 'LIVE PROGRAM' : 'NOW PLAYING'; byId('sessionTitle').textContent = session?.title || '—'; byId('sessionChannel').textContent = session?.is_live ? `LIVE · ${session.channel}` : 'MEDIA PLAYBACK';
    const artwork = byId('sessionArtwork'); const artworkFallback = byId('sessionArtworkFallback');
    const artworkUrl = session?.logo_service_id
      ? `/api/mirakurun-logo/${session.logo_service_id}`
      : session?.artwork_item_id ? `/api/jellyfin-image/${session.artwork_item_id}` : null;
    if (artworkUrl) {
      artwork.src = artworkUrl;
      artwork.alt = session.is_live ? `${session.channel} logo` : 'Media artwork';
      artwork.hidden = false; artworkFallback.hidden = true;
      artwork.onerror = () => { artwork.hidden = true; artworkFallback.hidden = false; };
    } else {
      artwork.removeAttribute('src'); artwork.hidden = true; artworkFallback.hidden = false;
    }
    const hasDuration = Boolean(session?.runtime_ticks); const percent = hasDuration ? Math.round(100 * session.position_ticks / session.runtime_ticks) : null;
    byId('sessionProgress').style.width = `${percent ?? 0}%`; byId('sessionElapsed').textContent = session ? (hasDuration ? `${percent}% ELAPSED` : 'LIVE STREAM') : '—'; byId('sessionTotal').textContent = session ? (hasDuration ? 'TOTAL DURATION' : 'DURATION UNAVAILABLE') : '—'; byId('jellyNote').textContent = data.error || 'SESSION DATA IS READ-ONLY';
  }

  function updateJellyfinRotation(data) {
    const showJellyfin = (data.sessions || []).length > 0;
    const nextPages = showJellyfin ? allPages : allPages.filter((page) => page !== 'jellyfin');
    if (nextPages.join() === pages.join()) return;
    const currentPage = pages[activeIndex];
    pages = nextPages;
    const nextIndex = pages.indexOf(currentPage);
    if (nextIndex >= 0) {
      activeIndex = nextIndex;
    } else {
      // Playback ended while its page was visible: advance to SYSTEM.
      showPage(0);
    }
  }

  async function refresh() {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderSystem(data.system); renderTuners(data.mirakurun); renderEpg(data.epgstation); renderJellyfin(data.jellyfin);
      updateJellyfinRotation(data.jellyfin);
      document.querySelectorAll('.last-update').forEach((item) => { item.textContent = data.mirakurun.last_update || 'UNAVAILABLE'; });
    } catch (_) { /* Keep the most recent data visible while the local API reconnects. */ }
  }
  async function refreshSystem() {
    try {
      const response = await fetch('/api/system', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      renderSystem(await response.json());
    } catch (_) { /* Keep the last graph; full refresh reports service failures. */ }
  }

  function showPage(index) {
    activeIndex = (index + pages.length) % pages.length;
    const page = pages[activeIndex];
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === page));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.target === page));
    const pageName = byId('pageName');
    if (pageName) pageName.textContent = page.toUpperCase();
    secondsLeft = ROTATION_SECONDS;
    const countdown = byId('countdown');
    if (countdown) countdown.textContent = secondsLeft;
  }

  function tick() {
    secondsLeft -= 1;
    if (secondsLeft <= 0) showPage(activeIndex + 1);
    else {
      const countdown = byId('countdown');
      if (countdown) countdown.textContent = secondsLeft;
    }
  }

  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showPage(pages.indexOf(button.dataset.target))));
  if (allPages.includes(requestedPage)) showPage(pages.indexOf(requestedPage));
  updateClock();
  refresh();
  setInterval(updateClock, 1000);
  setInterval(tick, 1000);
  setInterval(refresh, 10000);
})();
