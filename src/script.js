import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

/**
 * Environment Map (HDRI)
 */
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/textures/hdr/sky.hdr', (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdrTexture; // Use HDRI for environment reflections
    scene.background = hdrTexture; // Optional: Use HDRI as the background
});

/**
 * House
 */
const houseGroup = new THREE.Group();
scene.add(houseGroup);

const gltfLoader = new GLTFLoader();
gltfLoader.load(
    '/models/FullCity/scene.gltf',
    (gltfScene) => {
        gltfScene.scene.scale.set(0.5, 0.5, 0.5); // Adjust scale
        gltfScene.scene.position.set(0, 0, 0); // Adjust position
        gltfScene.scene.rotation.set(0, Math.PI / 2, 0);

        gltfScene.scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.envMapIntensity = 1;
            }
        });

        houseGroup.add(gltfScene.scene);
        console.log("GLTF model loaded successfully!");
    },
    undefined,
    (error) => {
        console.error('Error loading GLTF model:', error);
    }
);

/**
 * Floor
 */
const textureLoader = new THREE.TextureLoader();
const floorColorTexture = textureLoader.load('/textures/floor/color.jpg');
const floorRoughnessTexture = textureLoader.load('/textures/floor/roughness.jpg');
const floorNormalTexture = textureLoader.load('/textures/floor/normal.jpg');
const floorAmbientOcclusionTexture = textureLoader.load('/textures/floor/ambientOcclusion.jpg');

const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorColorTexture,
    roughnessMap: floorRoughnessTexture,
    normalMap: floorNormalTexture,
    aoMap: floorAmbientOcclusionTexture,
    roughness: 0.8,
    metalness: 0.1,
});

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 480), // Updated size to 640x480
    floorMaterial
);
floor.rotation.x = -Math.PI * 0.5; // Rotate to lie flat
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

/**
 * Snow Particle System with Spherical Snowflakes
 */
const snowTexture = new THREE.TextureLoader().load('/textures/snowtexture.jpg'); // Snow texture

const snowGeometry = new THREE.BufferGeometry();
const snowCount = 50000;
const snowPositions = new Float32Array(snowCount * 3);

for (let i = 0; i < snowCount; i++) {
    const x = Math.random() * 50 - 25;
    const y = Math.random() * 20 + 10;
    const z = Math.random() * 50 - 25;
    snowPositions[i * 3] = x;
    snowPositions[i * 3 + 1] = y;
    snowPositions[i * 3 + 2] = z;
}

snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

// Creating spherical snowflakes by using smaller points
const snowMaterial = new THREE.PointsMaterial({
    map: snowTexture,
    size: 0.1,  // Smaller snowflakes (adjust the size here)
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,  // Optional: gives a glow-like effect to snow
});

const snow = new THREE.Points(snowGeometry, snowMaterial);
scene.add(snow);

/**
 * Animate Snowfall
 */
const animateSnow = () => {
    const positions = snowGeometry.attributes.position.array;

    for (let i = 0; i < snowCount; i++) {
        positions[i * 3] -= 0.01;
        positions[i * 3 + 1] -= 0.06;

        // Reset snowflakes that fall below the ground
        if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = Math.random() * 20 + 10; // Reset to a random height
            positions[i * 3] = Math.random() * 50 - 25; // Random X position
            positions[i * 3 + 2] = Math.random() * 50 - 25; // Random Z position
        }
    }

    snowGeometry.attributes.position.needsUpdate = true;
};

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(4, 5, 5);
scene.add(camera);

/**
 * First-Person Controls (Pointer Lock)
 */
const controls = new PointerLockControls(camera, canvas);
document.addEventListener('click', () => {
    controls.lock(); // Lock the pointer on click
});

// Movement controls
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const baseSpeed = 2;
const sprintSpeed = 4;
const jumpHeight = 3;
let canJump = false;
let isSprinting = false;
let moveSpeed = 2;

const keysPressed = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

document.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
    if (event.code === 'Space' && canJump) {
        velocity.y = jumpHeight;
        canJump = false;
    }
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

const applyCameraRelativeMovement = (delta) => {
    direction.set(0, 0, 0);

    if (keysPressed['KeyW']) direction.z += 1;
    if (keysPressed['KeyS']) direction.z -= 1;
    if (keysPressed['KeyA']) direction.x -= 1;
    if (keysPressed['KeyD']) direction.x += 1;

    direction.normalize();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, direction.z);
    move.addScaledVector(right, direction.x);

    move.normalize();
    move.multiplyScalar(moveSpeed * delta);

    camera.position.add(move);
};

/**
 * Collision Detection (Basic)
 */
const floorHeight = 0.5;

const checkCollisions = () => {
    if (camera.position.y <= floorHeight) {
        velocity.y = 0;
        canJump = true;
        camera.position.y = floorHeight;
    }
};

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor('#262827');

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();

const tick = () => {
    const delta = clock.getDelta();

    // Apply movement
    applyCameraRelativeMovement(delta);

    // Apply gravity
    velocity.y -= 9.8 * delta;
    camera.position.addScaledVector(velocity, delta);

    checkCollisions();

    // Animate snow
    animateSnow();

    // Render the scene
    renderer.render(scene, camera);

    window.requestAnimationFrame(tick);
};

tick();
