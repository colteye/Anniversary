// Mail functionality
function initMailFeature() {
    const mailIcon = document.getElementById('mail-icon');
    const mailPopup = document.getElementById('mail-popup');
    const closePopup = document.getElementById('close-popup');
    
    // Show popup
    function showMailPopup() {
        mailPopup.classList.add('show');
    }
    
    // Hide popup
    function hideMailPopup() {
        mailPopup.classList.remove('show');
    }
    
    // Event listeners
    mailIcon.addEventListener('click', showMailPopup);
    closePopup.addEventListener('click', hideMailPopup);
    
    // Close on background click
    mailPopup.addEventListener('click', (e) => {
        if (e.target === mailPopup) {
            hideMailPopup();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mailPopup.classList.contains('show')) {
            hideMailPopup();
        }
    });
}
