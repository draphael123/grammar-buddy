// Grammar Buddy - Background Service Worker
// Handles LanguageTool API requests and caching

const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const textCache = new Map();

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    enabled: true,
    language: 'en-US',
    checkGrammar: true,
    checkSpelling: true,
    checkStyle: true,
    checkTone: true,
    ignoredWords: [],
    theme: 'auto' // 'light', 'dark', or 'auto'
  });

  // Create context menu
  chrome.contextMenus.create({
    id: 'grammarBuddyCheck',
    title: 'Check with Grammar Buddy',
    contexts: ['selection']
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'check-grammar') {
    chrome.tabs.sendMessage(tab.id, { type: 'KEYBOARD_CHECK' });
  }

  if (command === 'toggle-extension') {
    const settings = await chrome.storage.sync.get(['enabled']);
    const newEnabled = !settings.enabled;
    await chrome.storage.sync.set({ enabled: newEnabled });
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled: newEnabled });

    // Update badge to show status
    chrome.action.setBadgeText({
      text: newEnabled ? '' : 'OFF',
      tabId: tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: newEnabled ? '#27ae60' : '#999',
      tabId: tab.id
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'grammarBuddyCheck' && info.selectionText) {
    checkText(info.selectionText).then(results => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_RESULTS',
        results: results
      });
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TEXT') {
    checkText(message.text, message.language).then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse({ success: true, settings });
    });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    const count = message.count;
    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : '',
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: count > 0 ? '#e74c3c' : '#27ae60',
      tabId: sender.tab.id
    });
    sendResponse({ success: true });
    return true;
  }
});

// Check text using LanguageTool API
async function checkText(text, language = 'en-US') {
  if (!text || text.trim().length < 3) {
    return { matches: [], stats: getEmptyStats() };
  }

  // Check cache first
  const cacheKey = `${text}_${language}`;
  const cached = textCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Get user settings
  const settings = await chrome.storage.sync.get(['checkGrammar', 'checkSpelling', 'checkStyle', 'ignoredWords']);

  // Build enabled rules based on settings
  const disabledCategories = [];
  if (!settings.checkSpelling) disabledCategories.push('TYPOS');
  if (!settings.checkGrammar) disabledCategories.push('GRAMMAR');
  if (!settings.checkStyle) disabledCategories.push('STYLE', 'REDUNDANCY', 'CASING');

  try {
    const response = await fetch(LANGUAGETOOL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        language: language,
        disabledCategories: disabledCategories.join(','),
        enabledOnly: 'false'
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter out ignored words
    const ignoredWords = settings.ignoredWords || [];
    const filteredMatches = data.matches.filter(match => {
      const word = text.substring(match.offset, match.offset + match.length);
      return !ignoredWords.includes(word.toLowerCase());
    });

    // Categorize and enhance matches
    const enhancedMatches = filteredMatches.map(match => ({
      ...match,
      category: categorizeMatch(match),
      color: getColorForCategory(categorizeMatch(match))
    }));

    // Calculate stats
    const stats = calculateStats(text, enhancedMatches);

    const result = { matches: enhancedMatches, stats };

    // Cache the result
    textCache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean old cache entries
    cleanCache();

    return result;
  } catch (error) {
    console.error('Grammar Buddy API Error:', error);
    throw error;
  }
}

// Categorize match type
function categorizeMatch(match) {
  const category = match.rule?.category?.id || '';
  const ruleId = match.rule?.id || '';

  if (category === 'TYPOS' || ruleId.includes('SPELL')) {
    return 'spelling';
  }
  if (category === 'GRAMMAR' || category === 'PUNCTUATION') {
    return 'grammar';
  }
  if (category === 'STYLE' || category === 'REDUNDANCY' || category === 'CASING') {
    return 'style';
  }
  if (ruleId.includes('PASSIVE') || ruleId.includes('TONE')) {
    return 'tone';
  }
  return 'grammar';
}

// Get color for category
function getColorForCategory(category) {
  const colors = {
    spelling: '#e74c3c',   // Red
    grammar: '#3498db',    // Blue
    style: '#9b59b6',      // Purple
    tone: '#27ae60'        // Green
  };
  return colors[category] || colors.grammar;
}

// Calculate text statistics
function calculateStats(text, matches) {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = countSyllables(text);

  // Flesch-Kincaid Grade Level
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const avgSyllablesPerWord = syllables / Math.max(words.length, 1);
  const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  // Flesch Reading Ease
  const fleschEase = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Reading time (average 200 words per minute)
  const readingTime = Math.ceil(words.length / 200);

  // Count issues by category
  const issueCounts = {
    spelling: 0,
    grammar: 0,
    style: 0,
    tone: 0
  };
  matches.forEach(match => {
    issueCounts[match.category] = (issueCounts[match.category] || 0) + 1;
  });

  // Calculate overall score (100 - penalty for issues)
  const totalIssues = matches.length;
  const penalty = Math.min(totalIssues * 5, 50);
  const score = Math.max(100 - penalty, 50);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    characterCount: text.length,
    readingTime: readingTime,
    gradeLevel: Math.max(0, Math.round(fleschKincaid * 10) / 10),
    readingEase: Math.max(0, Math.min(100, Math.round(fleschEase))),
    score: score,
    issueCounts: issueCounts,
    totalIssues: totalIssues
  };
}

// Count syllables in text (approximate)
function countSyllables(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let count = 0;

  words.forEach(word => {
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    count += matches ? matches.length : 1;
  });

  return count;
}

// Get empty stats object
function getEmptyStats() {
  return {
    wordCount: 0,
    sentenceCount: 0,
    characterCount: 0,
    readingTime: 0,
    gradeLevel: 0,
    readingEase: 100,
    score: 100,
    issueCounts: { spelling: 0, grammar: 0, style: 0, tone: 0 },
    totalIssues: 0
  };
}

// Clean old cache entries
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of textCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      textCache.delete(key);
    }
  }
}
