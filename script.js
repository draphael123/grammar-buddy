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
      message: 'Did you mean "weather" (climate) or "whether" (if)?'
    },
    {
      pattern: /\byou're\s+(email|message|letter|document|file|report)/gi,
      category: 'grammar',
      suggestion: 'your $1',
      message: 'Use "your" (possessive) instead of "you\'re" (you are)'
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
      message: 'Consider using "very" instead of "real" in formal writing'
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
      message: 'Consider using present perfect for recent events'
    }
  ];

  // Check text and display results
  function checkText(text) {
    const results = [];

    errorPatterns.forEach(error => {
      let match;
      const regex = new RegExp(error.pattern.source, error.pattern.flags);

      while ((match = regex.exec(text)) !== null) {
        const errorText = match[0];
        let suggestion = error.suggestion;

        // Handle capture groups in suggestion
        if (suggestion.includes('$1')) {
          suggestion = errorText.replace(error.pattern, error.suggestion);
        }

        results.push({
          text: errorText,
          suggestion: suggestion,
          category: error.category,
          message: error.message,
          offset: match.index
        });
      }
    });

    return results;
  }

  // Calculate score based on errors
  function calculateScore(text, errors) {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount === 0) return 100;

    const errorPenalty = Math.min(errors.length * 5, 50);
    return Math.max(100 - errorPenalty, 50);
  }

  // Render results
  function renderResults(results) {
    if (results.length === 0) {
      resultsList.innerHTML = `
        <div class="result-item" style="border-left-color: var(--tone); text-align: center;">
          <span style="color: var(--tone);">No issues found!</span>
        </div>
      `;
      return;
    }

    resultsList.innerHTML = results.map(result => `
      <div class="result-item ${result.category}">
        <div>
          <span class="error-word">${escapeHtml(result.text)}</span>
          <span> → </span>
          <span class="suggestion">${escapeHtml(result.suggestion)}</span>
        </div>
        <div class="message">${escapeHtml(result.message)}</div>
      </div>
    `).join('');

    // Add click handlers to apply fixes
    resultsList.querySelectorAll('.result-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        applyFix(results[index]);
      });
    });
  }

  // Apply a fix to the textarea
  function applyFix(result) {
    const text = demoInput.value;
    const regex = new RegExp(escapeRegex(result.text), 'gi');
    demoInput.value = text.replace(regex, result.suggestion);
    updateDemo();
  }

  // Escape regex special characters
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Update demo
  function updateDemo() {
    const text = demoInput.value;
    const results = checkText(text);
    const score = calculateScore(text, results);

    demoScore.textContent = score;
    renderResults(results);

    // Update score badge color
    demoScore.style.background = score >= 90
      ? 'linear-gradient(135deg, #27ae60, #1e8449)'
      : score >= 70
        ? 'linear-gradient(135deg, #667eea, #764ba2)'
        : 'linear-gradient(135deg, #e74c3c, #c0392b)';
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Debounce function
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

  // Event listeners
  demoInput.addEventListener('input', debounce(updateDemo, 300));

  // Initial check
  updateDemo();

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Install button click
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // In production, this would link to the Chrome Web Store
      alert('In production, this button will link to the Chrome Web Store to install Grammar Buddy!');
    });
  }

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
      navbar.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
  });

  // Animate elements on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe feature cards and steps
  document.querySelectorAll('.feature-card, .step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
});
