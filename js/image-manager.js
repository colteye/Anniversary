// Image management functionality - Global variables
window.imagePairs = [];
window.currentImageIndex = -1;
window.availablePairs = [];
window.unlockedImages = new Set();

// Access global variables
let imagePairs, currentImageIndex, availablePairs, unlockedImages;

// Status display
function updateStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = isError ? 'error' : 'status';
}

// File handling for images
function initImageManager() {
    // Initialize global references
    imagePairs = window.imagePairs;
    currentImageIndex = window.currentImageIndex;
    availablePairs = window.availablePairs;
    unlockedImages = window.unlockedImages;
    
    console.log('Image manager initialized');
    
    // Ensure lock overlay is hidden initially
    const lockOverlay = document.getElementById('lock-overlay');
    if (lockOverlay) {
        lockOverlay.classList.add('hidden');
    }
    
    document.getElementById('image-upload').addEventListener('change', function(event) {
        const files = Array.from(event.target.files);
        processImageFiles(files, 'image');
    });

    document.getElementById('depth-upload').addEventListener('change', function(event) {
        const files = Array.from(event.target.files);
        processImageFiles(files, 'depth');
    });

    document.getElementById('image-select').addEventListener('change', function(e) {
        const index = parseInt(e.target.value);
        if (!isNaN(index) && imagePairs[index]) {
            loadImagePair(index);
        }
    });

    // Initialize lock overlay click handler
    initLockOverlay();
}

function initLockOverlay() {
    const lockOverlay = document.getElementById('lock-overlay');
    
    if (!lockOverlay) {
        console.error('Lock overlay element not found');
        return;
    }
    
    lockOverlay.addEventListener('click', (e) => {
        console.log('Lock overlay clicked');
        e.preventDefault();
        e.stopPropagation();
        
        if (currentImageIndex >= 0) {
            const availableIndex = getAvailableIndexForGlobal(currentImageIndex);
            console.log('Current image index:', currentImageIndex, 'Available index:', availableIndex);
            console.log('Is unlocked:', unlockedImages.has(availableIndex));
            
            if (availableIndex >= 0 && !unlockedImages.has(availableIndex)) {
                showWordSearchForCurrentImage();
            }
        } else {
            console.log('No current image selected');
        }
    });
    
    console.log('Lock overlay click handler initialized');
}

function processImageFiles(files, type) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const baseName = file.name.split('.')[0].replace(/_depth|_normal|_disp/, '');
                
                let pair = imagePairs.find(p => p.name === baseName);
                if (!pair) {
                    pair = { name: baseName, image: null, depth: null };
                    imagePairs.push(pair);
                }
                
                if (type === 'image') {
                    pair.image = e.target.result;
                } else {
                    pair.depth = e.target.result;
                }
                
                // Update globals
                window.imagePairs = imagePairs;
                
                updateImageSelector();
                checkAndLoadFirstImage();
                updateNavigationControls();
                updateStatus(`Loaded ${type}: ${file.name}`);
            };
            img.onerror = function() {
                updateStatus(`Failed to load: ${file.name}`, true);
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            updateStatus(`Failed to read: ${file.name}`, true);
        };
        reader.readAsDataURL(file);
    });
}

function checkAndLoadFirstImage() {
    // Update available pairs
    availablePairs = imagePairs.filter(pair => pair.image && pair.depth);
    window.availablePairs = availablePairs;
    
    // Only auto-load if we have available pairs and no current image
    if (currentImageIndex === -1 && availablePairs.length > 0) {
        const firstPairGlobalIndex = imagePairs.findIndex(pair => pair === availablePairs[0]);
        if (firstPairGlobalIndex >= 0) {
            console.log('Auto-loading first image pair:', firstPairGlobalIndex);
            loadImagePair(firstPairGlobalIndex);
        }
    }
}

function loadImagePair(globalIndex) {
    if (globalIndex < 0 || globalIndex >= imagePairs.length) {
        console.log('Invalid global index:', globalIndex);
        return;
    }
    
    const pair = imagePairs[globalIndex];
    if (!pair || !pair.image || !pair.depth) {
        console.log('Invalid pair or missing image/depth:', pair);
        return;
    }
    
    console.log('Loading image pair:', globalIndex, pair.name);
    
    currentImageIndex = globalIndex;
    window.currentImageIndex = globalIndex;
    
    // Create the parallax plane (initially without blur, we'll add it based on lock status)
    createParallaxPlane(pair, false);
    
    // Small delay to ensure the plane is created before applying effects
    setTimeout(() => {
        // Check if this image is unlocked
        const availableIndex = getAvailableIndexForGlobal(globalIndex);
        const isUnlocked = unlockedImages.has(availableIndex);
        
        console.log('Image unlock status:', availableIndex, isUnlocked);
        
        if (isUnlocked) {
            showUnlockedImage();
        } else {
            showLockedImage();
        }
    }, 100);
    
    updateImageSelector();
    updateNavigationControls();
    
    // Update dropdown selection
    document.getElementById('image-select').value = globalIndex;
}

function getAvailableIndexForGlobal(globalIndex) {
    if (globalIndex < 0 || globalIndex >= imagePairs.length) return -1;
    const pair = imagePairs[globalIndex];
    return availablePairs.findIndex(p => p === pair);
}

