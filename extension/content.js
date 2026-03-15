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
  let isChecking = false;

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

    // Listen for messages from background
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  function handleMessage(message, sender, sendResponse) {
    if (message.type === 'SHOW_RESULTS') {
      // Handle context menu results
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
  }

  function setupInputListeners() {
    // Add listeners to existing inputs
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
    const text = getTextContent(element);
    if (text.length >= 10 && !currentMatches.has(element)) {
      checkText(element, text);
    }
  }

  function handleBlur(event) {
    // Keep highlights but hide tooltip
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
        highlightErrors(element, response.results.matches);
        updateBadge(response.results.stats.totalIssues);
      }
    } catch (error) {
      console.error('Grammar Buddy check error:', error);
    } finally {
      isChecking = false;
    }
  }

  function getTextContent(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    }
    return element.innerText || element.textContent || '';
  }

  function highlightErrors(element, matches) {
    // For contenteditable elements, we can add spans
    if (element.getAttribute('contenteditable') === 'true') {
      highlightContentEditable(element, matches);
    } else {
      // For textareas/inputs, use overlay or indicator
      showIndicator(element, matches);
    }
  }

  function highlightContentEditable(element, matches) {
    // Store original content
    const originalHTML = element.innerHTML;
    const text = element.innerText || element.textContent;

    // Sort matches by offset (descending) to replace from end to start
    const sortedMatches = [...matches].sort((a, b) => b.offset - a.offset);

    let highlightedText = text;

    sortedMatches.forEach((match, index) => {
      const start = match.offset;
      const end = match.offset + match.length;
      const errorText = text.substring(start, end);

      const span = `<span class="grammar-buddy-error ${match.category}" data-match-index="${matches.indexOf(match)}">${errorText}</span>`;

      highlightedText = highlightedText.substring(0, start) + span + highlightedText.substring(end);
    });

    // Only update if different
    if (element.innerHTML !== highlightedText) {
      // Save cursor position
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      element.innerHTML = highlightedText;

      // Add click handlers to highlighted errors
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
    // Remove existing indicator
    const existingIndicator = element.parentElement?.querySelector('.grammar-buddy-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create position wrapper if needed
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

    // Create indicator
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
        <div style="margin-bottom: 10px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
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

    // Add click handlers for apply buttons
    tooltip.querySelectorAll('.grammar-buddy-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        applyCorrection(element, matches[index]);
        hideTooltip();
        // Re-check after correction
        setTimeout(() => {
          const newText = getTextContent(element);
          checkText(element, newText);
        }, 100);
      });
    });

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Close on outside click
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

    // Add click handlers
    tooltip.querySelectorAll('.grammar-buddy-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const replacement = btn.dataset.replacement;
        applyReplacementInContentEditable(parentElement, match, replacement);
        hideTooltip();
        // Re-check
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
      // Add word to ignored list
      chrome.storage.sync.get(['ignoredWords'], (result) => {
        const ignoredWords = result.ignoredWords || [];
        ignoredWords.push(errorText.toLowerCase());
        chrome.storage.sync.set({ ignoredWords });
      });
      hideTooltip();
      // Re-check
      setTimeout(() => {
        const newText = getTextContent(parentElement);
        checkText(parentElement, newText);
      }, 100);
    });

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Ensure tooltip is visible in viewport
    adjustTooltipPosition(tooltip);

    // Close on outside click
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
