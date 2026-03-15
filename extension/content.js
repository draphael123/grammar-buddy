// Grammar Buddy Content Script
// Monitors text inputs and displays grammar suggestions

(function() {
  'use strict';

  let settings = {
    enabled: true,
    language: 'en-US',
    checkGrammar: true,
    checkSpelling: true,
    checkStyle: true,
    checkTone: true,
    theme: 'light'
  };

  let activeTooltip = null;
  let checkTimeout = null;
  let currentMatches = new Map(); // element -> matches
  let currentStats = new Map(); // element -> stats
  let isChecking = false;
  let lastFocusedElement = null;

  // Offline fallback patterns for when API is unavailable
  const offlinePatterns = [
    { pattern: /\brecieved\b/gi, category: 'spelling', message: 'Did you mean "received"?', replacement: 'received' },
    { pattern: /\bdefinately\b/gi, category: 'spelling', message: 'Did you mean "definitely"?', replacement: 'definitely' },
    { pattern: /\boccured\b/gi, category: 'spelling', message: 'Did you mean "occurred"?', replacement: 'occurred' },
    { pattern: /\bseperate\b/gi, category: 'spelling', message: 'Did you mean "separate"?', replacement: 'separate' },
    { pattern: /\buntill\b/gi, category: 'spelling', message: 'Did you mean "until"?', replacement: 'until' },
    { pattern: /\bwich\b/gi, category: 'spelling', message: 'Did you mean "which"?', replacement: 'which' },
    { pattern: /\bbecuase\b/gi, category: 'spelling', message: 'Did you mean "because"?', replacement: 'because' },
    { pattern: /\bthier\b/gi, category: 'spelling', message: 'Did you mean "their"?', replacement: 'their' },
    { pattern: /\balot\b/gi, category: 'spelling', message: '"A lot" should be two words', replacement: 'a lot' },
    { pattern: /\bwether\b/gi, category: 'spelling', message: 'Did you mean "weather" or "whether"?', replacement: 'whether' },
    { pattern: /\bteh\b/gi, category: 'spelling', message: 'Did you mean "the"?', replacement: 'the' },
    { pattern: /\byou're\s+(email|message|letter|document|file|report|computer|phone|car|house|book)/gi, category: 'grammar', message: 'Use "your" (possessive) instead of "you\'re"', replacement: 'your $1' },
    { pattern: /\bits\s+(a|an|the|very|really|so|too)/gi, category: 'grammar', message: 'Did you mean "it\'s" (it is)?', replacement: "it's $1" },
    { pattern: /\bme\s+and\s+(my|him|her|them)\b/gi, category: 'grammar', message: 'Consider using "X and I" as the subject', replacement: '$1 and I' },
    { pattern: /\bcould\s+of\b/gi, category: 'grammar', message: 'Did you mean "could have"?', replacement: 'could have' },
    { pattern: /\bshould\s+of\b/gi, category: 'grammar', message: 'Did you mean "should have"?', replacement: 'should have' },
    { pattern: /\bwould\s+of\b/gi, category: 'grammar', message: 'Did you mean "would have"?', replacement: 'would have' },
    { pattern: /\btheir\s+is\b/gi, category: 'grammar', message: 'Did you mean "there is"?', replacement: 'there is' },
    { pattern: /\btheir\s+are\b/gi, category: 'grammar', message: 'Did you mean "there are"?', replacement: 'there are' },
    { pattern: /\bvery\s+unique\b/gi, category: 'style', message: '"Unique" doesn\'t need "very"', replacement: 'unique' },
    { pattern: /\bin\s+order\s+to\b/gi, category: 'style', message: 'Consider simplifying to "to"', replacement: 'to' },
    { pattern: /\bat\s+this\s+point\s+in\s+time\b/gi, category: 'style', message: 'Consider simplifying to "now"', replacement: 'now' },
    { pattern: /\bdue\s+to\s+the\s+fact\s+that\b/gi, category: 'style', message: 'Consider simplifying to "because"', replacement: 'because' },
    { pattern: /\bin\s+the\s+event\s+that\b/gi, category: 'style', message: 'Consider simplifying to "if"', replacement: 'if' },
    { pattern: /\breal\s+soon\b/gi, category: 'style', message: 'Use "very" instead of "real" in formal writing', replacement: 'very soon' },
    { pattern: /\bi\s+think\s+that\b/gi, category: 'tone', message: 'Consider being more direct', replacement: '' },
    { pattern: /\bjust\s+wanted\s+to\b/gi, category: 'tone', message: 'Consider being more direct', replacement: 'wanted to' },
    { pattern: /\bbasically\b/gi, category: 'tone', message: 'Consider removing filler word', replacement: '' }
  ];

  // Initialize
  init();

  async function init() {
    // Load settings
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        settings = { ...settings, ...response.settings };
      }
    } catch (e) {
      console.log('Grammar Buddy: Could not load settings');
    }

    if (!settings.enabled) return;

    // Set up observers and listeners
    setupInputListeners();
    observeDOM();

    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  function handleMessage(message, sender, sendResponse) {
    if (message.type === 'SHOW_RESULTS') {
      console.log('Grammar Buddy results:', message.results);
    }

    if (message.type === 'SETTINGS_UPDATED') {
      settings = { ...settings, ...message.settings };
    }

    if (message.type === 'TOGGLE_ENABLED') {
      settings.enabled = message.enabled;
      if (!settings.enabled) {
        cleanup();
      }
    }

    // Handle GET_STATS request from popup
    if (message.type === 'GET_STATS') {
      const stats = getAggregatedStats();
      sendResponse({ stats: stats });
      return true;
    }

    // Handle CHECK_NOW request from popup
    if (message.type === 'CHECK_NOW') {
      checkAllInputs().then(stats => {
        sendResponse({ stats: stats });
      });
      return true;
    }

    // Handle keyboard shortcut from background
    if (message.type === 'KEYBOARD_CHECK') {
      checkAllInputs();
    }
  }

  // Get aggregated stats from all monitored elements
  function getAggregatedStats() {
    let totalStats = {
      wordCount: 0,
      readingTime: 0,
      gradeLevel: '--',
      readingEase: '--',
      score: 100,
      issueCounts: { spelling: 0, grammar: 0, style: 0, tone: 0 }
    };

    // If we have a focused element with stats, use those
    if (lastFocusedElement && currentStats.has(lastFocusedElement)) {
      return currentStats.get(lastFocusedElement);
    }

    // Otherwise aggregate from all elements
    let totalIssues = 0;
    currentStats.forEach((stats) => {
      totalStats.wordCount += stats.wordCount || 0;
      totalStats.issueCounts.spelling += stats.issueCounts?.spelling || 0;
      totalStats.issueCounts.grammar += stats.issueCounts?.grammar || 0;
      totalStats.issueCounts.style += stats.issueCounts?.style || 0;
      totalStats.issueCounts.tone += stats.issueCounts?.tone || 0;
      totalIssues += stats.totalIssues || 0;
    });

    if (totalStats.wordCount > 0) {
      totalStats.readingTime = Math.ceil(totalStats.wordCount / 200);
      const penalty = Math.min(totalIssues * 5, 50);
      totalStats.score = Math.max(100 - penalty, 50);
    }

    return totalStats;
  }

  // Check all text inputs on the page
  async function checkAllInputs() {
    const inputs = document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])');

    for (const element of inputs) {
      const text = getTextContent(element);
      if (text.length >= 10) {
        await checkText(element, text);
      }
    }

    return getAggregatedStats();
  }

  function setupInputListeners() {
    document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])').forEach(el => {
      attachListeners(el);
    });
  }

  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (isTextInput(node)) {
              attachListeners(node);
            }
            node.querySelectorAll?.('textarea, [contenteditable="true"], input[type="text"], input:not([type])').forEach(el => {
              attachListeners(el);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function isTextInput(element) {
    if (element.tagName === 'TEXTAREA') return true;
    if (element.getAttribute('contenteditable') === 'true') return true;
    if (element.tagName === 'INPUT') {
      const type = element.type?.toLowerCase();
      return !type || type === 'text' || type === 'search' || type === 'email';
    }
    return false;
  }

  function attachListeners(element) {
    if (element.dataset.grammarBuddyAttached) return;
    element.dataset.grammarBuddyAttached = 'true';

    element.addEventListener('input', debounce(handleInput, 800));
    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);
  }

  function handleInput(event) {
    if (!settings.enabled) return;
    const element = event.target;
    const text = getTextContent(element);

    if (text.length < 10) {
      clearHighlights(element);
      updateBadge(0);
      return;
    }

    checkText(element, text);
  }

  function handleFocus(event) {
    const element = event.target;
    lastFocusedElement = element;
    const text = getTextContent(element);
    if (text.length >= 10 && !currentMatches.has(element)) {
      checkText(element, text);
    }
  }

  function handleBlur(event) {
    hideTooltip();
  }

  async function checkText(element, text) {
    if (isChecking) return;
    isChecking = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_TEXT',
        text: text,
        language: settings.language
      });

      if (response.success) {
        currentMatches.set(element, response.results);
        currentStats.set(element, response.results.stats);
        highlightErrors(element, response.results.matches);
        updateBadge(response.results.stats.totalIssues);
      }
    } catch (error) {
      // API failed - use offline fallback
      console.log('Grammar Buddy: Using offline mode');
      const offlineResults = checkTextOffline(text);
      currentMatches.set(element, offlineResults);
      currentStats.set(element, offlineResults.stats);
      highlightErrors(element, offlineResults.matches);
      updateBadge(offlineResults.stats.totalIssues);
    } finally {
      isChecking = false;
    }
  }

  // Offline grammar checking using local patterns
  function checkTextOffline(text) {
    const matches = [];

    offlinePatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(text)) !== null) {
        let replacement = pattern.replacement;
        if (replacement.includes('$1')) {
          replacement = match[0].replace(pattern.pattern, pattern.replacement);
        }

        matches.push({
          offset: match.index,
          length: match[0].length,
          message: pattern.message,
          category: pattern.category,
          replacements: replacement ? [{ value: replacement }] : [],
          rule: { id: 'OFFLINE_' + pattern.category.toUpperCase() }
        });
      }
    });

    // Calculate stats
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const issueCounts = { spelling: 0, grammar: 0, style: 0, tone: 0 };
    matches.forEach(m => {
      issueCounts[m.category] = (issueCounts[m.category] || 0) + 1;
    });

    const penalty = Math.min(matches.length * 5, 50);
    const score = Math.max(100 - penalty, 50);

    return {
      matches: matches,
      stats: {
        wordCount: words.length,
        readingTime: Math.ceil(words.length / 200),
        gradeLevel: '--',
        readingEase: '--',
        score: score,
        issueCounts: issueCounts,
        totalIssues: matches.length
      }
    };
  }

  function getTextContent(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    }
    return element.innerText || element.textContent || '';
  }

  function highlightErrors(element, matches) {
    if (element.getAttribute('contenteditable') === 'true') {
      highlightContentEditable(element, matches);
    } else {
      showIndicator(element, matches);
    }
  }

  function highlightContentEditable(element, matches) {
    const text = element.innerText || element.textContent;
    const sortedMatches = [...matches].sort((a, b) => b.offset - a.offset);

    let highlightedText = text;

    sortedMatches.forEach((match, index) => {
      const start = match.offset;
      const end = match.offset + match.length;
      const errorText = text.substring(start, end);

      const span = `<span class="grammar-buddy-error ${match.category}" data-match-index="${matches.indexOf(match)}">${errorText}</span>`;

      highlightedText = highlightedText.substring(0, start) + span + highlightedText.substring(end);
    });

    if (element.innerHTML !== highlightedText) {
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      element.innerHTML = highlightedText;

      element.querySelectorAll('.grammar-buddy-error').forEach(span => {
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          const matchIndex = parseInt(span.dataset.matchIndex);
          showTooltip(span, matches[matchIndex], element);
        });
      });
    }
  }

  function showIndicator(element, matches) {
    const existingIndicator = element.parentElement?.querySelector('.grammar-buddy-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    let wrapper = element.parentElement;
    if (!wrapper.classList.contains('grammar-buddy-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'grammar-buddy-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = element.offsetWidth + 'px';
      element.parentElement.insertBefore(wrapper, element);
      wrapper.appendChild(element);
    }

    const indicator = document.createElement('div');
    indicator.className = `grammar-buddy-indicator ${matches.length > 0 ? 'has-errors' : 'no-errors'}`;
    indicator.textContent = matches.length > 0 ? matches.length : '✓';
    indicator.title = matches.length > 0 ? `${matches.length} issue(s) found` : 'No issues found';

    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      showMatchesList(element, matches);
    });

    wrapper.appendChild(indicator);
  }

  function showMatchesList(element, matches) {
    hideTooltip();

    if (matches.length === 0) return;

    const rect = element.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = `grammar-buddy-tooltip ${settings.theme}`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    let html = `<div class="grammar-buddy-tooltip-header">
      <strong>${matches.length} issue${matches.length > 1 ? 's' : ''} found</strong>
    </div>`;

    matches.forEach((match, index) => {
      const text = getTextContent(element);
      const errorText = text.substring(match.offset, match.offset + match.length);
      const suggestion = match.replacements?.[0]?.value || '';

      html += `
        <div class="grammar-buddy-match-item">
          <span class="grammar-buddy-tooltip-category ${match.category}">${match.category}</span>
          <div style="margin-top: 6px;">
            <span style="text-decoration: line-through; color: #999;">${escapeHtml(errorText)}</span>
            ${suggestion ? `→ <span style="color: #27ae60; font-weight: 500;">${escapeHtml(suggestion)}</span>` : ''}
          </div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${escapeHtml(match.message)}</div>
          ${suggestion ? `<button class="grammar-buddy-suggestion" data-index="${index}" style="margin-top: 6px;">Apply fix</button>` : ''}
        </div>
      `;
    });

    tooltip.innerHTML = html;

    tooltip.querySelectorAll('.grammar-buddy-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        applyCorrection(element, matches[index]);
        hideTooltip();
        setTimeout(() => {
          const newText = getTextContent(element);
          checkText(element, newText);
        }, 100);
      });
    });

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    setTimeout(() => {
      document.addEventListener('click', closeTooltipOnOutsideClick);
    }, 100);
  }

  function showTooltip(targetElement, match, parentElement) {
    hideTooltip();

    const rect = targetElement.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = `grammar-buddy-tooltip ${settings.theme}`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    const text = getTextContent(parentElement);
    const errorText = text.substring(match.offset, match.offset + match.length);

    let suggestionsHTML = '';
    if (match.replacements && match.replacements.length > 0) {
      suggestionsHTML = `<div class="grammar-buddy-tooltip-suggestions">
        ${match.replacements.slice(0, 5).map((r, i) =>
          `<span class="grammar-buddy-suggestion" data-replacement="${escapeHtml(r.value)}">${escapeHtml(r.value)}</span>`
        ).join('')}
      </div>`;
    }

    tooltip.innerHTML = `
      <div class="grammar-buddy-tooltip-header">
        <span class="grammar-buddy-tooltip-category ${match.category}">${match.category}</span>
      </div>
      <div class="grammar-buddy-tooltip-message">${escapeHtml(match.message)}</div>
      <div class="grammar-buddy-tooltip-original">${escapeHtml(errorText)}</div>
      ${suggestionsHTML}
      <div class="grammar-buddy-tooltip-actions">
        <button class="grammar-buddy-action-btn ignore">Ignore</button>
        <button class="grammar-buddy-action-btn ignore-all">Ignore all</button>
      </div>
    `;

    tooltip.querySelectorAll('.grammar-buddy-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const replacement = btn.dataset.replacement;
        applyReplacementInContentEditable(parentElement, match, replacement);
        hideTooltip();
        setTimeout(() => {
          const newText = getTextContent(parentElement);
          checkText(parentElement, newText);
        }, 100);
      });
    });

    tooltip.querySelector('.grammar-buddy-action-btn.ignore')?.addEventListener('click', () => {
      hideTooltip();
    });

    tooltip.querySelector('.grammar-buddy-action-btn.ignore-all')?.addEventListener('click', () => {
      chrome.storage.sync.get(['ignoredWords'], (result) => {
        const ignoredWords = result.ignoredWords || [];
        ignoredWords.push(errorText.toLowerCase());
        chrome.storage.sync.set({ ignoredWords });
      });
      hideTooltip();
      setTimeout(() => {
        const newText = getTextContent(parentElement);
        checkText(parentElement, newText);
      }, 100);
    });

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    adjustTooltipPosition(tooltip);

    setTimeout(() => {
      document.addEventListener('click', closeTooltipOnOutsideClick);
    }, 100);
  }

  function adjustTooltipPosition(tooltip) {
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      tooltip.style.left = `${viewportWidth - rect.width - 20}px`;
    }

    if (rect.bottom > viewportHeight) {
      tooltip.style.top = `${parseInt(tooltip.style.top) - rect.height - 30}px`;
    }
  }

  function closeTooltipOnOutsideClick(e) {
    if (activeTooltip && !activeTooltip.contains(e.target)) {
      hideTooltip();
    }
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
    document.removeEventListener('click', closeTooltipOnOutsideClick);
  }

  function applyCorrection(element, match) {
    const text = getTextContent(element);
    const replacement = match.replacements?.[0]?.value || '';
    if (!replacement) return;

    const newText = text.substring(0, match.offset) + replacement + text.substring(match.offset + match.length);

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = newText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      element.innerText = newText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function applyReplacementInContentEditable(element, match, replacement) {
    const text = getTextContent(element);
    const newText = text.substring(0, match.offset) + replacement + text.substring(match.offset + match.length);
    element.innerText = newText;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearHighlights(element) {
    if (element.getAttribute('contenteditable') === 'true') {
      const text = element.innerText || element.textContent;
      element.innerText = text;
    }
    currentMatches.delete(element);
    currentStats.delete(element);
  }

  function updateBadge(count) {
    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_BADGE',
        count: count
      });
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  function cleanup() {
    hideTooltip();
    document.querySelectorAll('.grammar-buddy-error').forEach(el => {
      el.outerHTML = el.innerHTML;
    });
    document.querySelectorAll('.grammar-buddy-indicator').forEach(el => el.remove());
    document.querySelectorAll('.grammar-buddy-wrapper').forEach(wrapper => {
      const child = wrapper.firstChild;
      wrapper.parentElement.insertBefore(child, wrapper);
      wrapper.remove();
    });
    currentMatches.clear();
    currentStats.clear();
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();
