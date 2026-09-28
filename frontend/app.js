(() => {
  'use strict';
  const ROTATION_SECONDS = 15;
  const pages = ['system', 'mirakurun', 'epgstation', 'jellyfin'];
  const mock = window.LCARS_MOCK;
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

  function renderSystem() {
    const coreBars = byId('coreBars');
    coreBars.innerHTML = mock.cpu.map((value, index) => `<div><small>C${index}</small><span><i style="height:${value}%"></i></span><b>${value}%</b></div>`).join('');
    byId('cpuTotal').textContent = Math.round(mock.cpu.reduce((sum, value) => sum + value, 0) / mock.cpu.length);
    byId('rxPath').setAttribute('d', makePath(mock.network, 0));
    byId('txPath').setAttribute('d', makePath(mock.network.map((v) => Math.round(v * 0.42)), 28));
  }

  function renderTuners() {
    byId('tunerGrid').innerHTML = mock.tuners.map((tuner) => `<article class="tuner ${tuner.state.toLowerCase()}"><div class="tuner-top"><span>${tuner.type}</span><b><i></i>${tuner.state}</b></div><h2>${tuner.name}</h2><p>CURRENT CHANNEL</p><strong>${tuner.channel}</strong></article>`).join('');
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
  renderSystem();
  renderTuners();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(tick, 1000);
})();

