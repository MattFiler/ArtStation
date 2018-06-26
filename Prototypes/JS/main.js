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

//RESIZE CANVAS WITH WINDOW
window.addEventListener('resize', resizeCanvas, false);

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

//SETUP LOADING MANAGER
var loading_manager = new THREE.LoadingManager();

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
var camera_controls = new THREE.FirstPersonControls(camera);
camera_controls.movementSpeed = 5;
camera_controls.lookSpeed = 0.05;
camera_controls.domElement = document.getElementById("ARTSTATION_Canvas");
camera_controls.autoForward = false;
camera_controls.enabled = false;

//AXES HELPER (DEBUG ONLY)
//var axesHelper = new THREE.AxesHelper(50);
//scene.add(axesHelper);

//CREATE LOCATIONS
createLocation(
    "st_thomas_head",
    new THREE.Vector3(0,0,0), 
    new THREE.Vector3(-44.1, -35.46, 106.15), 
    new THREE.Vector3(-0.16535290788614734, -0.3430805236076698, -0.05607670541902744),
    new THREE.Vector3(-10.461031678163152,-50.96079960879177,13.262191210414827));
createLocation(
    "field",
    new THREE.Vector3(800,-50,-400),
    new THREE.Vector3(751.3, -50.5, -316.5), 
    new THREE.Vector3(-0.1621988334633824, -0.5794115644192293, -0.08935749132270666),
    new THREE.Vector3(806,-64,-399));

//LOAD ALL LOCATION MESHES
loadAllLocations();

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

//CONTROLS TEST CUBE
var cube_geo = new THREE.CubeGeometry(5, 5, 5);
var cube_mat = new THREE.MeshLambertMaterial({color: 0xffffff, wireframe: true, transparent: true});
var cube_mesh = new THREE.Mesh(cube_geo, cube_mat);
//scene.add(cube_mesh); //Enable this to see where the camera is looking at.

//RENDER LOOP
requestAnimationFrame(render);
var clock = new THREE.Clock();
function render() {
    renderer.render(scene, camera);
    camera_controls.update(clock.getDelta());
    TWEEN.update();

    //DEBUG ONLY
    cube_mesh.position.x = camera_controls.target.x;
    cube_mesh.position.y = camera_controls.target.y;
    cube_mesh.position.z = camera_controls.target.z;

    requestAnimationFrame(render);
}

//LOADING BAR
loading_manager.onProgress = function ( item, loaded, total ) {
    var percent = loaded / total * 100;
    $("#ARTSTATION_DynamicProgressStatus").text(Math.round(percent) + "%");
    if (loaded == total) {
        $("#ARTSTATION_LoadScreen").fadeOut();
    }
};

//LOAD ALL LOCATIONS
function loadAllLocations() {
    //Ideally some kind of device test will be carried out here to determine if LOD_HIGH_DETAIL is loaded.
    //Perhaps LOD_LOW_DETAIL is upped by +1 to load MEDIUM, and MEDIUM to load HIGH?
    for (var i=0; i < LOCATION.length; i++) {
        loadLocation(LOCATION[i], LOD_LOW_DETAIL, true); //by default, low LOD is visible on boot.
        loadLocation(LOCATION[i], LOD_MEDIUM_DETAIL);
        //loadLocation(LOCATION[i], LOD_HIGH_DETAIL);
    }
}

//LOAD LOCATION
function loadLocation(location, lod, shouldBeVisibleImmediately = false) {
    //IMPORT MODEL
    var GLTF_Loader = new THREE.GLTFLoader(loading_manager);
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
            GLTF_File.scene.visible = shouldBeVisibleImmediately;

            //SAVE UUID AND LOD
            location.UUID[lod] = GLTF_File.scene.uuid;
            if (shouldBeVisibleImmediately) {
                location.CurrentLOD = lod;
            }

            //ADD TO SCENE
            scene.add(GLTF_File.scene);

            console.log("@loadLocation\nAdding: " + location.Name + " LOD " + lod + ", visible="+shouldBeVisibleImmediately);
        }
    });
}

//SWAP TO NEW LOD
function swapLocationLOD(location, newLOD) {
    if (location.CurrentLOD != newLOD) {
        try {
            scene.traverse((node) => {       
                if (node.uuid == location.UUID[location.CurrentLOD]) {
                    node.visible = false;
                }
                if (node.uuid == location.UUID[newLOD]) {
                    node.visible = true;
                }
            });
        } catch { }
        location.CurrentLOD = newLOD;
        console.log("@swapLocationLOD\nSwapped to LOD " + newLOD + " for " + location.Name)
    }
}

