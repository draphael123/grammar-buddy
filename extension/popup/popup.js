// Grammar Buddy Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const themeBtn = document.getElementById('themeBtn');
  const scoreValue = document.getElementById('scoreValue');
  const scoreProgress = document.getElementById('scoreProgress');
  const wordCount = document.getElementById('wordCount');
  const readingTime = document.getElementById('readingTime');
  const gradeLevel = document.getElementById('gradeLevel');
  const readingEase = document.getElementById('readingEase');
  const spellingCount = document.getElementById('spellingCount');
  const grammarCount = document.getElementById('grammarCount');
  const styleCount = document.getElementById('styleCount');
  const toneCount = document.getElementById('toneCount');
  const checkNowBtn = document.getElementById('checkNowBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const container = document.querySelector('.popup-container');

  // Add gradient definition for score circle
  const svg = document.querySelector('.score-circle svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  `;
  svg.insertBefore(defs, svg.firstChild);

  // Load settings
  const settings = await chrome.storage.sync.get(['enabled', 'theme']);
  enableToggle.checked = settings.enabled !== false;
  updateDisabledState();

  // Apply theme
  applyTheme(settings.theme || 'auto');

  // Theme toggle
  themeBtn.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    await chrome.storage.sync.set({ theme: newTheme });

    // Notify content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: { theme: newTheme } });
    }
  });

  function applyTheme(theme) {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Toggle enable/disable
  enableToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    await chrome.storage.sync.set({ enabled });
    updateDisabledState();

    // Notify content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled });
    }
  });

  function updateDisabledState() {
    if (enableToggle.checked) {
      container.classList.remove('disabled');
    } else {
      container.classList.add('disabled');
    }
  }

  // Get current tab stats
  await loadStats();

  async function loadStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // Request stats from content script
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded
          showNoStats();
          return;
        }

        if (response?.stats) {
          updateStats(response.stats);
        } else {
          showNoStats();
        }
      });
    } catch (error) {
      showNoStats();
    }
  }

  function updateStats(stats) {
    // Update score
    const score = stats.score || 100;
    scoreValue.textContent = score;
    updateScoreColor(score);
    updateScoreProgress(score);

    // Update stats
    wordCount.textContent = stats.wordCount || 0;
    readingTime.textContent = `${stats.readingTime || 0}m`;
    gradeLevel.textContent = stats.gradeLevel || '--';
    readingEase.textContent = stats.readingEase || '--';

    // Update issue counts
    const issues = stats.issueCounts || {};
    spellingCount.textContent = issues.spelling || 0;
    grammarCount.textContent = issues.grammar || 0;
    styleCount.textContent = issues.style || 0;
    toneCount.textContent = issues.tone || 0;
  }

  function showNoStats() {
    scoreValue.textContent = '--';
    scoreValue.className = 'score-value';
    updateScoreProgress(0);
  }

  function updateScoreColor(score) {
    scoreValue.className = 'score-value';
    if (score >= 90) {
      scoreValue.classList.add('excellent');
    } else if (score >= 75) {
      scoreValue.classList.add('good');
    } else if (score >= 60) {
      scoreValue.classList.add('fair');
    } else {
      scoreValue.classList.add('poor');
    }
  }

  function updateScoreProgress(score) {
    // Circle circumference = 2 * PI * r = 2 * 3.14159 * 45 ≈ 283
    const circumference = 283;
    const offset = circumference - (score / 100) * circumference;
    scoreProgress.style.strokeDashoffset = offset;
  }

  // Check Now button
  checkNowBtn.addEventListener('click', async () => {
    checkNowBtn.disabled = true;
    checkNowBtn.innerHTML = `
      <span class="loading-spinner"></span>
      Checking...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK_NOW' }, (response) => {
          if (response?.stats) {
            updateStats(response.stats);
          }
          resetCheckButton();
        });
      } else {
        resetCheckButton();
      }
    } catch (error) {
      resetCheckButton();
    }

    // Timeout fallback
    setTimeout(resetCheckButton, 5000);
  });

  function resetCheckButton() {
    checkNowBtn.disabled = false;
    checkNowBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Check Now
    `;
  }

  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
