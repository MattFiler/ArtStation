//DEFINE LOD LEVELS
var LOD_HIGH_DETAIL = 0;
var LOD_MEDIUM_DETAIL = 1;
var LOD_LOW_DETAIL = 2;

//DEFINE LOCATIONS
var LOCATION = [
    createLocation(
        "st_thomas_head",
        new THREE.Vector3(0,0,0), 
        new THREE.Vector3(-44.1, -35.46, 106.15), 
        new THREE.Vector3(-0.2258, -0.3901, -0.0520)),
    createLocation(
        "field",
        new THREE.Vector3(800,-50,-400),
        new THREE.Vector3(751.3, -50.5, -316.5), 
        new THREE.Vector3(-0.1809, -0.5722, -0.1113))
];
var LOCATION_MESHES = [];
var WORLDVIEW_POSITION = [new THREE.Vector3(400,2000,0), new THREE.Vector3(-Math.PI/2,0,0)];

//SETUP RENDERER
var renderer = new THREE.WebGLRenderer({canvas: document.getElementById("ARTSTATION_Canvas"), antialias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

//SETUP CAMERA
var camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.1, 10000); 
camera.position.x = WORLDVIEW_POSITION[0].x;
camera.position.y = WORLDVIEW_POSITION[0].y;
camera.position.z = WORLDVIEW_POSITION[0].z;
camera.rotation.x = WORLDVIEW_POSITION[1].x;
camera.rotation.y = WORLDVIEW_POSITION[1].y;
camera.rotation.z = WORLDVIEW_POSITION[1].z;

//SETUP SCENE
var scene = new THREE.Scene();

//TEMP BACKGROUND
var path = 'ASSETS/Cubemap/';
var format = '.jpg';
var envMap = new THREE.CubeTextureLoader().load([
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
]);
scene.background = envMap;

//SETUP CONTROLS
var flyControls = new THREE.FlyControls(camera);
flyControls.movementSpeed = 5;
flyControls.domElement = document.getElementById("ARTSTATION_Canvas");
flyControls.rollSpeed = Math.PI/15;
flyControls.autoForward = false;
flyControls.dragToLook = true;
flyControls.enabled = false;

//LOAD WORLD VIEW (LOW LOD MODELS)
loadWorldView();

//SETUP LIGHT
var amb_light = new THREE.AmbientLight(0xffffff);
scene.add(amb_light);

//BACKGROUND PLANE
var map_plane = new THREE.PlaneGeometry(2048, 2048, 1, 1);
var map_texture = new THREE.TextureLoader().load("ASSETS/Background/background.jpg");
map_texture.wrapS = THREE.RepeatWrapping;
map_texture.wrapT = THREE.RepeatWrapping;
map_texture.repeat.set( 4, 4 );
var map_material = new THREE.MeshLambertMaterial( { color: 0xffffff, map: map_texture } );
var map_plane_mesh = new THREE.Mesh(map_plane, map_material);
map_plane_mesh.rotation.x = Math.PI / 2;
map_plane_mesh.rotation.y = Math.PI;
map_plane_mesh.rotation.z = Math.PI;
map_plane_mesh.position.set(400,-65,0);
map_plane_mesh.material.side = THREE.DoubleSide;
scene.add(map_plane_mesh);

//SPAWN ALL VIDEOS IN WORLD
spawnAllVideos();

//RENDER LOOP
requestAnimationFrame(render);
var clock = new THREE.Clock();
function render() {
    renderer.render(scene, camera);
    flyControls.update(clock.getDelta());
    TWEEN.update();
    requestAnimationFrame(render);
}

//LOAD LOCATION
function loadLocation(location, lod) {
    //IMPORT MODEL
    var GLTF_Loader = new THREE.GLTFLoader();
    GLTF_Loader.load("ASSETS/"+location.Name+"/model_lod"+lod+".gltf", 
    function (GLTF_File) {
        //GRAB MESH FOR INTERACTION
        GLTF_File.scene.traverse((node) => {       
            if (node.isMesh) {
                LOCATION_MESHES.push(node);
            }
        });

        //ADD GLTF SCENE TO WEBGL SCENE
        GLTF_File.scene.position.x = location.WorldSpawn.x;
        GLTF_File.scene.position.y = location.WorldSpawn.y;
        GLTF_File.scene.position.z = location.WorldSpawn.z;
        GLTF_File.scene.name = "ARTSTATION_EnvironmentScene";
        scene.add(GLTF_File.scene);

        //SAVE UUID
        location.UUID = GLTF_File.scene.uuid;
    });
}

//CREATE LOCATION
function createLocation(name, worldSpawn, cameraStartPos, cameraStartRot) {
    var location_data = {
        Name: name,
        WorldSpawn: worldSpawn, 
        CameraStartPos: cameraStartPos,
        CameraStartRot: cameraStartRot,
        UUID: "X"
    };
    return location_data;
}

//LOAD WORLD VIEW
function loadWorldView() {
    unloadWorldView();
    for (var i=0; i < LOCATION.length; i++) {
        loadLocation(LOCATION[i], LOD_LOW_DETAIL);
    }
}

//UNLOAD WORLD VIEW
function unloadWorldView() {
    try {
        scene.traverse((node) => {       
            if (node.name == "ARTSTATION_EnvironmentScene") {
                scene.remove(node);
            }
        });
    } catch { }
    //if (LOCATION[i].UUID == scene.children[i].uuid) {
}

//MOVE TO LOCATION ON CLICK
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
$(document).on("click",function(event) {
    mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    var intersects = raycaster.intersectObjects(LOCATION_MESHES);
    if (intersects.length > 0) {
        var interacted_model_position = {
            x: intersects[0].object.matrixWorld.elements[12],
            y: intersects[0].object.matrixWorld.elements[13],
            z: intersects[0].object.matrixWorld.elements[14]
        };
        for (var i=0; i < LOCATION.length; i++) {
            if (LOCATION[i].WorldSpawn.x == interacted_model_position.x &&
                LOCATION[i].WorldSpawn.y == interacted_model_position.y &&
                LOCATION[i].WorldSpawn.z == interacted_model_position.z) {
                //UNLOAD LOW LOD MODELS, LOAD HIGH LOD MODEL
                unloadWorldView();
                loadLocation(LOCATION[i], LOD_MEDIUM_DETAIL);

                //MOVE TO LOCATION
                performTween(camera.position, LOCATION[i].CameraStartPos, 5000);
                performTween(camera.rotation, LOCATION[i].CameraStartRot, 5000);
            }
        }
    }
});

//MOVE BACK TO "WORLD VIEW" ON PRESS OF KEY (ENTER)
$(document).keypress(function(e) {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if(keycode == '13'){
        loadWorldView();
        performTween(camera.position, WORLDVIEW_POSITION[0], 5000, false);
        performTween(camera.rotation, WORLDVIEW_POSITION[1], 5000, false);   
    }
});

//SPAWN ALL VIDEOS IN WORLD
function spawnAllVideos() {
    createVideo(new THREE.Vector3(0,0,0), "field", "edited.mp4");
}

//CREATE A VIDEO IN WORLD
function createVideo(position, location, videoName) {
    var video_element = document.createElement("video");
    video_element.src = "ASSETS/"+location+"/Videos/"+videoName;
    video_element.id = location+"_"+videoName;
    video_element.autoplay = true;
    video_element.volume = 0;
    document.body.appendChild(video_element);
    var video_plane = new THREE.PlaneGeometry(60, 34, 1, 1);
    var video_elem = document.getElementById(location+"_"+videoName);
    var video_texture = new THREE.VideoTexture(video_elem);
    video_texture.minFilter = THREE.LinearFilter;
    video_texture.magFilter = THREE.LinearFilter;
    video_texture.format = THREE.RGBFormat;
    var video_material = new THREE.MeshLambertMaterial( { color: 0xffffff, map: video_texture } );
    var video_plane_mesh = new THREE.Mesh(video_plane, video_material);
    video_plane_mesh.material.side = THREE.DoubleSide;
    video_plane_mesh.name = "ARTSTATION_VideoPlane";
    video_plane_mesh.position.x = position.x;
    video_plane_mesh.position.y = position.y;
    video_plane_mesh.position.z = position.z;
    scene.add(video_plane_mesh);
}

//PERFORM SMOOTH CAMERA MOVEMENT WITH CONTROL UNLOCK
function performTween(position, newPosition, duration, enableFlyControls = true){
    var tween = new TWEEN.Tween(position)
                .to(newPosition, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(function() {
                    flyControls.enabled = false;
                })
                .onComplete(function() {
                    flyControls.enabled = enableFlyControls;
                }).start();
}