// Three.js scene setup and parallax functionality
let scene, camera, renderer, controls;
let parallaxPlane = null;

// Make parallaxPlane globally accessible
window.parallaxPlane = null;

// Intermediate Vertex Shader
// 2.5D Parallax Shader with negative parallax strength
const parallaxVertexShader = `
varying vec2 vUv;
varying vec3 vTangentViewPos;
varying vec3 vTangentFragPos;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  
  // For a plane, we can calculate tangent space directly
  vec3 N = normalize(normalMatrix * normal);
  vec3 T = normalize(normalMatrix * vec3(1.0, 0.0, 0.0)); // X-axis as tangent
  vec3 B = cross(N, T); // Calculate bitangent
  
  // Create TBN matrix for tangent space calculations
  mat3 TBN = transpose(mat3(T, B, N));
  
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  
  // Transform positions to tangent space
  vTangentViewPos = TBN * cameraPosition;
  vTangentFragPos = TBN * worldPos.xyz;
  vWorldNormal = N;
  
  gl_Position = projectionMatrix * viewPos;
}
`;

const parallaxFragmentShader = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float parallaxStrength;
uniform vec2 viewOffset;
uniform float edgeFade;
uniform float depthBlur;

varying vec2 vUv;
varying vec3 vTangentViewPos;
varying vec3 vTangentFragPos;
varying vec3 vWorldNormal;

// Gaussian blur function for depth sampling
float sampleDepthBlurred(vec2 texCoords, float blurAmount) {
  if (blurAmount <= 0.0) {
    return 1.0 - texture2D(depthTexture, texCoords).r;
  }
  
  float texelSize = 1.0 / 512.0; // Adjust based on your texture size
  float blur = blurAmount * texelSize;
  
  // 5x5 Gaussian kernel weights
  float weights[25];
  weights[0] = 0.003765; weights[1] = 0.015019; weights[2] = 0.023792; weights[3] = 0.015019; weights[4] = 0.003765;
  weights[5] = 0.015019; weights[6] = 0.059912; weights[7] = 0.094907; weights[8] = 0.059912; weights[9] = 0.015019;
  weights[10] = 0.023792; weights[11] = 0.094907; weights[12] = 0.150342; weights[13] = 0.094907; weights[14] = 0.023792;
  weights[15] = 0.015019; weights[16] = 0.059912; weights[17] = 0.094907; weights[18] = 0.059912; weights[19] = 0.015019;
  weights[20] = 0.003765; weights[21] = 0.015019; weights[22] = 0.023792; weights[23] = 0.015019; weights[24] = 0.003765;
  
  float result = 0.0;
  int index = 0;
  
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      vec2 offset = vec2(float(j), float(i)) * blur;
      float depth = 1.0 - texture2D(depthTexture, texCoords + offset).r;
      result += depth * weights[index];
      index++;
    }
  }
  
  return result;
}

vec2 parallaxOcclusionMapping(vec2 texCoords, vec3 viewDir) {
  // Dynamic layer count based on viewing angle
  float minLayers = 16.0;
  float maxLayers = 64.0;
  float numLayers = mix(maxLayers, minLayers, max(dot(vec3(0.0, 0.0, 1.0), viewDir), 0.0));
  
  float layerDepth = 1.0 / numLayers;
  float currentLayerDepth = 0.0;
  
  // Scale the parallax offset
  vec2 P = viewDir.xy * parallaxStrength;
  vec2 deltaTexCoords = P / numLayers;
  
  vec2 currentTexCoords = texCoords;
  float currentDepthMapValue = sampleDepthBlurred(currentTexCoords, depthBlur);
  
  // Raymarching through depth layers
  while(currentLayerDepth < currentDepthMapValue) {
    currentTexCoords -= deltaTexCoords;
    currentDepthMapValue = sampleDepthBlurred(currentTexCoords, depthBlur);
    currentLayerDepth += layerDepth;
  }
  
  // Occlusion mapping - find exact intersection point
  vec2 prevTexCoords = currentTexCoords + deltaTexCoords;
  
  float afterDepth = currentDepthMapValue - currentLayerDepth;
  float beforeDepth = sampleDepthBlurred(prevTexCoords, depthBlur) - currentLayerDepth + layerDepth;
  
  float weight = afterDepth / (afterDepth - beforeDepth);
  vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);
  
  return finalTexCoords;
}

