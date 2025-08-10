// Visual effects functionality
let sparkles3D;
let time = 0;

function initEffects() {
    // Add 3D sparkles
    sparkles3D = addSparkles();
    
    // Create 2D effects
    setInterval(createHeart, 1000);
    setInterval(createSparkle, 1500);
}

// Reduced sparkles
function addSparkles() {
    const sparkleGeometry = new THREE.BufferGeometry();
    const sparkleCount = 20;
    const positions = new Float32Array(sparkleCount * 3);
    
    for (let i = 0; i < sparkleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 12;
        positions[i + 1] = (Math.random() - 0.5) * 12;
        positions[i + 2] = (Math.random() - 0.5) * 8;
    }
    
    sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const sparkleMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.03,
        transparent: true,
        opacity: 0.4
    });
    
    const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
    scene.add(sparkles);
    
    return sparkles;
}

// Create hearts
function createHeart() {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.innerHTML = '❤️';
    heart.style.left = Math.random() * 95 + '%';
    heart.style.animationDelay = Math.random() * 2 + 's';
    heart.style.animationDuration = (Math.random() * 2 + 6) + 's';
    document.getElementById('hearts').appendChild(heart);
    
    setTimeout(() => {
        if (heart.parentNode) heart.remove();
    }, 8000);
}

// Create sparkles
function createSparkle() {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    const sparkleSymbols = ['✨', '⭐', '💫', '🌟'];
    sparkle.innerHTML = sparkleSymbols[Math.floor(Math.random() * sparkleSymbols.length)];
    sparkle.style.left = Math.random() * 95 + '%';
    sparkle.style.animationDelay = Math.random() * 2 + 's';
    sparkle.style.animationDuration = (Math.random() * 3 + 5) + 's';
    document.getElementById('background-effects').appendChild(sparkle);
    
    setTimeout(() => {
        if (sparkle.parentNode) sparkle.remove();
    }, 8000);
}

function animateEffects() {
    time += 0.005;
    
    if (sparkles3D) {
        sparkles3D.rotation.x += 0.0005;
        sparkles3D.rotation.y += 0.001;
    }
}
