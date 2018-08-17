/*
	ARTSTATION
	Created by Matt Filer
*/

function ARTSTATION(THIS_REGION) {
	//SHOW CONTROLS MODAL
	$("#ARTSTATION_ControlPanel").modal("show");

	/*
		--
		SETUP
		--
	*/

	//DEFINE SETTINGS
	var HIDE_MAP_WHEN_TRACKING_VIDEO = false;
	var USE_CESIUM = false;
	var INFO_POPUP_IS_HIDDEN = false;
	var NUMBER_OF_LOADED_LOCATIONS = 0;
	var DEFAULT_CAMERA_OFFSET_DESKTOP = 30;
	var DEFAULT_CAMERA_OFFSET_MOBILE = 50;

	//DEFINE DATA STORES
	var VIDEO = [];
	var LOCATION = [];
	var LOCATION_INFO = [];
	var REGION_INFO = [];
	var DOLLY_COUNTER = [0,0];
	var VIDEO_DOLLY_COUNTER = [0,0];
	var CAMERA_SAVE = null; //This is set after defining viewer
	var WORLD_VIEW_MAP = new THREE.Group();
	WORLD_VIEW_MAP.name = "ARTSTATION_WorldViewMap";
	var MAP_TILES = [{x: 0, y: 0}];
	var NUMBER_OF_LOCATIONS = 0; //Set upon loading JSON

	//DEFINE WORLD STATES
	var IN_WORLDVIEW = 0; //Using slow drag to look around controls
	var IN_ENVIRONMENT = 1; //Using double click to move controls
	var IS_TRACKING_VIDEO = 2; //Using camera locked to video plane
	var WORLD_STATE = null;
	var CAN_CLICK_ON_MARKERS = true;

	//DEFINE UI STATES
	var UI_SHOW_ENVIRONMENT = 0;
	var UI_HIDE_ENVIRONMENT = 1;
	var UI_SHOW_VIDEO = 2;
	var UI_HIDE_VIDEO = 3;
	var UI_SHOW_WORLDVIEW = 4;
	var UI_HIDE_WORLDVIEW = 5;
	var UI_RESET = 6;

	//DEFINE MAP DETAIL LEVELS (tile density)
	//These will also need to be updated in "createMapAround" if they are modified!
	var MAP_DETAIL_HIGH = 18; //Environment View
	var MAP_DETAIL_MEDIUM = 16; //Currently Unused
	var MAP_DETAIL_LOW = 14; //World View

	//DEFINE MAP QUALITY LEVELS (tile resolution)
	var MAP_QUALITY_EXTRA = 3;
	var MAP_QUALITY_HIGH = 2;
	var MAP_QUALITY_MEDIUM = 1.3;
	var MAP_QUALITY_STANDARD = 0;

	//DEFINE MAP TYPE
	var MAP_TYPE = {0: "osm-intl"};

	//DEFINE POTREE VIEWER
	window.viewer = new Potree.Viewer(document.getElementById("potree_render_area"), {
		useDefaultRenderLoop: false
	});

	//CONFIGURE POTREE VIEWER PER DEVICE
	var device = new MobileDetect(window.navigator.userAgent);
	var OPTIMISATION_PointBudget = 1000000;
	var OPTIMISATION_MinNodeSize = 100;
	var OPTIMISATION_UseHQ = true;
	if (device.mobile() != null) {
		//Mobile device
		OPTIMISATION_MinNodeSize = 200;
		OPTIMISATION_UseHQ = false;
		OPTIMISATION_PointBudget = 100000; 
	}
	if (device.mobileGrade() != "A") {
		//Device is not A-Grade by jQuery standards
		OPTIMISATION_MinNodeSize = 300;
		OPTIMISATION_UseHQ = false;
		OPTIMISATION_PointBudget = 50000; 
	}
	viewer.setFOV(60);
	viewer.setPointBudget(OPTIMISATION_PointBudget); 
	viewer.setEDLEnabled(false);
	viewer.setBackground(null); 
	viewer.loadSettingsFromURL();
	viewer.useHQ = OPTIMISATION_UseHQ;
	viewer.setMinNodeSize(OPTIMISATION_MinNodeSize);
	console.log("Optimisation result:\nPOINT BUDGET - " + OPTIMISATION_PointBudget + "\nMIN NODE SIZE - " + OPTIMISATION_MinNodeSize + "\nSHOULD USE HQ - " + OPTIMISATION_UseHQ);

	//Instanciate camera saving
	CAMERA_SAVE = viewer.scene.getActiveCamera();
	//console.log(CAMERA_SAVE);

	//UPDATE CONTROL LIST
	if (device.mobile() != null) {
		//Mobile
		$(".ARTSTATION_DeviceControls").html("<li>Touch on an environment to enter it.</li><li>Touch within an environment to move.</li><li>Touch and drag to rotate camera.</li><li>Zoom in/out with the buttons in the bottom left.</li><li>Exit an environment with the button in the bottom right.</li>");
	}
	else
	{
		//Desktop
		$(".ARTSTATION_DeviceControls").html("<li><b>Environments</b></li><ul><li>Click to enter from world view.</li><li>Double click to move focus.</li><li>Use left mouse down to rotate camera.</li><li>Zoom in/out with the buttons in the bottom left.</li><li>Exit with the button in the bottom right.</li></ul><li><b>Videos</b></li><ul><li>Click a video marker to play.</li><li>Play/pause with the buttons in the bottom left.</li><li>Exit with the button in the bottom right.</li></ul>");
	}

	if (USE_CESIUM) {
		//DEFINE CESIUM VIEWER & OS IMAGE PROVIDER
		var imageryProvider = new Cesium.BingMapsImageryProvider({
            url : 'https://dev.virtualearth.net',
            mapStyle : Cesium.BingMapsStyle.ORDNANCE_SURVEY,
            culture:"zh-Hans",
            key:"Ao1f3-REClmcsxcvjPSHCX2Nu2dqScXYKf9YE4R-yd4WGEC_iOQigjGHkd--WNst"
        });
		window.cesiumViewer = new Cesium.Viewer('cesiumContainer', {
			useDefaultRenderLoop: false,
			animation: false,
			baseLayerPicker : false,
			fullscreenButton: false, 
			geocoder: false,
			homeButton: false,
			infoBox: false,
			sceneModePicker: false,
			selectionIndicator: false,
			timeline: false,
			navigationHelpButton: false,
			imageryProvider: imageryProvider
		});

		//CONFIGURE CESIUM VIEWER
	    window.cesiumViewer.scene.fxaa = false;
	    window.cesiumViewer.scene.sunBloom = false;
	    window.cesiumViewer.scene.skyAtmosphere.show = false;
	    window.cesiumViewer.scene.fog.enabled = false;
	    window.cesiumViewer.shadows = false;
	    window.cesiumViewer.terrainShadows = false;
	    window.cesiumViewer.scene.shadowMap.enabled = false;
		let cp = new Cesium.Cartesian3(4303414.154026048, 552161.235598733, 4660771.704035539);
		cesiumViewer.camera.setView({
			destination : cp,
			orientation: {
				heading : 10, 
				pitch : -Cesium.Math.PI_OVER_TWO * 0.5, 
				roll : 0.0 
			}
		});
	}
	else
	{
		viewer.scene.getActiveCamera().far = 5000*1000*1000;
		viewer.setBackground("skybox");
	}

	//ENABLE DEMO PANEL
	/* viewer.loadGUI(() => {
		viewer.setLanguage('en');
		$("#menu_appearance").next().show();
		$("#menu_tools").next().show();
		//$("#menu_scene").next().show();
		//viewer.toggleSidebar();
	}); */

	//SET INITIAL STATE
	setState(IN_WORLDVIEW, false);
	StateChangeUI(UI_RESET);
	ToggleMarkerVisibility(false,false);
	loadRegionData();
	loadLocationsFromJson();

	/*
		--
		LOOP
		--
	*/

	//RENDER LOOP
	function loop(timestamp){
		requestAnimationFrame(loop);

		if (currentDevice == null) {
			currentDevice = new MobileDetect(window.navigator.userAgent)
		}

		viewer.update(viewer.clock.getDelta(), timestamp);

		viewer.render();

		if(window.toMap !== undefined && USE_CESIUM){

			{
				let camera = viewer.scene.getActiveCamera();

				let pPos		= new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorld);
				let pRight  = new THREE.Vector3(600, 0, 0).applyMatrix4(camera.matrixWorld);
				let pUp		 = new THREE.Vector3(0, 600, 0).applyMatrix4(camera.matrixWorld);
				let pTarget = viewer.scene.view.getPivot();

				/*
				console.log(pPos);
				console.log(pRight);
				console.log(pUp);
				console.log(pTarget);
				console.log("-----------------");
				*/

				let toCes = (pos) => {
					let xy = [pos.x, pos.y];
					let height = pos.z;
					let deg = toMap.forward(xy);
					let cPos = Cesium.Cartesian3.fromDegrees(...deg, height);

					return cPos;
				};

				let cPos = toCes(pPos);
				let cUpTarget = toCes(pUp);
				let cTarget = toCes(pTarget);

				let cDir = Cesium.Cartesian3.subtract(cTarget, cPos, new Cesium.Cartesian3());
				let cUp = Cesium.Cartesian3.subtract(cUpTarget, cPos, new Cesium.Cartesian3());

				cDir = Cesium.Cartesian3.normalize(cDir, new Cesium.Cartesian3());
				cUp = Cesium.Cartesian3.normalize(cUp, new Cesium.Cartesian3());

				cesiumViewer.camera.setView({
					destination : cPos,
					orientation : {
						direction : cDir,
						up : cUp
					}
				});
				
			}

			let aspect = viewer.scene.getActiveCamera().aspect;
			if(aspect < 1){
				let fovy = Math.PI * (viewer.scene.getActiveCamera().fov / 180);
				cesiumViewer.camera.frustum.fov = fovy;
			}else{
				let fovy = Math.PI * (viewer.scene.getActiveCamera().fov / 180);
				let fovx = Math.atan(Math.tan(0.5 * fovy) * aspect) * 2
				cesiumViewer.camera.frustum.fov = fovx;
			}
			
		}

		if (USE_CESIUM) {
			cesiumViewer.render();
		}
	}
	requestAnimationFrame(loop);

	/*
		--
		REGION
		--
	*/

	//LOAD ALL REGIONS FROM JSON FILE
	function loadRegionData() {
		var region_data = [];
	    var regions_json_path = "http://assets.artstation.mattfiler.co.uk/CONFIGS/regions.json"; 
	    $.getJSON(regions_json_path, function(data) {
	        $.each(data, function(key, val) {
	            region_data.push(val); //Add to array
	        });
	    }).done(function(json) {
	    	//Load data for this region
			region_data = region_data[0];
			for (var i=0;i<region_data.length;i++) {
				if (i == THIS_REGION) {
					REGION_INFO.push(region_data[i]);
				}
			}
			REGION_INFO = REGION_INFO[0];

			//Apply region data to popup title/desc
	    	$(".ARTSTATION_RegionName").text(REGION_INFO.name);
	    	$(".ARTSTATION_RegionDesc").text(REGION_INFO.description);

	    	//Add region name to page title
			$(".ARTSTATION_RegionTitle").text(REGION_INFO.name);
		});
	}

	/*
		--
		LOCATION
		--
	*/

	//LOAD ALL LOCATIONS FROM JSON FILE
	function loadLocationsFromJson() {
		var location_data = [];
	    var locations_json_path = "http://assets.artstation.mattfiler.co.uk/CONFIGS/locations.json"; 
	    $.getJSON(locations_json_path, function(data) {
	        $.each(data, function(key, val) {
	            location_data.push(val); //Add to array
	        });
	    }).done(function(json) {
			location_data = location_data[0];
			//Update location count
			NUMBER_OF_LOCATIONS = location_data.length;
			for (var i=0;i<location_data.length;i++) {
				//Only load current region
				if (location_data[i].region != THIS_REGION) {
					continue;
				}

				//Add location
				loadLocation(
					location_data[i],
					function(locationData, locationIndex) { 
						//Add Videos (if they exist)
						if (locationData.videos) {
							for (var x=0;x<locationData.videos.length;x++) {
								var offset = locationData.videos[x].offset;
								createVideo(locationIndex, locationData.videos[x].filename, locationData.videos[x].title, offset[0], offset[1], offset[2]); 
							}
						}

						//Environment Info
						addEnvInfo(locationIndex, 
							locationData.name, 
							locationData.description, 
							locationData.key_points);

						//Generate World Web
						generateWorldWeb();

						//Reset view pitch
						viewer.scene.view.pitch = -0.7853981633974672;
					}
				);
			}
		});
	}

	//LOAD LOCATION POINTCLOUD INTO VIEWER
	function loadLocation(locationData, callback=function(){}) {
		if (locationData.is_pointcloud) {
	        Potree.loadPointCloud("http://assets.artstation.mattfiler.co.uk/POINTCLOUDS/"+locationData.filename+"/cloud.js", locationData.filename, e => {
        		//Position and configure pointcloud and add to scene
                let pointcloud = e.pointcloud;
                let material = pointcloud.material;
                pointcloud.position.z = locationData.z_offset;
                viewer.scene.addPointCloud(pointcloud);
                material.pointColorType = Potree.PointColorType.RGB;
                material.size = 1;
                material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
                material.shape = Potree.PointShape.CIRCLE;
                viewer.fitToScreen();

			    //Find centre of pointcloud for annotation position 
			    pointcloud.updateMatrixWorld();
				let box = pointcloud.pcoGeometry.tightBoundingBox.clone();
				box.applyMatrix4(pointcloud.matrixWorld);
				let center = box.getCenter();

                //Compile location data and save to global array
			    var location_data = {
			        Name: locationData.name,
			        FileName: locationData.filename,
			        UUID: pointcloud.uuid,
			        Z_Offset: locationData.z_offset,
			        Position: center,
			        LocationGPS: ConvertToCoordinates(center.x, center.y)
			    };
			    var location_data_length = LOCATION.push(location_data);

			    //Generate maps around location
			    if (!USE_CESIUM) {
					createMapForLocation(location_data_length - 1);
			    }

			    //Add location name annotation
			    {
					let locationAnnotation = new Potree.Annotation({
						position: center,
						title: locationData.name
					});
					viewer.scene.annotations.add(locationAnnotation);
				}

				Potree.measureTimings = true;
				
				//Zone 30U covers most of England and Wales so we should be fine with this - geoutm.js can always calculate for us.
				let pointcloudProjection = "+proj=utm +zone=30 +ellps=GRS80 +datum=NAD83 +units=m +no_defs";
				let mapProjection = proj4.defs("WGS84");

				window.toMap = proj4(pointcloudProjection, mapProjection);
				window.toScene = proj4(mapProjection, pointcloudProjection);
				
				{
					let bb = viewer.getBoundingBox();

					let minWGS84 = proj4(pointcloudProjection, mapProjection, bb.min.toArray());
					let maxWGS84 = proj4(pointcloudProjection, mapProjection, bb.max.toArray());
				}

				//Run callback to load videos and add env data
				callback(locationData, location_data_length - 1);
	        });
	    }
	    else
	    {
            //Compile location data and save to global array
            var coords = ConvertToUTM(locationData.gps[0], locationData.gps[1]);
		    var location_data = {
		        Name: locationData.name,
			    FileName: null,
		        UUID: null,
		        Z_Offset: locationData.z_offset,
		        Position: new THREE.Vector3(coords[0], coords[1], locationData.z_offset),
			    LocationGPS: locationData.gps
		    };
		    var location_data_length = LOCATION.push(location_data);

		    //Generate map around location
			if (!USE_CESIUM) {
				createMapForLocation(location_data_length - 1);
			}

	    	//Add location name annotation
		    {
				let locationAnnotation = new Potree.Annotation({
					position: new THREE.Vector3(coords[0], coords[1], locationData.z_offset),
					title: locationData.name
				});
				locationAnnotation.addEventListener('click', event => {
					clickedEnvironmentMarker(location_data_length - 1); //On click show info popup
				});
				viewer.scene.annotations.add(locationAnnotation);
			}

			//Run callback to add env data
			callback(locationData, location_data_length - 1);
	    }
	}

	//ADD ENVIRONMENT INFO
	function addEnvInfo(locationIndex=999,title="Placeholder",subtitle="This location has supplied no information, contact the webmaster!",listItems=["No information.", "Please contact admin."]) {
		//Format the list for HTML
		var listCompile = "";
		for (var i=0;i<listItems.length;i++) {
			listCompile += "<li>"+listItems[i]+"</li>";
		}
		//Compile info
	    var location_info = {
	        Title: title,
	        Subtitle: subtitle,
	        List: listCompile
	    };
	    //Add to global array & save index
	    var location_info_index = LOCATION_INFO.push(location_info);
	    location_info_index -= 1;
	    LOCATION[locationIndex].LocationInfoIndex = location_info_index;
	}

	//POPULATE ENVIRONMENT INFO POPUP
	function populateEnvInfoPopup(locationIndex=999) {
		$(".modal-title").html(LOCATION_INFO[LOCATION[locationIndex].LocationInfoIndex].Title);
		$(".modal-body").html("<b>" + LOCATION_INFO[LOCATION[locationIndex].LocationInfoIndex].Subtitle + "</b><br><br>" + LOCATION_INFO[LOCATION[locationIndex].LocationInfoIndex].List);
	}

	//CLOSE INFO POPUP ON CLICK
	function hideInfoPopup() {
		if (WORLD_STATE == IN_ENVIRONMENT) {
			INFO_POPUP_IS_HIDDEN = true;
		}
	}

	//ENVIRONMENT MARKER CLICK EVENT
	function clickedEnvironmentMarker(location) {
		populateEnvInfoPopup(location);
		$("#ARTSTATION_ControlPanel").modal("show");
	}

	/*
		--
		VIDEO
		--
	*/

	//CREATE A VIDEO IN WORLD
	function createVideo(locationIndex, videoName, videoTitle, xOffset=0, yOffset=0, zOffset=0) {
	    //Create HTML video element to draw texture from
	    var video_element = document.createElement("video");
	    video_element.src = "http://assets.artstation.mattfiler.co.uk/VIDEOS/"+LOCATION[locationIndex].FileName+"/"+videoName;
	    if (device.mobile() == null) { video_element.src += ".mp4"; } else { video_element.src += "_mobile.mp4"; } //mobile/desktop video qualities
	    video_element.id = LOCATION[locationIndex].FileName+"_"+videoName;
	    video_element.autoplay = false;
	    video_element.loop = false;
	    video_element.volume = 1; //Only certain videos actually have an audio track, but force full volume for all anyways and let the Browser handle it.
	    video_element.muted = false;
	    video_element.width = window.innerWidth;
	    video_element.crossOrigin = 'anonymous'; //Cross-origin must be enabled to use subdomain
	    document.body.appendChild(video_element);

	    //Create Video/Camera parent object
		var video_parent = new THREE.Group();
		video_parent.name = "ARTSTATION_VideoTrackGroup";
		viewer.scene.scene.add(video_parent);

	    //Create the video plane mesh with HTML element texture, child of main parent
	    var video_plane = new THREE.PlaneGeometry(20, 12, 1, 1);
	    var video_elem = document.getElementById(LOCATION[locationIndex].FileName+"_"+videoName);
	    var video_texture = new THREE.VideoTexture(video_elem);
	    video_texture.minFilter = THREE.LinearFilter;
	    video_texture.magFilter = THREE.LinearFilter;
	    video_texture.format = THREE.RGBFormat;
	    var video_material = new THREE.MeshBasicMaterial({color: 0xffffff, map: video_texture, transparent: true, opacity: 0}); //opacity needs to be 0 here if fading is re-enabled
	    var video_plane_mesh = new THREE.Mesh(video_plane, video_material);
	    video_plane_mesh.material.side = THREE.DoubleSide;
	    video_plane_mesh.name = "ARTSTATION_VideoPlane"; 
	    video_plane_mesh.position.x = 0;
	    video_plane_mesh.position.y = 0;
	    video_plane_mesh.position.z = 0;
	    video_plane_mesh.rotation.y = Math.PI / 2;
	    video_plane_mesh.rotation.z = Math.PI / 2;
	    video_plane_mesh.visible = false; //Start off invisible, as we'll only see "markers" in the environment
	    video_parent.add(video_plane_mesh);

	    //Create tracking camera entity, child of video plane
	    var tracking_camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, Infinity); //Infinity is a placeholder
	    tracking_camera.position.x = 0;
	    tracking_camera.position.y = 0;
	    if (device.mobile() == null) { tracking_camera.position.z = DEFAULT_CAMERA_OFFSET_DESKTOP; } else { tracking_camera.position.z = DEFAULT_CAMERA_OFFSET_MOBILE; } //mobile/desktop video offsets
	    tracking_camera.name = "ARTSTATION_TrackingCamera";
	    video_plane_mesh.add(tracking_camera);

	    //Create camera transition entity to replace black screen
	    var transition_camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, Infinity); //Again, not actually infinite
	    tracking_camera.name = "ARTSTATION_TransitionCamera";
	    viewer.scene.scene.add(transition_camera);

	    //Setup cameras fov to potree default
		transition_camera.fov = viewer.scene.getActiveCamera().fov;
		tracking_camera.fov = viewer.scene.getActiveCamera().fov;

		//Create sprite video marker
		var sprite_material = new THREE.SpriteMaterial({map: video_texture, color: 0xffffff});
		var marker_sprite = new THREE.Sprite(sprite_material);
		marker_sprite.scale.set(17,11,0);
        marker_sprite.name = "ARTSTATION_VideoMarker";
		viewer.scene.scene.add(marker_sprite);

	    //Grab positioning data and save to array
	    var video_position_data = [];
	    var video_position_data_path = "API/gps_parser.php?location=" + LOCATION[locationIndex].FileName + "&video=" + videoName; 
	    $.getJSON(video_position_data_path, function(data) {
	        $.each(data, function(key, val) {
	            video_position_data.push(val); //Add to array
	        });
	    });

	    //Compile video data
	    var video_data = {
	        Name: videoName,
	        ElementID: LOCATION[locationIndex].FileName+"_"+videoName,
	        LocationDataIndex: locationIndex, 
	        VideoMesh: video_plane_mesh,
	        ImportedTrackData: video_position_data,
	        LockCamera: false,
	        VideoMarker: marker_sprite,
	        VideoCamera: tracking_camera,
	        VideoParent: video_parent, //should really start using this and depreciate VideoMesh.
	        X_Offset: xOffset,
	        Y_Offset: yOffset,
	        Z_Offset: zOffset,
	        TransitionCamera: transition_camera,
	        VideoTitle: videoTitle,
	        LocationInfoIndex: null //set when information is added
	    };
	    //Add to global video array
	    var video_id = VIDEO.push(video_data);
	    video_id -= 1;

	    //Enable video position movement
	    moveVideoFromGPS(video_id);
	}

	//MOVE VIDEO ON TIME UPDATE FROM GPS DATA
	function moveVideoFromGPS(video_index) {
	    var camera_is_locked = false;
	    var run_count = 0;
	    var last_time_run = 0;
	    var current_time_run = 0;
	    var was_fixed = false;
	    var fixed_time = 0;
		var controls = viewer.getControls(viewer.scene.view.navigationMode);

	    $("#"+VIDEO[video_index].ElementID).on("timeupdate", function(event){
	    	//Update UI
	    	var currentSeconds = Math.floor(this.currentTime - Math.floor(this.currentTime / 60) * 60);
	    	var durationSeconds = Math.floor(this.duration - Math.floor(this.duration / 60) * 60);
	    	if (currentSeconds.toString().length == 1) { currentSeconds = "0" + currentSeconds; }
	    	if (durationSeconds.toString().length == 1) { durationSeconds = "0" + durationSeconds; }
	    	$(".ARTSTATION_CurrentVideoTime").text(Math.floor(this.currentTime / 60) + ":" + currentSeconds);
	    	$(".ARTSTATION_FullVideoTime").text(Math.floor(this.duration / 60) + ":" + durationSeconds);
	    	$(".ARTSTATION_VideoProgressBar").width((this.currentTime/this.duration*100)+"%");

	    	//Reset counters on video loop
	        if (Math.floor(this.currentTime) == 0) {
	        	run_count = 0;
			    last_time_run = 0;
			    current_time_run = 0;
	        }

	        //Update position if new data is available
	        var should_update = false;
	        var update_step_up = 0;
	        var time_adjustment = 0;
	        try {
		        if (VIDEO[video_index].ImportedTrackData[run_count][11] == "CSV") {
		        	time_adjustment = 500; //Time adjustment for Litchi data delay
		        }
	        }
	        catch(err) {
	        	//console.log(err);
	        }
	        for (var i=0; i<20; i++) {
	        	try {
		        	if (Math.floor(this.currentTime*1000 + time_adjustment) > VIDEO[video_index].ImportedTrackData[run_count+i][4] - VIDEO[video_index].ImportedTrackData[0][4]) {
		        		should_update = true;
		        		update_step_up = i;
		        	}
		        	else
		        	{
		        		break;
		        	}
		        }
		        catch(err) {
		        	//Video has likely ended.
		        	should_update = false;
		        }
	        }
	        if (should_update && WORLD_STATE == IS_TRACKING_VIDEO) {
	        	run_count += update_step_up;
	        	current_time_run = this.currentTime*1000;

                //Compute lat,lon to X,Y using UTM
                var coords = ConvertToUTM(VIDEO[video_index].ImportedTrackData[run_count][0], VIDEO[video_index].ImportedTrackData[run_count][1]);
                //Save new position to tween to
                var VIDEO_NEW_POSITION = new THREE.Vector3(
                	coords[0] + VIDEO[video_index].X_Offset, //X (lat)
                	coords[1] + VIDEO[video_index].Y_Offset, //Y (lon)
                	parseFloat(VIDEO[video_index].ImportedTrackData[run_count][3]) + LOCATION[VIDEO[video_index].LocationDataIndex].Z_Offset - VIDEO[video_index].Z_Offset); //Z (altitude + offset)
                //Save new rotations to tween to
                var GIMBAL_ROTATION = new THREE.Euler(
                	VIDEO[video_index].ImportedTrackData[run_count][8] * Math.PI / 180, //Pitch
                	VIDEO[video_index].ImportedTrackData[run_count][10] * Math.PI / 180, //Yaw
                	VIDEO[video_index].ImportedTrackData[run_count][9] * Math.PI / 180, //Roll
                	'XYZ');
                //Compute time to tween
                var TWEEN_TIME = current_time_run - last_time_run;
                if ((VIDEO[video_index].VideoParent.rotation.z - GIMBAL_ROTATION.y < -3 ||
                	VIDEO[video_index].VideoParent.rotation.z - GIMBAL_ROTATION.y > 3) &&
                	run_count != update_step_up) {
                	GIMBAL_ROTATION.y = VIDEO[video_index].VideoParent.rotation.z * -1;
                	TWEEN_TIME = 0;
                }

                //Perform tweens
            	var VIDEO_TWEEN_POSITION = new TWEEN.Tween(VIDEO[video_index].VideoParent.position).to(VIDEO_NEW_POSITION, TWEEN_TIME);
            	var VIDEO_TWEEN_ROTATION = new TWEEN.Tween(VIDEO[video_index].VideoMesh.rotation).to({x: GIMBAL_ROTATION.x, y: 0, z: 0}, TWEEN_TIME);
            	var PARENT_TWEEN_ROTATION = new TWEEN.Tween(VIDEO[video_index].VideoParent.rotation).to({x: 0, y: 0, z: GIMBAL_ROTATION.y}, TWEEN_TIME);
            	VIDEO_TWEEN_POSITION.onStart(() => {
            		VIDEO_TWEEN_ROTATION.start();
            		PARENT_TWEEN_ROTATION.start();
					
					$(".annotation").hide();
            		controls.isTransitioning = true;
            		camera_is_locked = true;
				});
				VIDEO_TWEEN_POSITION.onComplete(() => {
					//If exit was requested, perform
					if (!VIDEO[video_index].LockCamera && camera_is_locked) {
						stopVideo(video_index);
						controls.isTransitioning = false;
						camera_is_locked = false;
						TRACKING_CAMERA_OBJECT = null;
						TRACKING_CAMERA_IS_ENABLED = false;
					}
				});
            	VIDEO_TWEEN_POSITION.start();

            	//Update counters
            	run_count++;
        		last_time_run = this.currentTime*1000;
            }
	    });
	    $("#"+VIDEO[video_index].ElementID).on('ended',function(){
	    	//Video has ended, get us out of it
			if (VIDEO[video_index].LockCamera && camera_is_locked) {
				controls.isTransitioning = false;
				exitCurrentVideo();
			}
	    });
	}

	//PLAY VIDEO
	function playVideo(video_id, reset=true) {
		var video_player = document.getElementById(VIDEO[video_id].ElementID); 
		if (reset) {
			//Set title
			$(".ARTSTATION_VideoTitle").text(VIDEO[video_id].VideoTitle);
			//Playing video from the beginning
			EnterVideoTrackMode(video_id, true, function() {
				//Configure tracking camera
				VIDEO[video_id].LockCamera = true;
				TRACKING_CAMERA_OBJECT = VIDEO[video_id].VideoCamera;
				TRACKING_CAMERA_IS_ENABLED = true;
				setState(IS_TRACKING_VIDEO);

				//Reset video time and play
    			video_player.currentTime = 0;
	    		video_player.play(); 
			});
		}
		else
		{
			//Continuing video from pause
    		video_player.play(); 
		}
	}

	//STOP VIDEO
	function stopVideo(video_id) {
		var video_player = document.getElementById(VIDEO[video_id].ElementID); 
		video_player.pause();
		video_player.currentTime = 0;
	    VIDEO[video_id].VideoMesh.visible = false;
		ToggleMarkerVisibility(true, false);
	    if (device.mobile() == null) { VIDEO[video_id].VideoCamera.position.z = DEFAULT_CAMERA_OFFSET_DESKTOP; } else { VIDEO[video_id].VideoCamera.position.z = DEFAULT_CAMERA_OFFSET_MOBILE; } 
		VIDEO_DOLLY_COUNTER = [0,0]; 
	}

	//PAUSE VIDEO
	function pauseVideo(video_id) {
		var video_player = document.getElementById(VIDEO[video_id].ElementID); 
		video_player.pause();
	}

	//PLAY CURRENT VIDEO
	function playCurrentVideo() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				playVideo(i, false);
			}
		}
	}

	//PAUSE CURRENT VIDEO
	function pauseCurrentVideo() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				pauseVideo(i);
			}
		}
	}

	//EXIT CURRENT VIDEO
	function exitCurrentVideo() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				var current_video = i;
				EnterVideoTrackMode(i, false, function() {
					playVideo(current_video, false);
					var controls = viewer.getControls(viewer.scene.view.navigationMode);
					setState(IN_ENVIRONMENT);
					controls.isTransitioning = false;
					VIDEO[current_video].LockCamera = false;
					TRACKING_CAMERA_OBJECT = null;
					TRACKING_CAMERA_IS_ENABLED = false;
					$(".annotation").hide();
					stopVideo(current_video);
				});
			}
		}
	}

	//ENLARGE CURRENT VIDEO
	function enlargeCurrentVideo() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				var video_player = document.getElementById(VIDEO[i].ElementID); 
				if (video_player.requestFullscreen) {
					video_player.requestFullscreen();
				} else if (video_player.mozRequestFullScreen) {
					video_player.mozRequestFullScreen();
				} else if (video_player.webkitRequestFullscreen) {
					video_player.webkitRequestFullscreen();
				} else if (video_player.msRequestFullscreen) { 
					video_player.msRequestFullscreen();
				}
			}
		}
	}

	/*
		--
		UI INTERACTION
		--
	*/

	//HANDLE CLICK OR TOUCH
	$(document).on("click",function(event) {
		//Click event
		handleClickInput([event.clientX, event.clientY]);
	});
	$(document).on("touchstart", function(event){ 
		//Touch event
		handleClickInput([event.originalEvent.touches[0].pageX, event.originalEvent.touches[0].pageY]);
	});
	var mouse = new THREE.Vector2();
	var controls = viewer.getControls(viewer.scene.view.navigationMode);
	function handleClickInput(position) {
		//Move to environment depending on input location
		if (WORLD_STATE == IN_WORLDVIEW && !controls.isTransitioning) {
			//Get mouse/touch position
	        mouse.x = position[0];
	        mouse.y = position[1];
			controls.zoomToLocation(mouse, true, 1600, true, function() {
				if (controls.didClickEnvironment) {
					//Populate environment info popup & title
					for (var i=0; i<LOCATION.length; i++) {
						if (controls.clickedEnvironmentUUID == LOCATION[i].UUID) {
							populateEnvInfoPopup(i);
							$(".ARTSTATION_LocationTitle").text(LOCATION[i].Name);
						}
					}

					//Configure camera
		        	controls.worldViewCameraConfig = false;
					setState(IN_ENVIRONMENT);

					//Swap maps
					enterEnvMapMode(true);

					//Setup videos
					for (var i = 0; i < VIDEO.length; i++) {
						if (LOCATION[VIDEO[i].LocationDataIndex].UUID == controls.clickedEnvironmentUUID) {
							var marker_coords = ConvertToUTM(VIDEO[i].ImportedTrackData[0][0], VIDEO[i].ImportedTrackData[0][1]);
	                        var marker_position = new THREE.Vector3(marker_coords[0]+VIDEO[i].X_Offset, marker_coords[1]+VIDEO[i].Y_Offset, parseFloat(VIDEO[i].ImportedTrackData[0][3]) + LOCATION[VIDEO[i].LocationDataIndex].Z_Offset - VIDEO[i].Z_Offset);
	                        VIDEO[i].VideoMarker.position.x = marker_position.x;
	                        VIDEO[i].VideoMarker.position.y = marker_position.y;
	                        VIDEO[i].VideoMarker.position.z = marker_position.z;
							VIDEO[i].VideoMarker.visible = true;
        					new TWEEN.Tween(VIDEO[i].VideoMarker.material).to({opacity: 1}, 500).start();
						}
					}
				}
			});
			if (controls.didClickEnvironment) {
				//Fade out name annotation during transition
				$(".annotation").fadeOut(600);

				//Change UI state early
				StateChangeUI(UI_HIDE_WORLDVIEW);
			}
		}
		
		//Move to video if marker clicked on
		if (WORLD_STATE == IN_ENVIRONMENT && CAN_CLICK_ON_MARKERS) {
			//Get mouse/touch position
			mouse.x = ( position[0] / window.innerWidth ) * 2 - 1;
			mouse.y = - ( position[1] / window.innerHeight ) * 2 + 1;

			//Setup raycast
			var raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(mouse, viewer.scene.getActiveCamera());

			//Grab video markers we can interact with
			var video_planes = [];
			for (var i=0; i<viewer.scene.scene.children.length; i++) {
				if (viewer.scene.scene.children[i].name == "ARTSTATION_VideoMarker") {
					video_planes.push(viewer.scene.scene.children[i]);
				}
			}

			//Check to see if we hit a marker
			var intersects = raycaster.intersectObjects(video_planes);
			var video_id = null;
			for (var i=0; i<intersects.length; i++) {
				for (var x=0; x<VIDEO.length;x++) {
					if (VIDEO[x].VideoMarker.uuid == intersects[i].object.uuid) {
						if (VIDEO[x].LockCamera == false) {
							//We hit marker X which isn't already locked onto
							video_id = x;
						}
					}	
				}
			}

			//Play the video for the marker we hit
			if (video_id != null) {
				playVideo(video_id);
			}
		}
	}

	//MOVE BACK TO "WORLD VIEW"
	var controls = viewer.getControls(viewer.scene.view.navigationMode);
	function ReturnToWorldView() {
		if (WORLD_STATE == IN_ENVIRONMENT) {
			//Move camera to world view
			viewer.scene.view.pitch = -0.7853981633974672;
			viewer.fitToScreen(1, 2600);
			DOLLY_COUNTER = [0,0]; //Reset zoom limits

			//Fade out all video markers
			ToggleMarkerVisibility(false, true);

			//Swap maps
			enterEnvMapMode(false);

			//Fade annotations back in and configure controls for world view
			$(".annotation").fadeIn(600, "swing", function() { 
				setState(IN_WORLDVIEW); 
				controls.worldViewCameraConfig = true;
			});
		}
	}

	//DOLLY ZOOM IN
	var DOLLY_ZOOM_IN = null;
	function DollyZoomIn() {
		if (WORLD_STATE == IN_ENVIRONMENT) {
			DOLLY_ZOOM_IN = setInterval(function(){
				if (DOLLY_COUNTER[0] <= 50) {
					DOLLY_COUNTER[0]++;
					DOLLY_COUNTER[1]--;
					var controls = viewer.getControls(viewer.scene.view.navigationMode);
					controls.dollyCamera(0.4);
				}
			}, 50);
		}
	}

	//DOLLY ZOOM OUT
	var DOLLY_ZOOM_OUT = null;
	function DollyZoomOut() {
		if (WORLD_STATE == IN_ENVIRONMENT) {
			DOLLY_ZOOM_OUT = setInterval(function(){
				if (DOLLY_COUNTER[1] <= 15) {
					DOLLY_COUNTER[0]--;
					DOLLY_COUNTER[1]++;
					var controls = viewer.getControls(viewer.scene.view.navigationMode);
					controls.dollyCamera(-0.4);
				}
			}, 50);
		}
	}

	//STOP DOLLY ZOOM
	function StopDollyZoom() {
		clearInterval(DOLLY_ZOOM_IN);
		clearInterval(DOLLY_ZOOM_OUT);
	}

	//ZOOM IN TO CURRENT VIDEO
	var VIDEO_DOLLY_ZOOM_IN = null;
	function videoZoomIn() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				var video_id = i;
				VIDEO_DOLLY_ZOOM_IN = setInterval(function(){
					if (VIDEO_DOLLY_COUNTER[0] <= 70) {
						VIDEO_DOLLY_COUNTER[0]++;
						VIDEO_DOLLY_COUNTER[1]--;
						VIDEO[video_id].VideoCamera.position.z -= 0.1;
					}
				}, 1);
			}
		}
	}

	//ZOOM OUT TO CURRENT VIDEO
	var VIDEO_DOLLY_ZOOM_OUT = null;
	function videoZoomOut() {
		for (var i = 0; i < VIDEO.length; i++) {
			if (VIDEO[i].LockCamera == true) {
				var video_id = i;
				VIDEO_DOLLY_ZOOM_OUT = setInterval(function(){
					if (VIDEO_DOLLY_COUNTER[1] <= 35) {
						VIDEO_DOLLY_COUNTER[0]--;
						VIDEO_DOLLY_COUNTER[1]++;
						VIDEO[video_id].VideoCamera.position.z += 0.1;
					}
				}, 1);
			}
		}
	}

	//STOP DOLLY ZOOM
	function stopVideoZoom() {
		clearInterval(VIDEO_DOLLY_ZOOM_IN);
		clearInterval(VIDEO_DOLLY_ZOOM_OUT);
	}

	//DOLLY ZOOM IN
	$('.DollyZoomIn').on('touchstart', function(){
	    DollyZoomIn();
	});
	$('.DollyZoomIn').on('mousedown', function(){
	    DollyZoomIn();
	});
	$('.DollyZoomIn').on('touchend', function(){
	    StopDollyZoom();
	});
	$('.DollyZoomIn').on('mouseup', function(){
	    StopDollyZoom();
	});

	//DOLLY ZOOM OUT
	$('.DollyZoomOut').on('touchstart', function(){
	    DollyZoomOut();
	});
	$('.DollyZoomOut').on('mousedown', function(){
	    DollyZoomOut();
	});
	$('.DollyZoomOut').on('touchend', function(){
	    StopDollyZoom();
	});
	$('.DollyZoomOut').on('mouseup', function(){
	    StopDollyZoom();
	});

	//VIDEO ZOOM IN
	$('.ARTSTATION_VideoZoomIn').on('touchstart', function(){
	    videoZoomIn();
	});
	$('.ARTSTATION_VideoZoomIn').on('mousedown', function(){
	    videoZoomIn();
	});
	$('.ARTSTATION_VideoZoomIn').on('touchend', function(){
	    stopVideoZoom();
	});
	$('.ARTSTATION_VideoZoomIn').on('mouseup', function(){
	    stopVideoZoom();
	});

	//VIDEO ZOOM OUT
	$('.ARTSTATION_VideoZoomOut').on('touchstart', function(){
	    videoZoomOut();
	});
	$('.ARTSTATION_VideoZoomOut').on('mousedown', function(){
	    videoZoomOut();
	});
	$('.ARTSTATION_VideoZoomOut').on('touchend', function(){
	    stopVideoZoom();
	});
	$('.ARTSTATION_VideoZoomOut').on('mouseup', function(){
	    stopVideoZoom();
	});

	//RETURN TO WORLD VIEW
	$('.ARTSTATION_HomeBtn').on('click', function(){
		StateChangeUI(UI_HIDE_ENVIRONMENT);
	    ReturnToWorldView();
	});
	//RETURN TO REGION LIST
	$('.ARTSTATION_ReturnToRegionList').on('click', function(){
	    window.location = "/";
	});


	//VIDEO PLAY/PAUSE CONTROLS
	$('.ARTSTATION_PlayBtn').on('click', function(){
	    playCurrentVideo();
	});
	$('.ARTSTATION_PauseBtn').on('click', function(){
	    pauseCurrentVideo();
	});

	//ENLARGE VIDEO (go fullscreen)
	$('.ARTSTATION_MaximiseBtn').on('click', function(){
	    enlargeCurrentVideo();
	});
	
	//EXIT VIDEO
	$('.ARTSTATION_ExitBtn').on('click', function(){
	    exitCurrentVideo();
	});
	
	//CLOSE MODAL
	$('.ARTSTATION_ClosePopup').on('click', function(){
	    hideInfoPopup();
	});

	/*
		--
		STATES
		--
	*/

	//CHANGE STATE
	function setState(newState, shouldFadeOut = true) {
		if (WORLD_STATE == newState) {
			return;
		}

		//Update state
		WORLD_STATE = newState;

		//Hide map in tracking view
		if (WORLD_STATE == IS_TRACKING_VIDEO && HIDE_MAP_WHEN_TRACKING_VIDEO) {
			viewer.setBackground("gradient");
		}
		else 
		{
			if (USE_CESIUM) {
				viewer.setBackground("null");
			}
		}

		//Basic UI updates
		if (WORLD_STATE == IN_ENVIRONMENT) {
			//StateChangeUI(UI_HIDE_WORLDVIEW); - now handled elsewhere
			for (var i=0; i<viewer.scene.scene.children.length; i++) {
				if (viewer.scene.scene.children[i].name == "ARTSTATION_WorldViewWeb") {
					viewer.scene.scene.children[i].visible = false;
				}
			}
			StateChangeUI(UI_SHOW_ENVIRONMENT);
		} 
		else if (WORLD_STATE == IN_WORLDVIEW) {
			//StateChangeUI(UI_HIDE_ENVIRONMENT); - now handled elsewhere
			INFO_POPUP_IS_HIDDEN = false;
			for (var i=0; i<viewer.scene.scene.children.length; i++) {
				if (viewer.scene.scene.children[i].name == "ARTSTATION_WorldViewWeb") {
					viewer.scene.scene.children[i].visible = true;
				}
			}
			StateChangeUI(UI_SHOW_WORLDVIEW);
		}

		//Marker click sanity bug-fix
		if (WORLD_STATE != IS_TRACKING_VIDEO) {
			CAN_CLICK_ON_MARKERS = true;
		}
	}

	//UI CONTROL
	function StateChangeUI(state) {
		if (state == UI_RESET) {
			$(".OnlyInEnvironment").hide();
			$(".OnlyInVideo").hide();
			$(".OnlyInWorldView").show();
		} else if (state == UI_SHOW_ENVIRONMENT) {
			$(".OnlyInEnvironment").fadeIn(500);
			if (!INFO_POPUP_IS_HIDDEN) { $("#ARTSTATION_ControlPanel").modal("show"); }
		} else if (state == UI_HIDE_ENVIRONMENT) {
			$(".OnlyInEnvironment").fadeOut(500);
			if (!INFO_POPUP_IS_HIDDEN) { $("#ARTSTATION_ControlPanel").modal("hide"); }
		} else if (state == UI_SHOW_VIDEO) {
			$(".OnlyInVideo").fadeIn(500);
		} else if (state == UI_HIDE_VIDEO) {
			$(".OnlyInVideo").fadeOut(500);
		} else if (state == UI_SHOW_WORLDVIEW) {
			$(".OnlyInWorldView").fadeIn(500);
		} else if (state == UI_HIDE_WORLDVIEW) {
			$(".OnlyInWorldView").fadeOut(500);
		}
	}

	//TOGGLE VISIBILITY OF ALL VIDEO MARKERS
	function ToggleMarkerVisibility(shouldShow, shouldFade, customTime=500) {
		var newOpacity = 0;
		if (shouldShow) { newOpacity = 1; }
		var fadeTime = 0;
		if (shouldFade) { fadeTime = customTime; }

		if (!shouldShow) {
			CAN_CLICK_ON_MARKERS = shouldShow;
		}

		for (var i = 0; i < VIDEO.length; i++) {
			var video_id = i;
			var MARKER_TWEEN = new TWEEN.Tween(VIDEO[video_id].VideoMarker.material).to({opacity: newOpacity}, fadeTime);
			MARKER_TWEEN.onComplete(function(){
				VIDEO[video_id].VideoMarker.visible = shouldShow;
				CAN_CLICK_ON_MARKERS = shouldShow;
			});
			MARKER_TWEEN.start();
		}
	}

	//ENTER VIDEO TRACKING MODE
	function EnterVideoTrackMode(video_id, isEnteringVideo, callback=function(){}, speedIn=500, speedOut=1000, speedDelay=500) {
		var CAMERA_POSITION = new THREE.Vector3();
		var CAMERA_ROTATION = new THREE.Euler();
		if (isEnteringVideo) {
			//Compute position of video 
            var coords = ConvertToUTM(VIDEO[video_id].ImportedTrackData[0][0], VIDEO[video_id].ImportedTrackData[0][1]);
            var VIDEO_NEW_POSITION = new THREE.Vector3(
            	coords[0]+VIDEO[video_id].X_Offset, 
            	coords[1]+VIDEO[video_id].Y_Offset, 
            	parseFloat(VIDEO[video_id].ImportedTrackData[0][3]) + LOCATION[VIDEO[video_id].LocationDataIndex].Z_Offset - VIDEO[video_id].Z_Offset);

            //Position video group for initial data
    		VIDEO[video_id].VideoParent.position.x = VIDEO_NEW_POSITION.x;
    		VIDEO[video_id].VideoParent.position.y = VIDEO_NEW_POSITION.y;
    		VIDEO[video_id].VideoParent.position.z = VIDEO_NEW_POSITION.z;

    		//Rotate video group/mesh for initial data
    		VIDEO[video_id].VideoMesh.rotation.x = VIDEO[video_id].ImportedTrackData[0][8] * Math.PI / 180;
    		VIDEO[video_id].VideoMesh.rotation.y = 0;
    		VIDEO[video_id].VideoMesh.rotation.z = 0;
    		VIDEO[video_id].VideoParent.rotation.x = 0;
    		VIDEO[video_id].VideoParent.rotation.y = 0;
    		VIDEO[video_id].VideoParent.rotation.z = VIDEO[video_id].ImportedTrackData[0][10] * Math.PI / 180;

    		//Hide markers and fade video plane in
    		var VIDEO_PLANE_OPACITY = new TWEEN.Tween(VIDEO[video_id].VideoMesh.material).to({opacity: 1}, speedIn+speedOut+speedDelay);
    		VIDEO_PLANE_OPACITY.onStart(function(){
				VIDEO[video_id].VideoMesh.visible = true;
			});
			VIDEO_PLANE_OPACITY.start();
    		ToggleMarkerVisibility(false, true, speedIn+speedDelay);

    		//Freeze potree controls
    		var controls = viewer.getControls(viewer.scene.view.navigationMode);
        	controls.isTransitioning = true;

			//Update matrices for world position
			VIDEO[video_id].VideoParent.updateMatrixWorld();
			VIDEO[video_id].VideoMesh.updateMatrixWorld();
			VIDEO[video_id].VideoCamera.updateMatrixWorld();

        	//Set desired position/rotation
			VIDEO[video_id].VideoCamera.getWorldPosition(CAMERA_POSITION);
			CAMERA_ROTATION.setFromQuaternion(VIDEO[video_id].VideoCamera.getWorldQuaternion());

        	//Position camera
		    VIDEO[video_id].TransitionCamera.position.copy(viewer.scene.getActiveCamera().position);
			VIDEO[video_id].TransitionCamera.rotation.copy(viewer.scene.getActiveCamera().rotation);

			//Save camera config
			CAMERA_SAVE = viewer.scene.getActiveCamera();
		}
		else
		{
			//Show markers and fade video plane out
    		var VIDEO_PLANE_OPACITY = new TWEEN.Tween(VIDEO[video_id].VideoMesh.material).to({opacity: 0}, speedIn+speedOut+speedDelay);
    		VIDEO_PLANE_OPACITY.onComplete(function(){
				VIDEO[video_id].VideoMesh.visible = false;
			});
			VIDEO_PLANE_OPACITY.start();
    		ToggleMarkerVisibility(true, true, speedIn+speedDelay);

        	//Set desired position/rotation
        	CAMERA_POSITION.copy(viewer.scene.cameraP.position); //viewer.scene.cameraP is the getActiveCamera for potree
			CAMERA_ROTATION.copy(viewer.scene.cameraP.rotation); //CAMERA_SAVE added 10/08, ineffective though

			//Update matrices for world position
			VIDEO[video_id].VideoParent.updateMatrixWorld();
			VIDEO[video_id].VideoMesh.updateMatrixWorld();
			VIDEO[video_id].VideoCamera.updateMatrixWorld();

        	//Position camera
		    VIDEO[video_id].VideoCamera.getWorldPosition(VIDEO[video_id].TransitionCamera.position);
		    VIDEO[video_id].TransitionCamera.rotation.setFromQuaternion(VIDEO[video_id].VideoCamera.getWorldQuaternion());
		}

		//Set transition camera as active
		TRACKING_CAMERA_OBJECT = VIDEO[video_id].TransitionCamera;
		TRACKING_CAMERA_IS_ENABLED = true;

		//Move camera to desired position
		var TRANSITION_TWEEN_POSITION = new TWEEN.Tween(VIDEO[video_id].TransitionCamera.position).to({x: CAMERA_POSITION.x, y: CAMERA_POSITION.y, z: CAMERA_POSITION.z}, speedIn+speedOut+speedDelay); //alt viewer.scene.getActiveCamera().position
		var TRANSITION_TWEEN_ROTATION = new TWEEN.Tween(VIDEO[video_id].TransitionCamera.rotation).to({x: CAMERA_ROTATION.x, y: CAMERA_ROTATION.y, z: CAMERA_ROTATION.z}, speedIn+speedOut+speedDelay); //alt viewer.scene.getActiveCamera().rotation
		TRANSITION_TWEEN_POSITION.onStart(function(){
			if (isEnteringVideo) { StateChangeUI(UI_HIDE_ENVIRONMENT); } else { StateChangeUI(UI_HIDE_VIDEO); }
			TRANSITION_TWEEN_ROTATION.start();
		});
		TRANSITION_TWEEN_POSITION.onComplete(function(){
			if (isEnteringVideo) { StateChangeUI(UI_SHOW_VIDEO); } else { StateChangeUI(UI_SHOW_ENVIRONMENT); }
			callback();
		});
		TRANSITION_TWEEN_POSITION.start();
	}

	/*
		--
		MISC
		--
	*/

	//CHANGE CUSTOM CAMERA ASPECT RATIOS ON WINDOW RESIZE
	$(window).resize(function() {
		for (var i=0; i<VIDEO.length; i++) {
			VIDEO[i].TransitionCamera.aspect = window.innerWidth / window.innerHeight;
			VIDEO[i].VideoCamera.aspect = window.innerWidth / window.innerHeight;
		}
	});

	//CREATE WORLD VIEW WEB
	function generateWorldWeb() {
		NUMBER_OF_LOADED_LOCATIONS++;
		if (NUMBER_OF_LOADED_LOCATIONS == NUMBER_OF_LOCATIONS) {
			//var WorldWebMat = new THREE.LineBasicMaterial({color: 0xff9000, transparent: true, opacity: 1, linewidth: 5}); //WebGL hates linewidth!
			var WorldWebMat = new MeshLineMaterial({color: new THREE.Color('#ff9000'), sizeAttenuation: false, lineWidth: 15, resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)});
			var WorldWebGeo = new THREE.Geometry();
			for (var i=0; i<LOCATION.length; i++) {
				WorldWebGeo.vertices.push(LOCATION[i].Position);
				for (var x=0; x<LOCATION.length; x++) {
					if (x != i) {
						WorldWebGeo.vertices.push(LOCATION[x].Position);
					}
				}
			}
			//var WorldWeb = new THREE.Line(WorldWebGeo, WorldWebMat);
			var WorldWebMesh = new MeshLine();
			WorldWebMesh.setGeometry(WorldWebGeo);
			var WorldWeb = new THREE.Mesh(WorldWebMesh.geometry, WorldWebMat);
			WorldWeb.name = "ARTSTATION_WorldViewWeb";
			WorldWeb.position.z += 50;
			viewer.scene.scene.add(WorldWeb);
		}
	}

	/*
		--
		MAP
		--
	*/

	//SWITCH TO/FROM ENVIRONMENT MAP MODE
	function enterEnvMapMode(shouldShow) {
		var controls = viewer.getControls(viewer.scene.view.navigationMode);
		for (var i=0; i<viewer.scene.scene.children.length;i++) {
			if (viewer.scene.scene.children[i].name == "ARTSTATION_EnvViewMap_"+controls.clickedEnvironmentUUID) {
				if (shouldShow) { viewer.scene.scene.children[i].visible = true; }
				for (var x=0; x<viewer.scene.scene.children[i].children.length; x++) {
					if (shouldShow) {
						new TWEEN.Tween(viewer.scene.scene.children[i].children[x].material).to({opacity: 1}, 500).start();
					}
					else
					{
						new TWEEN.Tween(viewer.scene.scene.children[i].children[x].material).to({opacity: 0}, 500).start();
					}
				}
				if (!shouldShow) { viewer.scene.scene.children[i].visible = false; }
				//viewer.scene.scene.children[i].visible = shouldShow;
			}
			else if (viewer.scene.scene.children[i].name == "ARTSTATION_WorldViewMap") {
				//viewer.scene.scene.children[i].visible = !shouldShow;
			}
		}
	}

	//OPENSTREETMAP LONGITUDE TO TILE
	function lon2tile(lon,zoom) { 
		return ((lon+180)/360*Math.pow(2,zoom)); 
	}
	//OPENSTREETMAP LATITUDE TO TILE
	function lat2tile(lat,zoom)  { 
		return ((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)); 
	}
	//OPENSTREETMAP TILE TO LONGITUDE
	function tile2lon(x,zoom) {
		return (x/Math.pow(2,zoom)*360-180);
	}
	//OPENSTREETMAP TILE TO LATITUDE
	function tile2lat(y,zoom) {
		var n=Math.PI-2*Math.PI*y/Math.pow(2,zoom);
		return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
	}

	//GENERATE TILE LIST
	function tileList(gps, zoom, radius, quality, type) {
		var URLs = [];

		//We need an even radius > 2
		if (radius%2 != 0 || radius<2) {
			return URLs;
		}

		//Get tile "X,Y" for the online standard map tile server with given GPS
		var lat_tile = Math.floor(lat2tile(gps[0], zoom));
		var lon_tile = Math.floor(lon2tile(gps[1], zoom));

		for (var lat_x=-(radius/2);lat_x<=(radius/2);lat_x++) {
			for (var lon_x=-(radius/2);lon_x<=(radius/2);lon_x++) {
				//Verify we haven't already added this one
				var tile_x = lon_tile+lon_x;
				var tile_y = lat_tile+lat_x;
				for (var i=0; i<MAP_TILES.length; i++) {
					if (MAP_TILES[i].x == tile_x && MAP_TILES[i].y == tile_y) {
						continue;
					}
				}

				//Work out the GPS of the map tile (for placing in world)
				var lat_tile_coords = tile2lat(tile_y, zoom);
				var lon_tile_coords = tile2lon(tile_x, zoom);
                var tile_pos = ConvertToUTM(lat_tile_coords, lon_tile_coords);

                //Generate URL (new optional quality param)
                var tile_url = "https://maps.wikimedia.org/"+type+"/"+zoom+"/"+tile_x+"/"+tile_y+".png";
                if (quality != 0) {
                	//Supports 1.3, 1.5, 2, 2.6, 3 times the original resolution
                	tile_url = "https://maps.wikimedia.org/"+type+"/"+zoom+"/"+tile_x+"/"+tile_y+"@"+quality+"x.png";
                }

                //Save tile info to array
				URLs.push({
					TileURL: tile_url,
					TileLat: lat_tile_coords,
					TileLon: lon_tile_coords,
					TileWorldX: tile_pos[0],
					TileWorldY: tile_pos[1],
					TileUrlX: tile_x,
					TileUrlY: tile_y,
					TileUrlZ: zoom
				});

				//Remember we added this tile
				MAP_TILES.push({x:tile_x, y:tile_y});
			}
		}

		return URLs;
	}

	//CREATE MAP AROUND A GPS POSITION
	function createMapAround(gps=[0,0], zoom=14, mapType="osm-intl") {
		//Map object to return
		var thisMap = new THREE.Group();
		thisMap.name = "ARTSTATION_BespokeMapGroup"; //Overwriten on env maps

		//Tile "zoom-specific" configs
		//As defined above, these are LOW (14), MEDIUM (16), HIGH (18) - please update here if they are changed above.
		var tile = {
			14: {
				size: 1530, 
				radius: 36, //caps out at 20 on mobile
				mapOffset: new THREE.Vector3(760,-760, 0),
				quality: MAP_QUALITY_STANDARD,
				defaultOpacity: 1
			},
			16: {
				size: 383, 
				radius: 10,
				mapOffset: new THREE.Vector3(200,-190, 30),
				quality: MAP_QUALITY_MEDIUM,
				defaultOpacity: 0
			},
			18: {
				size: 96, 
				radius: 10,
				mapOffset: new THREE.Vector3(50,-50, 49),
				quality: MAP_QUALITY_EXTRA, //caps out at MEDIUM on mobile
				defaultOpacity: 0
			}
		};
		if (tile[zoom].quality > MAP_QUALITY_MEDIUM && !OPTIMISATION_UseHQ) {
			tile[zoom].quality = MAP_QUALITY_MEDIUM;
		}
		if (tile[zoom].radius > 20 && !OPTIMISATION_UseHQ) {
			tile[zoom].radius = 20;
		}

		//Get all map tiles for requested location
		var mapList = tileList(gps, zoom, tile[zoom].radius, tile[zoom].quality, mapType);

		//Create all map tile planes
		for (var i=0; i<mapList.length; i++) {
			var map_plane = new THREE.PlaneGeometry(tile[zoom].size, tile[zoom].size, 1, 1);
			/*
			var map_texture = new THREE.TextureLoader().load(mapList[i].TileURL, undefined, undefined, function(e) {
				console.log("ERROR");
				map_texture = new THREE.TextureLoader().load("http://assets.artstation.mattfiler.co.uk/IMAGES/mapfail.png");
			});
			*/
			var map_texture = new THREE.TextureLoader().load(mapList[i].TileURL);
			map_texture.crossOrigin = 'anonymous';
			map_texture.wrapS = THREE.RepeatWrapping;
			map_texture.wrapT = THREE.RepeatWrapping;
			map_texture.repeat.set(1, 1);
			var map_material = new THREE.MeshBasicMaterial({color: 0xffffff, map: map_texture, transparent: true, opacity: tile[zoom].defaultOpacity, alphaTest: 0.5});
			var map_plane_mesh = new THREE.Mesh(map_plane, map_material);
			map_plane_mesh.name="ARTSTATION_MapTile";
			map_plane_mesh.position.set(mapList[i].TileWorldX, mapList[i].TileWorldY, 0);
			map_plane_mesh.material.side = THREE.DoubleSide;
			thisMap.add(map_plane_mesh);
		}

		//Apply appropriate zoom offset and return
		thisMap.position.x = tile[zoom].mapOffset.x;
		thisMap.position.y = tile[zoom].mapOffset.y;
		thisMap.position.z = tile[zoom].mapOffset.z;
		return thisMap;
	}

	function createMapForLocation(location_id) {
		if (LOCATION[location_id].UUID != null) {
			//Generate "environment view" map data for pointclouds
			var envViewMap = createMapAround(LOCATION[location_id].LocationGPS, MAP_DETAIL_HIGH, MAP_TYPE[0]);
			envViewMap.name = "ARTSTATION_EnvViewMap_"+LOCATION[location_id].UUID;
			envViewMap.visible = false; //only visible when location clicked (opacity too!)
			viewer.scene.scene.add(envViewMap);
		}

		//Generate "world view" map data for all
		WORLD_VIEW_MAP.add(createMapAround(LOCATION[location_id].LocationGPS, MAP_DETAIL_LOW, MAP_TYPE[0]));

		//Update the "world view" map
		for (var i=0; i<viewer.scene.scene.children.length; i++) {
			if (viewer.scene.scene.children[i].name == "ARTSTATION_WorldViewMap") {
				viewer.scene.scene.remove(viewer.scene.scene.children[i]);
			}
		}
		viewer.scene.scene.add(WORLD_VIEW_MAP);
	}
}