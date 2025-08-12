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

// Extract corner colors from image to create gradient
function extractCornerColors(imageUrl, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Add this option
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        try {
            ctx.drawImage(img, 0, 0);
            
            const sampleSize = 20;
            const width = canvas.width;
            const height = canvas.height;
            
            const corners = [
                { x: 0, y: 0, name: 'top-left' },
                { x: width - sampleSize, y: 0, name: 'top-right' },
                { x: 0, y: height - sampleSize, name: 'bottom-left' },
                { x: width - sampleSize, y: height - sampleSize, name: 'bottom-right' }
            ];
            
            const cornerColors = [];
            
            corners.forEach(corner => {
                const imageData = ctx.getImageData(corner.x, corner.y, sampleSize, sampleSize);
                const data = imageData.data;
                
                let r = 0, g = 0, b = 0;
                const pixels = data.length / 4;
                
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                }
                
                r = Math.round(r / pixels);
                g = Math.round(g / pixels);
                b = Math.round(b / pixels);
                
                cornerColors.push(`rgb(${r}, ${g}, ${b})`);
            });
            
            callback(cornerColors);
            
        } catch (error) {
            console.error('Error extracting colors:', error);
            callback(['#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a']);
        }
    };
    
    img.onerror = function() {
        console.error('Failed to load image for color extraction');
        callback(['#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a']);
    };
    
    img.src = imageUrl;
}

function updateBackgroundGradientAdvanced(colors) {
    const body = document.body;
    const [topLeft, topRight, bottomLeft, bottomRight] = colors;
    
    const gradient = `
        radial-gradient(circle at 0% 0%, ${topLeft} 0%, transparent 50%),
        radial-gradient(circle at 100% 0%, ${topRight} 0%, transparent 50%),
        radial-gradient(circle at 0% 100%, ${bottomLeft} 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, ${bottomRight} 0%, transparent 50%),
        linear-gradient(45deg, 
            ${topLeft} 0%, 
            ${topRight} 25%, 
            ${bottomRight} 50%, 
            ${bottomLeft} 75%,
            ${topLeft} 100%
        )
    `.replace(/\s+/g, ' ').trim();
    
    console.log('Setting advanced corner gradient:', gradient);
    body.style.background = gradient;
}

function resetBackground() {
    const body = document.body;
    body.style.background = '#000000';
    console.log('Reset background to black');
}

// File handling for folder upload
function initImageManager() {
    imagePairs = window.imagePairs;
    currentImageIndex = window.currentImageIndex;
    availablePairs = window.availablePairs;
    unlockedImages = window.unlockedImages;
    
    console.log('Image manager initialized');
    
    const lockOverlay = document.getElementById('lock-overlay');
    if (lockOverlay) {
        lockOverlay.classList.add('hidden');
    }
    
    // New folder upload handler
    document.getElementById('folder-upload').addEventListener('change', function(event) {
        const files = Array.from(event.target.files);
        processFolderFiles(files);
    });
    
    initLockOverlay();
}

