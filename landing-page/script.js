// Grammar Buddy Landing Page Script

document.addEventListener('DOMContentLoaded', () => {
  const demoInput = document.getElementById('demoInput');
  const resultsList = document.getElementById('resultsList');
  const demoScore = document.getElementById('demoScore');

  // Pre-defined error patterns for demo (no API needed)
  const errorPatterns = [
    {
      pattern: /\brecieved\b/gi,
      category: 'spelling',
      suggestion: 'received',
      message: 'Common misspelling'
    },
    {
      pattern: /\bdefinately\b/gi,
      category: 'spelling',
      suggestion: 'definitely',
      message: 'Common misspelling'
    },
    {
      pattern: /\bbecuase\b/gi,
      category: 'spelling',
      suggestion: 'because',
      message: 'Common misspelling'
    },
    {
      pattern: /\bwether\b/gi,
      category: 'spelling',
      suggestion: 'weather',
      message: 'Did you mean "weather" or "whether"?'
    },
    {
      pattern: /\byou're\s+(email|message|letter|document|file|report)/gi,
      category: 'grammar',
      suggestion: 'your $1',
      message: 'Use "your" (possessive) instead of "you\'re"'
    },
    {
      pattern: /\bme\s+will\b/gi,
      category: 'grammar',
      suggestion: 'I will',
      message: 'Use "I" as the subject pronoun'
    },
    {
      pattern: /\breal\s+soon\b/gi,
      category: 'style',
      suggestion: 'very soon',
      message: 'Use "very" instead of "real" in formal writing'
    },
    {
      pattern: /\bget\s+back\s+to\s+you\b/gi,
      category: 'style',
      suggestion: 'respond to you',
      message: 'Consider a more formal alternative'
    },
    {
      pattern: /\balot\b/gi,
      category: 'spelling',
      suggestion: 'a lot',
      message: '"A lot" should be two words'
    },
    {
      pattern: /\bthier\b/gi,
      category: 'spelling',
      suggestion: 'their',
      message: 'Common misspelling'
    },
    {
      pattern: /\boccured\b/gi,
      category: 'spelling',
      suggestion: 'occurred',
      message: 'Double "r" in "occurred"'
    },
    {
      pattern: /\bwas\s+postponed\b/gi,
      category: 'tone',
      suggestion: 'has been postponed',
      message: 'Consider present perfect for recent events'
    }
  ];

  // Get plain text from contenteditable
  function getPlainText() {
    return demoInput.innerText || demoInput.textContent || '';
  }

  // Check text and return errors with positions
  function checkText(text) {
    const results = [];

    errorPatterns.forEach(error => {
      let match;
      const regex = new RegExp(error.pattern.source, error.pattern.flags);

      while ((match = regex.exec(text)) !== null) {
        const errorText = match[0];
        let suggestion = error.suggestion;

        if (suggestion.includes('$1')) {
          suggestion = errorText.replace(error.pattern, error.suggestion);
        }

        results.push({
          text: errorText,
          suggestion: suggestion,
          category: error.category,
          message: error.message,
          offset: match.index,
          length: errorText.length
        });
      }
    });

    return results;
  }

  // Highlight errors in text and return HTML
  function highlightErrors(text, errors) {
    if (errors.length === 0) {
      return escapeHtml(text);
    }

    // Sort by offset ascending
    const sortedErrors = [...errors].sort((a, b) => a.offset - b.offset);

    let result = '';
    let lastIndex = 0;

    sortedErrors.forEach(error => {
      // Add text before this error
      if (error.offset > lastIndex) {
        result += escapeHtml(text.substring(lastIndex, error.offset));
      }

      // Add the highlighted error
      const errorText = text.substring(error.offset, error.offset + error.length);
      const tooltip = `${capitalize(error.category)}: ${error.message}`;
      result += `<span class="error ${error.category}" data-tooltip="${escapeAttr(tooltip)}" data-suggestion="${escapeAttr(error.suggestion)}">${escapeHtml(errorText)}</span>`;

      lastIndex = error.offset + error.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result += escapeHtml(text.substring(lastIndex));
    }

    return result;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Calculate score
  function calculateScore(text, errors) {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount === 0) return 100;
    const errorPenalty = Math.min(errors.length * 5, 50);
    return Math.max(100 - errorPenalty, 50);
  }

  // Render results sidebar
  function renderResults(errors) {
    const sortedErrors = [...errors].sort((a, b) => a.offset - b.offset);

    if (sortedErrors.length === 0) {
      resultsList.innerHTML = `
        <div class="result-item" style="border-left-color: var(--tone); text-align: center;">
          <span style="color: var(--tone);">No issues found!</span>
        </div>
      `;
      return;
    }

    resultsList.innerHTML = sortedErrors.map((error, index) => `
      <div class="result-item ${error.category}" data-index="${index}">
        <div>
          <span class="error-word">${escapeHtml(error.text)}</span>
          <span> → </span>
          <span class="suggestion">${escapeHtml(error.suggestion)}</span>
        </div>
        <div class="message">${escapeHtml(error.message)}</div>
      </div>
    `).join('');

    // Click handlers for sidebar items
    resultsList.querySelectorAll('.result-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        applyFix(sortedErrors[index]);
      });
    });
  }

  // Apply a fix
  function applyFix(error) {
    const text = getPlainText();
    const newText = text.substring(0, error.offset) + error.suggestion + text.substring(error.offset + error.length);
    updateDemo(newText);
  }

  // Save and restore cursor position
  function saveCursor() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(demoInput);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
    return 0;
  }

  function restoreCursor(position) {
    const sel = window.getSelection();
    const range = document.createRange();

    let charCount = 0;
    let foundStart = false;

    function traverseNodes(node) {
      if (foundStart) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + node.length;
        if (!foundStart && position <= nextCharCount) {
          range.setStart(node, position - charCount);
          range.collapse(true);
          foundStart = true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i]);
          if (foundStart) break;
        }
      }
    }

    traverseNodes(demoInput);

    if (foundStart) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Main update function
  function updateDemo(newText) {
    const cursorPos = saveCursor();
    const text = newText !== undefined ? newText : getPlainText();
    const errors = checkText(text);
    const score = calculateScore(text, errors);

    // Update highlighted content
    demoInput.innerHTML = highlightErrors(text, errors);

    // Restore cursor if we're editing
    if (newText === undefined) {
      restoreCursor(cursorPos);
    }

    // Add click handlers to inline error spans
    demoInput.querySelectorAll('.error').forEach(span => {
      span.addEventListener('click', (e) => {
        e.preventDefault();
        const suggestion = span.dataset.suggestion;
        const errorText = span.textContent;
        const currentText = getPlainText();
        const newText = currentText.replace(errorText, suggestion);
        updateDemo(newText);
      });
    });

    // Update score
    demoScore.textContent = score;
    demoScore.style.background = score >= 90
      ? 'linear-gradient(135deg, #27ae60, #1e8449)'
      : score >= 70
        ? 'linear-gradient(135deg, #667eea, #764ba2)'
        : 'linear-gradient(135deg, #e74c3c, #c0392b)';

    renderResults(errors);
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Escape for attributes
  function escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Debounce
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Event listeners
  demoInput.addEventListener('input', debounce(() => updateDemo(), 400));

  // Initial highlight
  updateDemo();

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Download button - direct download from GitHub
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'https://github.com/draphael123/grammar-buddy/archive/refs/heads/main.zip';
    });
  }

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.pageYOffset > 100
      ? '0 2px 20px rgba(0, 0, 0, 0.1)'
      : 'none';
  });

  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.feature-card, .step, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
});
