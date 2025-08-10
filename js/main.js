// Main application initialization and animation loop
function init() {
    console.log('Starting application initialization...');
    
    // Check if puzzles are loaded
    setTimeout(() => {
        if (typeof window.wordSearchPuzzles !== 'undefined') {
            console.log('Word search puzzles loaded successfully:', window.wordSearchPuzzles.length);
        } else {
            console.warn('Word search puzzles not loaded, will use fallback');
        }
    }, 100);
    
    // Initialize all modules
    initThreeScene();
    initMailFeature();
    initWordSearch();
    initImageManager();
    initNavigation();
    initEffects();
    
    // Set initial status
    updateStatus('Ready! Upload your image and depth map files.');
    updateNavigationControls();
    
    // Global keyboard event handlers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('word-search-popup').classList.contains('show')) {
                hideWordSearch();
            }
            if (document.getElementById('mail-popup').classList.contains('show')) {
                document.getElementById('mail-popup').classList.remove('show');
            }
        }
    });
    
    console.log('Application initialized successfully');
    
    // Start animation loop
    animate();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (typeof updateParallax === 'function') {
        updateParallax();
    }
    
    if (typeof animateEffects === 'function') {
        animateEffects();
    }
    
    if (typeof controls !== 'undefined' && controls) {
        controls.update();
    }
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined' && renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