function processFolderFiles(files) {
    updateStatus('Processing folder...');
    
    // Clear existing pairs
    imagePairs.length = 0;
    window.imagePairs = imagePairs;
    
    // Separate files into main folder and depth subfolder
    const mainImages = [];
    const depthImages = [];
    
    files.forEach(file => {
        const pathParts = file.webkitRelativePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const folderName = pathParts[pathParts.length - 2];
        
        // Check if file is an image
        if (!file.type.startsWith('image/')) return;
        
        if (folderName === 'depth') {
            depthImages.push({file, fileName});
        } else {
            mainImages.push({file, fileName});
        }
    });
    
    console.log(`Found ${mainImages.length} main images and ${depthImages.length} depth images`);
    
    // Process main images first
    let processedMainImages = 0;
    let processedDepthImages = 0;
    const totalImages = mainImages.length + depthImages.length;
    
    function checkIfComplete() {
        if (processedMainImages + processedDepthImages >= totalImages) {
            checkAndLoadFirstImage();
            updateNavigationControls();
            
            const completePairs = imagePairs.filter(pair => pair.image && pair.depth).length;
            updateStatus(`Loaded ${completePairs} complete image pairs from folder`);
        }
    }
    
    // Process main images
    mainImages.forEach(({file, fileName}) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const baseName = getBaseName(fileName);
                
                let pair = imagePairs.find(p => p.name === baseName);
                if (!pair) {
                    pair = { name: baseName, image: null, depth: null };
                    imagePairs.push(pair);
                }
                
                pair.image = e.target.result;
                window.imagePairs = imagePairs;
                
                processedMainImages++;
                updateStatus(`Processing... ${processedMainImages + processedDepthImages}/${totalImages}`);
                checkIfComplete();
            };
            img.onerror = function() {
                processedMainImages++;
                console.error(`Failed to load main image: ${fileName}`);
                checkIfComplete();
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            processedMainImages++;
            console.error(`Failed to read main image: ${fileName}`);
            checkIfComplete();
        };
        reader.readAsDataURL(file);
    });
    
    // Process depth images
    depthImages.forEach(({file, fileName}) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const baseName = getBaseName(fileName);
                
                let pair = imagePairs.find(p => p.name === baseName);
                if (!pair) {
                    pair = { name: baseName, image: null, depth: null };
                    imagePairs.push(pair);
                }
                
                pair.depth = e.target.result;
                window.imagePairs = imagePairs;
                
                processedDepthImages++;
                updateStatus(`Processing... ${processedMainImages + processedDepthImages}/${totalImages}`);
                checkIfComplete();
            };
            img.onerror = function() {
                processedDepthImages++;
                console.error(`Failed to load depth image: ${fileName}`);
                checkIfComplete();
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            processedDepthImages++;
            console.error(`Failed to read depth image: ${fileName}`);
            checkIfComplete();
        };
        reader.readAsDataURL(file);
    });
    
    if (totalImages === 0) {
        updateStatus('No valid image files found in folder', true);
    }
}

function getBaseName(fileName) {
    // Remove file extension and common depth map suffixes
    return fileName
        .toLowerCase()
        .replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '')
        .replace(/(_depthmap|_depth|_normal|_disp|_displacement)$/i, '');
}

// Legacy individual file processing (kept for backwards compatibility)
function processImageFiles(files, type) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const baseName = getBaseName(file.name);
                
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
                
                window.imagePairs = imagePairs;
                
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

function checkAndLoadFirstImage() {
    availablePairs = imagePairs.filter(pair => pair.image && pair.depth);
    window.availablePairs = availablePairs;
    
    if (currentImageIndex === -1 && availablePairs.length > 0) {
        const firstPairGlobalIndex = imagePairs.findIndex(pair => pair === availablePairs[0]);
        if (firstPairGlobalIndex >= 0) {
            console.log('Auto-loading first image pair:', firstPairGlobalIndex);
            loadImagePair(firstPairGlobalIndex);
        }
    } else if (availablePairs.length === 0) {
        resetBackground();
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
    
    extractCornerColors(pair.image, (colors) => {
        updateBackgroundGradientAdvanced(colors);
    });
    
    createParallaxPlane(pair, false);
    
    setTimeout(() => {
        const availableIndex = getAvailableIndexForGlobal(globalIndex);
        const isUnlocked = unlockedImages.has(availableIndex);
        
        console.log('Image unlock status:', availableIndex, isUnlocked);
        
        if (isUnlocked) {
            showUnlockedImage();
        } else {
            showLockedImage();
        }
    }, 100);
    
    updateNavigationControls();
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
    
    if (lockText) {
        lockText.textContent = 'Click to solve puzzle';
    }
    
    if (lockOverlay) {
        lockOverlay.classList.remove('hidden');
    }
    
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
    }
}

window.unlockCurrentImage = unlockCurrentImage;


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
