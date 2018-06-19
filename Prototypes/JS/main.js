//SETUP RENDERER
var renderer = new THREE.WebGLRenderer({canvas: document.getElementById("three_js_canvas"), antialias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

//SETUP CAMERA
var camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.1, 10000); //FOV, ASPECT, NEAR, FAR
camera.position.set(650,3700,200);

//SETUP SCENE
var scene = new THREE.Scene();

//SETUP CONTROLS
var controls = new THREE.OrbitControls(camera);
controls.minDistance = 3;
controls.maxDistance = 4000;
controls.keys = {
    LEFT: 68, // D
    UP: 87, // W
    RIGHT: 65, // A
    BOTTOM: 83 // S
}
controls.mouseButtons = {
    ORBIT: THREE.MOUSE.RIGHT,
    ZOOM: THREE.MOUSE.MIDDLE,
    PAN: THREE.MOUSE.LEFT
}
controls.target = new THREE.Vector3(0,0,0);
controls.update();

//IMPORT MODEL
var GLTF_Loader = new THREE.GLTFLoader();
GLTF_Loader.load('ASSETS/st_thomas_head.gltf', 
function (GLTF_File) {
    GLTF_File.scene.position.set(-450, -5, -870);
    GLTF_File.scene.scale.set(0.5,0.5,0.5);
    scene.add(GLTF_File.scene);
});

//BACKGROUND PLANE
var map_plane = new THREE.PlaneGeometry(8192, 4096, 1, 1);
var map_texture = new THREE.TextureLoader().load("ASSETS/BACKGROUND.JPG");
var map_material = new THREE.MeshLambertMaterial( { color: 0xffffff, map: map_texture } );
var map_plane_mesh = new THREE.Mesh(map_plane, map_material);
map_plane_mesh.rotation.x = Math.PI / 2;
map_plane_mesh.rotation.y = Math.PI;
map_plane_mesh.rotation.z = Math.PI;
map_plane_mesh.position.set(0,-38,0);
map_plane_mesh.material.side = THREE.DoubleSide;
scene.add(map_plane_mesh);

//SETUP LIGHT
var amb_light = new THREE.AmbientLight(0xffffff);
scene.add(amb_light);

//MOVE CAMERA
//smoothCameraMovement(new THREE.Vector3(500,500,0), 10000);
//controls.target = new THREE.Vector3(smoothMovement((0,0,0), (-280,560,-700), 10000));
//controls.target = new THREE.Vector3(-280,560,-700);

//RENDER LOOP
requestAnimationFrame(render);
function render() {
    renderer.render(scene, camera);
    controls.update();
    TWEEN.update();
    requestAnimationFrame(render);
}

//PERFORM SMOOTH CAMERA MOVEMENT WITH CONTROL FREEZE
function smoothMovement(oldPosition, newPosition, duration){
    var tween = new TWEEN.Tween(oldPosition).to(newPosition, duration).easing(TWEEN.Easing.Quadratic.InOut).onUpdate(function(d) { controls.enabled = false; console.log("gdg"); }).onComplete(function(){ controls.enabled = true; });
    tween.start();
    return tween;
}