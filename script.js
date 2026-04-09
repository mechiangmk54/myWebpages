document.addEventListener('DOMContentLoaded', () => {
    const inputSection = document.getElementById('input-section');
    const greetingSection = document.getElementById('greeting-section');
    const nameInput = document.getElementById('name-input');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const greetingText = document.getElementById('greeting-text');

    function animateTransition(hideEl, showEl) {
        hideEl.classList.remove('fade-in');
        hideEl.classList.add('fade-out');

        setTimeout(() => {
            hideEl.style.display = 'none';
            showEl.style.display = 'block';
            showEl.classList.remove('fade-out');
            showEl.classList.add('fade-in');
            
            if (showEl === inputSection) {
                nameInput.focus();
            }
        }, 400); // 400ms matches the fadeOutScale animation duration
    }

    function showGreeting() {
        const name = nameInput.value.trim();
        if (name) {
            greetingText.textContent = `歡迎你 ${name}`;
            animateTransition(inputSection, greetingSection);
        } else {
            // Add a small shake animation or focus to indicate error
            nameInput.focus();
            nameInput.style.borderColor = '#ef4444';
            setTimeout(() => {
                nameInput.style.borderColor = '';
            }, 1000);
        }
    }

    function resetForm() {
        nameInput.value = '';
        animateTransition(greetingSection, inputSection);
    }

    submitBtn.addEventListener('click', showGreeting);
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            showGreeting();
        }
    });

    resetBtn.addEventListener('click', resetForm);
});