vec3 calculateNormalFromHeight(vec2 texCoords, float strength) {
  float texelSize = 1.0 / 512.0; // Adjust based on your texture size
  
  // Use blurred depth for normal calculation too
  float heightL = sampleDepthBlurred(texCoords + vec2(-texelSize, 0.0), depthBlur);
  float heightR = sampleDepthBlurred(texCoords + vec2(texelSize, 0.0), depthBlur);
  float heightD = sampleDepthBlurred(texCoords + vec2(0.0, -texelSize), depthBlur);
  float heightU = sampleDepthBlurred(texCoords + vec2(0.0, texelSize), depthBlur);
  
  vec3 normal;
  normal.x = (heightL - heightR) * strength;
  normal.y = (heightD - heightU) * strength;
  normal.z = 1.0;
  
  return normalize(normal);
}

void main() {
  vec3 viewDir = normalize(vTangentViewPos - vTangentFragPos);
  
  // Apply view offset
  vec2 offsetUv = vUv + viewOffset * 0.02;
  
  // Calculate parallax mapping
  vec2 parallaxUv = parallaxOcclusionMapping(offsetUv, viewDir);
  
  // Clamp to prevent sampling outside texture bounds
  parallaxUv = clamp(parallaxUv, 0.001, 0.999);
  
  // Sample textures
  vec4 albedo = texture2D(colorTexture, parallaxUv);
  
  // Apply lighting
  vec3 finalColor = albedo.rgb;
  
  // Add depth-based effects (using blurred depth)
  float currentDepth = sampleDepthBlurred(parallaxUv, depthBlur);
  
  // Edge fade based on uniform
  vec2 edgeFadeDistance = vec2(edgeFade);
  vec2 edgeFactorAlpha = smoothstep(0.0, edgeFadeDistance.x, vUv) * 
                        smoothstep(0.0, edgeFadeDistance.y, 1.0 - vUv);
  float edgeAlpha = edgeFactorAlpha.x * edgeFactorAlpha.y;
  
  // Edge darkening for depth perception (separate from fade)
  vec2 edgeFactor = smoothstep(0.0, 0.05, parallaxUv) * smoothstep(0.0, 0.05, 1.0 - parallaxUv);
  finalColor *= mix(0.8, 1.0, edgeFactor.x * edgeFactor.y);
  
  gl_FragColor = vec4(finalColor, albedo.a * edgeAlpha);
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

function createParallaxPlane(imagePair) {
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
        // Get image dimensions from the loaded texture
        const imageWidth = colorTexture.image.width;
        const imageHeight = colorTexture.image.height;
        const aspectRatio = imageWidth / imageHeight;
        
        // Set a base size and calculate dimensions based on aspect ratio
        const baseSize = 5; // You can adjust this base size as needed
        let planeWidth, planeHeight;
        
        if (aspectRatio > 1) {
            // Landscape image
            planeWidth = baseSize;
            planeHeight = baseSize / aspectRatio;
        } else {
            // Portrait or square image
            planeHeight = baseSize;
            planeWidth = baseSize * aspectRatio;
        }
        
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 100, 100);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                colorTexture: { value: colorTexture },
                depthTexture: { value: depthTexture },
                parallaxStrength: { value: -0.4 },
                edgeFade: { value: 0.3 },
                viewOffset: { value: new THREE.Vector2(0, 0) },
                depthBlur: { value: 1.0 }
            },
            vertexShader: parallaxVertexShader,
            fragmentShader: parallaxFragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        parallaxPlane = new THREE.Mesh(geometry, material);
        scene.add(parallaxPlane);
        window.parallaxPlane = parallaxPlane;
        
        updateStatus(`Successfully loaded: ${imagePair.name} (${imageWidth}x${imageHeight}, aspect: ${aspectRatio.toFixed(2)})`);
    }).catch(error => {
        updateStatus(`Failed to create plane: ${error.message}`, true);
        console.error('Texture loading error:', error);
    });
}

function updateParallax() {
    if (parallaxPlane && parallaxPlane.material.uniforms) {
        const strength = document.getElementById('parallax-strength').value / 100;
        const fade = document.getElementById('edge-fade').value / 100;
        
        parallaxPlane.material.uniforms.parallaxStrength.value = strength * 0.2;
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
