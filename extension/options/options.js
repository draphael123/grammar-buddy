// Grammar Buddy Options Page Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const languageSelect = document.getElementById('language');
  const themeSelect = document.getElementById('theme');
  const checkSpelling = document.getElementById('checkSpelling');
  const checkGrammar = document.getElementById('checkGrammar');
  const checkStyle = document.getElementById('checkStyle');
  const checkTone = document.getElementById('checkTone');
  const ignoredWordsList = document.getElementById('ignoredWordsList');
  const newWordInput = document.getElementById('newWordInput');
  const addWordBtn = document.getElementById('addWordBtn');
  const saveNotification = document.getElementById('saveNotification');

  // Load current settings
  const settings = await chrome.storage.sync.get({
    language: 'en-US',
    theme: 'auto',
    checkSpelling: true,
    checkGrammar: true,
    checkStyle: true,
    checkTone: true,
    ignoredWords: []
  });

  // Apply settings to UI
  languageSelect.value = settings.language;
  themeSelect.value = settings.theme;
  checkSpelling.checked = settings.checkSpelling;
  checkGrammar.checked = settings.checkGrammar;
  checkStyle.checked = settings.checkStyle;
  checkTone.checked = settings.checkTone;

  // Apply theme to options page
  applyTheme(settings.theme);

  // Render ignored words
  renderIgnoredWords(settings.ignoredWords);

  // Event listeners for settings changes
  languageSelect.addEventListener('change', () => saveSettings());
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    saveSettings();
  });
  checkSpelling.addEventListener('change', () => saveSettings());
  checkGrammar.addEventListener('change', () => saveSettings());
  checkStyle.addEventListener('change', () => saveSettings());
  checkTone.addEventListener('change', () => saveSettings());

  // Add word
  addWordBtn.addEventListener('click', addWord);
  newWordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addWord();
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

  async function saveSettings() {
    const newSettings = {
      language: languageSelect.value,
      theme: themeSelect.value,
      checkSpelling: checkSpelling.checked,
      checkGrammar: checkGrammar.checked,
      checkStyle: checkStyle.checked,
      checkTone: checkTone.checked
    };

    await chrome.storage.sync.set(newSettings);
    showSaveNotification();

    // Notify all tabs about settings change
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: newSettings
        }).catch(() => {
          // Tab might not have content script
        });
      }
    });
  }

  async function addWord() {
    const word = newWordInput.value.trim().toLowerCase();
    if (!word) return;

    const result = await chrome.storage.sync.get(['ignoredWords']);
    const ignoredWords = result.ignoredWords || [];

    if (!ignoredWords.includes(word)) {
      ignoredWords.push(word);
      await chrome.storage.sync.set({ ignoredWords });
      renderIgnoredWords(ignoredWords);
      showSaveNotification();
    }

    newWordInput.value = '';
    newWordInput.focus();
  }

  async function removeWord(word) {
    const result = await chrome.storage.sync.get(['ignoredWords']);
    let ignoredWords = result.ignoredWords || [];
    ignoredWords = ignoredWords.filter(w => w !== word);
    await chrome.storage.sync.set({ ignoredWords });
    renderIgnoredWords(ignoredWords);
    showSaveNotification();
  }

  function renderIgnoredWords(words) {
    if (!words || words.length === 0) {
      ignoredWordsList.innerHTML = '<div class="empty-state">No ignored words yet</div>';
      return;
    }

    ignoredWordsList.innerHTML = words.map(word => `
      <span class="ignored-word">
        ${escapeHtml(word)}
        <button class="remove-btn" data-word="${escapeHtml(word)}">&times;</button>
      </span>
    `).join('');

    // Add remove handlers
    ignoredWordsList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeWord(btn.dataset.word);
      });
    });
  }

  function showSaveNotification() {
    saveNotification.classList.add('show');
    setTimeout(() => {
      saveNotification.classList.remove('show');
    }, 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // About links
  document.getElementById('rateLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Would link to Chrome Web Store when published
    alert('This will link to the Chrome Web Store rating page when the extension is published.');
  });

  document.getElementById('feedbackLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Would link to feedback form
    alert('This will link to a feedback form.');
  });

  // Listen for system theme changes when using auto
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeSelect.value === 'auto') {
      applyTheme('auto');
    }
  });
});
