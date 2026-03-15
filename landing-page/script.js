// Grammar Buddy Landing Page Script

document.addEventListener('DOMContentLoaded', () => {
  // ===== DARK MODE TOGGLE =====
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  // Check for saved theme or system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (prefersDark.matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }

  // ===== TYPING ANIMATION IN HERO =====
  const typingDemo = document.getElementById('typingDemo');
  if (typingDemo) {
    const typingText = typingDemo.querySelector('.typing-text');
    const phrases = [
      { text: 'I recieved you\'re email...', hasError: true },
      { text: 'I received your email...', hasError: false },
      { text: 'Me and my team will...', hasError: true },
      { text: 'My team and I will...', hasError: false },
      { text: 'I definately agree...', hasError: true },
      { text: 'I definitely agree...', hasError: false }
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let isPaused = false;

    function typeAnimation() {
      const currentPhrase = phrases[phraseIndex];

      if (isPaused) {
        setTimeout(typeAnimation, 1500);
        isPaused = false;
        isDeleting = true;
        return;
      }

      if (isDeleting) {
        typingText.textContent = currentPhrase.text.substring(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
        }
        setTimeout(typeAnimation, 30);
      } else {
        typingText.textContent = currentPhrase.text.substring(0, charIndex + 1);
        charIndex++;

        // Add error styling
        if (currentPhrase.hasError) {
          typingText.classList.add('has-error');
        } else {
          typingText.classList.remove('has-error');
        }

        if (charIndex === currentPhrase.text.length) {
          isPaused = true;
        }
        setTimeout(typeAnimation, 80);
      }
    }

    // Start typing animation after a short delay
    setTimeout(typeAnimation, 1000);
  }

  // ===== ANIMATED STATS COUNTER =====
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  let statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;

    statNumbers.forEach(stat => {
      const target = parseInt(stat.dataset.target);
      const duration = 2000;
      const increment = target / (duration / 16);
      let current = 0;

      const updateCounter = () => {
        current += increment;
        if (current < target) {
          stat.textContent = Math.floor(current).toLocaleString();
          requestAnimationFrame(updateCounter);
        } else {
          stat.textContent = target.toLocaleString();
          // Add + suffix for certain stats
          if (target > 1000) {
            stat.textContent = target.toLocaleString() + '+';
          }
        }
      };

      updateCounter();
    });

    statsAnimated = true;
  }

  // Trigger stats animation when stats bar is visible
  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateStats();
          statsObserver.disconnect();
        }
      });
    }, { threshold: 0.5 });

    statsObserver.observe(statsBar);
  }

  // ===== EMAIL SIGNUP FORM =====
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = signupForm.querySelector('input[type="email"]').value;
      const button = signupForm.querySelector('button');
      const originalText = button.textContent;

      // Simulate form submission
      button.textContent = 'Subscribing...';
      button.disabled = true;

      setTimeout(() => {
        button.textContent = 'Subscribed!';
        button.style.background = 'linear-gradient(135deg, #27ae60, #1e8449)';
        signupForm.querySelector('input').value = '';

        // Reset after a few seconds
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
          button.disabled = false;
        }, 3000);
      }, 1000);
    });
  }

  // ===== INTERACTIVE DEMO =====
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

  // Event listeners for demo
  if (demoInput) {
    demoInput.addEventListener('input', debounce(() => updateDemo(), 400));
    // Initial highlight
    updateDemo();
  }

  // ===== SMOOTH SCROLL =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== DOWNLOAD BUTTON =====
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'https://github.com/draphael123/grammar-buddy/archive/refs/heads/main.zip';
    });
  }

  // ===== NAVBAR SCROLL EFFECT =====
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (navbar) {
      navbar.style.boxShadow = window.pageYOffset > 100
        ? '0 2px 20px rgba(0, 0, 0, 0.1)'
        : 'none';
    }
  });

  // ===== SCROLL ANIMATIONS =====
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.feature-card, .step, .faq-item, .use-case-card, .ba-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  // ===== FAQ ACCORDION =====
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
});