function showLockedImage() {
    console.log('Showing locked image');
    const lockOverlay = document.getElementById('lock-overlay');
    const lockText = document.getElementById('lock-text');
    const canvasContainer = document.getElementById('canvas-container');
    
    // Set generic text without filename
    if (lockText) {
        lockText.textContent = 'Click to solve puzzle';
    }
    
    if (lockOverlay) {
        lockOverlay.classList.remove('hidden');
    }
    
    // Apply blur effect using CSS classes
    if (canvasContainer) {
        canvasContainer.classList.remove('canvas-container-revealed');
        canvasContainer.classList.add('canvas-container-blurred');
    }
}

function showUnlockedImage() {
    console.log('Showing unlocked image');
    const lockOverlay = document.getElementById('lock-overlay');
    const canvasContainer = document.getElementById('canvas-container');
    
    if (lockOverlay) {
        lockOverlay.classList.add('hidden');
    }
    
    // Remove blur effect using CSS classes
    if (canvasContainer) {
        canvasContainer.classList.remove('canvas-container-blurred');
        canvasContainer.classList.add('canvas-container-revealed');
    }
}

function showWordSearchForCurrentImage() {
    if (currentImageIndex < 0) {
        console.log('No current image to show word search for');
        return;
    }
    
    const availableIndex = getAvailableIndexForGlobal(currentImageIndex);
    if (availableIndex >= 0) {
        console.log('Showing word search for available index:', availableIndex);
        
        // Check if the showWordSearch function exists
        if (typeof window.showWordSearch === 'function') {
            window.showWordSearch(availableIndex);
        } else if (typeof showWordSearch === 'function') {
            showWordSearch(availableIndex);
        } else {
            console.error('showWordSearch function not found');
        }
    } else {
        console.log('Invalid available index:', availableIndex);
    }
}

function unlockCurrentImage() {
    if (currentImageIndex < 0) return;
    
    const availableIndex = getAvailableIndexForGlobal(currentImageIndex);
    if (availableIndex >= 0) {
        console.log('Unlocking image at available index:', availableIndex);
        unlockedImages.add(availableIndex);
        window.unlockedImages = unlockedImages;
        showUnlockedImage();
        updateImageSelector();
    }
}

// Make functions globally accessible
window.unlockCurrentImage = unlockCurrentImage;

function updateImageSelector() {
    const selector = document.getElementById('image-select');
    selector.innerHTML = '<option value="">Select an image pair...</option>';
    
    imagePairs.forEach((pair, index) => {
        if (pair.image && pair.depth) {
            const availableIndex = getAvailableIndexForGlobal(index);
            const isUnlocked = availableIndex >= 0 && unlockedImages.has(availableIndex);
            
            const option = document.createElement('option');
            option.value = index;
            option.textContent = isUnlocked ? `${pair.name} ✓` : `${pair.name} 🔒`;
            selector.appendChild(option);
        } else {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${pair.name} (incomplete)`;
            option.disabled = true;
            selector.appendChild(option);
        }
    });
}

function updateNavigationControls() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const counter = document.getElementById('image-counter');
    
    availablePairs = imagePairs.filter(pair => pair.image && pair.depth);
    window.availablePairs = availablePairs;
    const totalPairs = availablePairs.length;
    
    if (totalPairs === 0) {
        counter.textContent = '0/0';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    
    let currentAvailableIndex = -1;
    if (currentImageIndex >= 0 && imagePairs[currentImageIndex]) {
        currentAvailableIndex = availablePairs.findIndex(pair => 
            pair === imagePairs[currentImageIndex]
        );
    }
    
    if (currentAvailableIndex >= 0) {
        counter.textContent = `${currentAvailableIndex + 1}/${totalPairs}`;
        prevBtn.disabled = currentAvailableIndex <= 0;
        nextBtn.disabled = currentAvailableIndex >= totalPairs - 1;
    } else {
        counter.textContent = `0/${totalPairs}`;
        prevBtn.disabled = true;
        nextBtn.disabled = totalPairs <= 0;
    }
}

function navigateToPrevious() {
    if (availablePairs.length === 0) return;
    
    let currentAvailableIndex = -1;
    if (currentImageIndex >= 0 && imagePairs[currentImageIndex]) {
        currentAvailableIndex = availablePairs.findIndex(pair => 
            pair === imagePairs[currentImageIndex]
        );
    }
    
    const newIndex = Math.max(0, currentAvailableIndex - 1);
    const targetPair = availablePairs[newIndex];
    const targetGlobalIndex = imagePairs.findIndex(pair => pair === targetPair);
    
    if (targetGlobalIndex >= 0) {
        loadImagePair(targetGlobalIndex);
    }
}

function navigateToNext() {
    if (availablePairs.length === 0) return;
    
    let currentAvailableIndex = -1;
    if (currentImageIndex >= 0 && imagePairs[currentImageIndex]) {
        currentAvailableIndex = availablePairs.findIndex(pair => 
            pair === imagePairs[currentImageIndex]
        );
    }
    
    const newIndex = Math.min(availablePairs.length - 1, currentAvailableIndex + 1);
    const targetPair = availablePairs[newIndex];
    const targetGlobalIndex = imagePairs.findIndex(pair => pair === targetPair);
    
    if (targetGlobalIndex >= 0) {
        loadImagePair(targetGlobalIndex);
    }
}

function initNavigation() {
    document.getElementById('prev-btn').addEventListener('click', navigateToPrevious);
    document.getElementById('next-btn').addEventListener('click', navigateToNext);
}
