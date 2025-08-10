// Three.js scene setup and parallax functionality
let scene, camera, renderer, controls;
let parallaxPlane = null;

// Make parallaxPlane globally accessible
window.parallaxPlane = null;

// 2.5D Parallax Shader with negative parallax strength
const parallaxVertexShader = `
    varying vec2 vUv;
    varying vec3 vViewPosition;
    
    void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const parallaxFragmentShader = `
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;
    uniform float parallaxStrength;
    uniform float edgeFade;
    uniform vec2 viewOffset;
    
    varying vec2 vUv;
    varying vec3 vViewPosition;
    
    void main() {
        // Get depth from depth map
        float depth = texture2D(depthTexture, vUv).r;
        
        // Calculate parallax offset based on view angle and depth
        vec3 viewDir = normalize(vViewPosition);
        vec2 parallaxOffset = viewOffset * depth * parallaxStrength;
        
        // Sample color texture with parallax offset
        vec2 offsetUv = vUv + parallaxOffset;
        
        // Clamp UV coordinates to prevent wrapping
        offsetUv = clamp(offsetUv, 0.0, 1.0);
        
        vec4 color = texture2D(colorTexture, offsetUv);
        
        // Add depth-based lighting
        float lightingFactor = 1.0 + depth * 0.1;
        color.rgb *= lightingFactor;
        
        // Edge fade effect
        vec2 fadeUv = vUv;
        float fadeDistance = edgeFade * 0.5;
        
        float fadeX = min(
            smoothstep(0.0, fadeDistance, fadeUv.x),
            smoothstep(1.0, 1.0 - fadeDistance, fadeUv.x)
        );
        
        float fadeY = min(
            smoothstep(0.0, fadeDistance, fadeUv.y),
            smoothstep(1.0, 1.0 - fadeDistance, fadeUv.y)
        );
        
        float fadeAlpha = fadeX * fadeY;
        color.a *= fadeAlpha;
        
        gl_FragColor = color;
    }
`;

function initThreeScene() {
    // Scene setup - full screen
    const canvasContainer = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1, 
        1000
    );
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    canvasContainer.appendChild(renderer.domElement);

    // Very limited OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.screenSpacePanning = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    
    controls.minAzimuthAngle = -Math.PI / 15;
    controls.maxAzimuthAngle = Math.PI / 15;
    controls.minPolarAngle = Math.PI / 2 - Math.PI / 15;
    controls.maxPolarAngle = Math.PI / 2 + Math.PI / 15;
    
    controls.minDistance = 5;
    controls.maxDistance = 6;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(1, 1, 2);
    scene.add(directionalLight);

    // Camera positioning
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
}

function createParallaxPlane(imagePair, shouldBlur = false) {
    updateStatus('Creating parallax plane...');
    
    if (parallaxPlane) {
        scene.remove(parallaxPlane);
        parallaxPlane = null;
        window.parallaxPlane = null;
    }
    
    const loader = new THREE.TextureLoader();
    
    const loadTexture = (url) => {
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
    };
    
    Promise.all([
        loadTexture(imagePair.image),
        loadTexture(imagePair.depth)
    ]).then(([colorTexture, depthTexture]) => {
        const planeSize = 5;
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 100, 100);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                colorTexture: { value: colorTexture },
                depthTexture: { value: depthTexture },
                parallaxStrength: { value: -0.4 },
                edgeFade: { value: 0.3 },
                viewOffset: { value: new THREE.Vector2(0, 0) }
            },
            vertexShader: parallaxVertexShader,
            fragmentShader: parallaxFragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        parallaxPlane = new THREE.Mesh(geometry, material);
        scene.add(parallaxPlane);
        window.parallaxPlane = parallaxPlane;
        
        updateStatus(`Successfully loaded: ${imagePair.name}`);
    }).catch(error => {
        updateStatus(`Failed to create plane: ${error.message}`, true);
        console.error('Texture loading error:', error);
    });
}

function updateParallax() {
    if (parallaxPlane && parallaxPlane.material.uniforms) {
        const strength = -document.getElementById('parallax-strength').value / 100;
        const fade = document.getElementById('edge-fade').value / 100;
        
        parallaxPlane.material.uniforms.parallaxStrength.value = strength;
        parallaxPlane.material.uniforms.edgeFade.value = fade;
        
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        
        const offset = new THREE.Vector2(
            cameraDirection.x * 0.05,
            cameraDirection.y * 0.05
        );
        
        parallaxPlane.material.uniforms.viewOffset.value = offset;
    }
}
