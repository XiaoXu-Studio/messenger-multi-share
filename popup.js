/**
 * popup.js - 弹窗逻辑（屏幕共享 + 摄像头控制）
 */
(function () {
  'use strict';

  const tabList = document.getElementById('tabList');
  const emptyState = document.getElementById('emptyState');
  const hint = document.getElementById('hint');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const viewIdle = document.getElementById('viewIdle');
  const viewSharing = document.getElementById('viewSharing');
  const sharingInfo = document.getElementById('sharingInfo');
  const btnCamOn = document.getElementById('btnCamOn');
  const btnCamOff = document.getElementById('btnCamOff');

  let tabs = [];
  let sharing = false;
  let sharingCount = 0;

  init();

  async function init() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
      if (state) {
        sharing = state.sharing;
        sharingCount = 1 + (state.receiverTabs?.length || 0);
        showView();
      }
    });
    await refreshTabs();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_UPDATE') {
        sharing = msg.state.sharing;
        sharingCount = 1 + (msg.state.receiverTabs?.length || 0);
        showView();
      }
    });
  }

  function showView() {
    if (sharing) {
      viewIdle.classList.remove('active');
      viewSharing.classList.add('active');
      sharingInfo.textContent = `正在共享到 ${sharingCount} 个通话`;
    } else {
      viewSharing.classList.remove('active');
      viewIdle.classList.add('active');
    }
  }

  async function refreshTabs() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'REFRESH_TABS' });
      tabs = result?.tabs || [];
    } catch {
      tabs = [];
    }
    renderTabs();
  }

  function renderTabs() {
    tabList.innerHTML = '';

    if (tabs.length === 0) {
      emptyState.style.display = 'block';
      hint.style.display = 'none';
      btnStart.disabled = true;
      btnStart.textContent = '▶ 开始共享';
      return;
    }

    emptyState.style.display = 'none';
    hint.style.display = '';

    tabs.forEach((tab, i) => {
      const li = document.createElement('li');
      li.className = 'tab-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = tab.id;
      cb.checked = true;
      cb.addEventListener('change', updateBtn);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = cleanTitle(tab.title);

      li.appendChild(cb);
      li.appendChild(name);

      if (i === 0) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '主';
        li.appendChild(badge);
      }

      tabList.appendChild(li);
    });

    updateBtn();
  }

  function getSelected() {
    return Array.from(tabList.querySelectorAll('input:checked')).map((c) => +c.value);
  }

  function updateBtn() {
    const ids = getSelected();
    const n = ids.length;
    btnStart.disabled = n < 1;
    btnStart.textContent = n < 1 ? '▶ 请勾选通话' : `▶ 共享到 ${n} 个通话`;
    // 同步勾选状态到后台，让浮动按钮也遵守选择
    chrome.runtime.sendMessage({ type: 'UPDATE_SELECTION', tabIds: ids }).catch(() => {});
  }

  // ---- 屏幕共享事件 ----
  btnRefresh.addEventListener('click', refreshTabs);

  btnStart.addEventListener('click', () => {
    const ids = getSelected();
    if (ids.length < 1) return;
    btnStart.disabled = true;
    btnStart.textContent = '⏳ 启动中...';
    sharingCount = ids.length;
    chrome.runtime.sendMessage({ type: 'START_SHARING', tabIds: ids }, () => {
      sharing = true;
      showView();
    });
  });

  btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    btnStop.textContent = '⏳ 正在停止...';
    chrome.runtime.sendMessage({ type: 'STOP_SHARING' }, () => {
      sharing = false;
      btnStop.disabled = false;
      btnStop.textContent = '⏹ 一键停止所有共享';
      showView();
      refreshTabs();
    });
  });

  // ---- 摄像头控制事件 ----
  btnCamOn.addEventListener('click', async () => {
    btnCamOn.disabled = true;
    btnCamOn.textContent = '⏳ 开启中...';
    // 获取当前活动标签页来触发批量操作
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_ALL_CAMERAS_FROM_POPUP',
      enable: true,
    });
    btnCamOn.disabled = false;
    btnCamOn.textContent = '全部开启';
  });

  btnCamOff.addEventListener('click', async () => {
    btnCamOff.disabled = true;
    btnCamOff.textContent = '⏳ 关闭中...';
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_ALL_CAMERAS_FROM_POPUP',
      enable: false,
    });
    btnCamOff.disabled = false;
    btnCamOff.textContent = '全部关闭';
  });

  function cleanTitle(t) {
    if (!t) return '(通话)';
    return t.replace(/^\(\d+\)\s*/, '').replace(/^Messenger\s*[-–—]\s*/i, '').trim() || t;
  }
})();