//CREATE LOCATION
function createLocation(name, worldSpawn, cameraStartPos, cameraStartRot, cameraStartTarget) {
    var location_data = {
        Name: name,
        WorldSpawn: worldSpawn, 
        CameraStartPos: cameraStartPos,
        CameraStartRot: cameraStartRot,
        CameraStartTarget: cameraStartTarget,
        UUID: {0: "UNUSED", 1: "UNUSED", 2: "UNUSED"}, //UUID relative to LOD
        CurrentLOD: "UNUSED"
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
        swapLocationLOD(LOCATION[i], LOD_LOW_DETAIL);
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
                    swapLocationLOD(LOCATION[i], LOD_MEDIUM_DETAIL);

                    //MOVE TO LOCATION
                    performCameraTween(camera.position, LOCATION[i].CameraStartPos, 5000);
                    performCameraTween(camera.rotation, LOCATION[i].CameraStartRot, 5000);

                    //PLAY VIDEOS IN LOCATION (WIP!!)
                    var video_player = document.getElementById(VIDEO[0].ElementID); 
                    video_player.play(); 

                    //SET CAMERA TARGET
                    camera_controls.target.x = LOCATION[i].CameraStartTarget.x;
                    camera_controls.target.y = LOCATION[i].CameraStartTarget.y;
                    camera_controls.target.z = LOCATION[i].CameraStartTarget.z;
                    camera_controls.hasJustMovedToEnvironment = true;
                    console.log(camera_controls.target);

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
    video_element.muted = true;
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
    var video_position_data = [];
    var video_position_data_path = "API/gps_parser.php?location=" + location + "&srt=" + videoName; //REMOTE
    //var video_position_data_path = "API/gps_parser.json"; //LOCAL
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
                            VIDEO[video_index].PositionArray[major_time_milestone+1][0], 
                            VIDEO[video_index].PositionArray[major_time_milestone+1][3], 
                            VIDEO[video_index].PositionArray[major_time_milestone+1][1]);

                        //node.position.x = new_position.x;
                        //node.position.y = new_position.y;
                        //node.position.z = new_position.z;

                        //http://dotnetfollower.com/wordpress/2011/08/javascript-how-to-convert-latitude-and-longitude-to-mercator-coordinates/
                        function LatLonToMercator(lat, lon) {
                            var rMajor = 6378137;
                            var shift  = Math.PI * rMajor;
                            var z      = lon * shift / 180;
                            var x      = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
                            x = x * shift / 180;
                         
                            return {'Z': z, 'X': x};
                        }

                        var converted_coords = LatLonToMercator(new_position.x, new_position.z);

                        var NEW_POSITION = new THREE.Vector3(converted_coords.X, new_position.y, converted_coords.Z);
                        var tween = new TWEEN.Tween(node.position).to(NEW_POSITION, 1000).start();
                    }
                });
            } catch { }
        }
    });
}

//PERFORM SMOOTH CAMERA MOVEMENT WITH CONTROL UNLOCK
function performCameraTween(position, newPosition, duration, enablecamera_controls = true){
    var tween = new TWEEN.Tween(position)
                .to(newPosition, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(function() {
                    camera_controls.enabled = false;
                })
                .onComplete(function() {
                    camera_controls.enabled = enablecamera_controls;
                }).start();
}

//RESIZE CANVAS ON WINDOW RESIZE
function resizeCanvas() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

//DEBUG - MOVE CAMERA TO VIDEO PLANE (WIP!!)
$(".DEBUG_CAMERA_BUTTON").on("click",function(event) { 
    console.log("Moving camera to video plane...");

    var video_player = document.getElementById(VIDEO[0].ElementID); 
    video_player.play(); 

    camera.position.x = -4663770.592158944;
    camera.position.y = 36.794581409249375;
    camera.position.z = -313632.4532830912;
    camera.rotation.x = -0.06993838069214417;
    camera.rotation.y = -0.2952724632887186;
    camera.rotation.z = -0.020382531278762522;
    camera_controls.enabled = true;

    var geometry = new THREE.Geometry();
    for (var i=0; i<60; i++) {
        try {
            scene.traverse((node) => {       
                if (node.uuid == VIDEO[0].UUID) {
                    var new_position = new THREE.Vector3(
                        VIDEO[0].PositionArray[i][0], 
                        VIDEO[0].PositionArray[i][3], 
                        VIDEO[0].PositionArray[i][1]);

                    function LatLonToMercator(lat, lon) {
                        var rMajor = 6378137;
                        var shift  = Math.PI * rMajor;
                        var z      = lon * shift / 180;
                        var x      = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
                        x = x * shift / 180;
                     
                        return {'Z': z, 'X': x};
                    }

                    var converted_coords = LatLonToMercator(new_position.x, new_position.z);

                    var NEW_POSITION = new THREE.Vector3(converted_coords.X, new_position.y, converted_coords.Z);
                    geometry.vertices.push(NEW_POSITION);
                }
            });
        } catch { }
    }
    var material = new THREE.LineBasicMaterial({color : 0xff0000});
    var line = new THREE.Line(geometry, material);
    scene.add(line);
});