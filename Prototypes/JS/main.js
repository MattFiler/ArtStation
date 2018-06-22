//DEFINE LOD LEVELS
var LOD_HIGH_DETAIL = 0;
var LOD_MEDIUM_DETAIL = 1;
var LOD_LOW_DETAIL = 2;

//DEFINE STATES
var IN_WORLDVIEW = 0;
var IN_ENVIRONMENT = 1;

//DEFINE LOCATION DATA
var LOCATION = [];
var VIDEO = [];
var LOCATION_MESHES = [];
var WORLDVIEW_POSITION = [new THREE.Vector3(400,2000,0), new THREE.Vector3(-Math.PI/2,0,0)];
var STATE = IN_WORLDVIEW;

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

//CREATE LOCATIONS
createLocation(
    "st_thomas_head",
    new THREE.Vector3(0,0,0), 
    new THREE.Vector3(-44.1, -35.46, 106.15), 
    new THREE.Vector3(-0.2258, -0.3901, -0.0520));
createLocation(
    "field",
    new THREE.Vector3(800,-50,-400),
    new THREE.Vector3(751.3, -50.5, -316.5), 
    new THREE.Vector3(-0.1809, -0.5722, -0.1113));

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

        if (location.LOD != lod) {
            //SETUP SCENE PARAMETERS
            GLTF_File.scene.position.x = location.WorldSpawn.x;
            GLTF_File.scene.position.y = location.WorldSpawn.y;
            GLTF_File.scene.position.z = location.WorldSpawn.z;
            GLTF_File.scene.name = "ARTSTATION_EnvironmentScene";

            //REMOVE OTHER LODS AND ADD CURRENT
            unloadLocation(location);
            scene.add(GLTF_File.scene);

            //SAVE UUID AND LOD
            location.UUID = GLTF_File.scene.uuid;
            location.LOD = lod;

            console.log("@loadLocation\nAdding: " + location.Name + " LOD " + location.LOD);
        }
    });
}

//UNLOAD LOCATION FROM SCENE BY UUID
function unloadLocation(location) {
    try {
        scene.traverse((node) => {       
            if (node.uuid == location.UUID) {
                scene.remove(node);
                console.log("@unloadLocation\nRemoving: " + location.Name + " LOD " + location.LOD);
            }
        });
    } catch { }
}

//CREATE LOCATION
function createLocation(name, worldSpawn, cameraStartPos, cameraStartRot) {
    var location_data = {
        Name: name,
        WorldSpawn: worldSpawn, 
        CameraStartPos: cameraStartPos,
        CameraStartRot: cameraStartRot,
        UUID: "X",
        LOD: "X"
    };
    LOCATION.push(location_data);
}

//LOAD WORLD VIEW
function loadWorldView() {
    //SET STATE
    STATE = IN_WORLDVIEW;
    console.log("State transition to: " + STATE);

    //LOAD LOCATIONS IN LOW LOD
    for (var i=0; i < LOCATION.length; i++) {
        loadLocation(LOCATION[i], LOD_LOW_DETAIL);
    }
}

//MOVE TO LOCATION ON CLICK
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
$(document).on("click",function(event) {
    if (STATE == IN_WORLDVIEW) {
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
                    //UNLOAD LOW LOD MODEL, LOAD HIGH LOD MODEL
                    unloadLocation(LOCATION[i]);
                    loadLocation(LOCATION[i], LOD_MEDIUM_DETAIL);

                    //MOVE TO LOCATION
                    performCameraTween(camera.position, LOCATION[i].CameraStartPos, 5000);
                    performCameraTween(camera.rotation, LOCATION[i].CameraStartRot, 5000);

                    //SET STATE
                    STATE = IN_ENVIRONMENT;
                    console.log("State transition to: " + STATE);
                }
            }
        }
    }
});

//MOVE BACK TO "WORLD VIEW" ON PRESS OF KEY (ENTER)
$(document).keypress(function(e) {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if(keycode == '13'){
        loadWorldView();
        performCameraTween(camera.position, WORLDVIEW_POSITION[0], 5000, false);
        performCameraTween(camera.rotation, WORLDVIEW_POSITION[1], 5000, false);   
    }
});

//SPAWN ALL VIDEOS IN WORLD
function spawnAllVideos() {
    createVideo(new THREE.Vector3(0,0,0), "field", "edited");
}

//CREATE A VIDEO IN WORLD
function createVideo(position, location, videoName) {
    //CREATE VIDEO ELEMENT
    var video_element = document.createElement("video");
    video_element.src = "ASSETS/"+location+"/Videos/"+videoName+".mp4";
    video_element.id = location+"_"+videoName;
    video_element.autoplay = true;
    video_element.loop = true;
    video_element.volume = 0;
    document.body.appendChild(video_element);

    //CREATE VIDEO MESH
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

    //GET VIDEO POSITION DATA
    //API/gps_parser.php?location=field&srt=edited
    var video_position_data = [];
    var video_position_data_path = "API/gps_parser.php?location=" + location + "&srt=" + videoName;
    $.getJSON(video_position_data_path, function(data) {
        $.each(data, function(key, val) {
            video_position_data.push(val);
        });
    });

    //ADD VIDEO TO GLOBAL VIDEO ARRAY
    var video_data = {
        Name: videoName,
        ElementID: location+"_"+videoName,
        Location: location, 
        UUID: video_plane_mesh.uuid,
        PositionArray: video_position_data
    };
    VIDEO.push(video_data);
    var video_index = VIDEO.length - 1;

    //MOVE VIDEO FROM GPS
    moveVideoFromGPS(video_index);
}

//MOVE VIDEO ON TIME UPDATE FROM GPS DATA (WIP!!)
function moveVideoFromGPS(video_index) {
    var major_time_milestone = 0;
    var previous_acted_milestone = -1;
    $("#"+VIDEO[video_index].ElementID).on("timeupdate", function(event){
        major_time_milestone = Math.floor(this.currentTime);
        if (major_time_milestone != previous_acted_milestone) {
            previous_acted_milestone = major_time_milestone;
            try {
                scene.traverse((node) => {       
                    if (node.uuid == VIDEO[video_index].UUID) {
                        var new_position = new THREE.Vector3(
                            VIDEO[video_index].PositionArray[major_time_milestone][0], 
                            VIDEO[video_index].PositionArray[major_time_milestone][3], 
                            VIDEO[video_index].PositionArray[major_time_milestone][1]);

                        node.position.x = new_position.x;
                        node.position.y = new_position.y;
                        node.position.z = new_position.z;

                        //var tween = new TWEEN.Tween(node.position).to(new_position, 1000).start();
                    }
                });
            } catch { }
        }
    });
}

//PERFORM SMOOTH CAMERA MOVEMENT WITH CONTROL UNLOCK
function performCameraTween(position, newPosition, duration, enableFlyControls = true){
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