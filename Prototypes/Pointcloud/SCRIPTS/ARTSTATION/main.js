/*
	ARTSTATION
	Created by Matt Filer
*/

function ARTSTATION(THIS_REGION) {
	/*
		--
		SETUP
		--
	*/

	//DEFINE SETTINGS
	var INFO_POPUP_IS_HIDDEN = false;
	var NUMBER_OF_LOADED_LOCATIONS = 0;
	var DEFAULT_CAMERA_OFFSET_DESKTOP = 30;
	var DEFAULT_CAMERA_OFFSET_MOBILE = 50;

	//DEFINE URLS
	var ASSET_URL = "assets.artstation.mattfiler.co.uk";

	//DEFINE DATA STORES
	var VIDEO = [];
	var LOCATION = [];
	var LOCATION_INFO = [];
	var REGION_INFO = [];
	var DOLLY_COUNTER = [0,0];
	var VIDEO_DOLLY_COUNTER = [0,0];
	var ENTRY_RADIUS_SAVE = null; //This is set later
	var WORLD_VIEW_MAP = new THREE.Group();
	WORLD_VIEW_MAP.name = "ARTSTATION_WorldViewMap";
	var MAP_TILES = [{x: 0, y: 0}];
	var NUMBER_OF_LOCATIONS = 0; //Set upon loading JSON
	var NUMBER_OF_LOCATIONS_LOADED = 0; //Updated dynamically
	var GLOBAL_LOAD_CALCULATOR = [0,0]; //Only used for calculating percent
	var GLOBAL_LOAD_PERCENT = 0; //Updated dynamically
	var CURRENT_LOCATION = null; //Updated dynamically

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
	var MAP_DETAIL_HIGHER = 18; //Environment View
	var MAP_DETAIL_HIGH = 17; //Alt Environment View
	var MAP_DETAIL_MEDIUM = 16; //Currently Unused
	var MAP_DETAIL_LOW = 14; //World View

	//DEFINE MAP QUALITY LEVELS (tile resolution)
	var MAP_QUALITY_EXTRA = 3;
	var MAP_QUALITY_HIGH = 2;
	var MAP_QUALITY_MEDIUM = 1.3;
	var MAP_QUALITY_STANDARD = 0;

	//DEFINE MAP TYPE
	var MAP_TYPES = [
		["https://", ".wikimedia.org/osm-intl", "png", ["maps"]], 
		["https://", ".tile.openstreetmap.org", "png", ["a","b","c","d"]],
		["https://", ".tile.opentopomap.org", "png", ["a","b","c","d"]],
		["http://", ".tile.stamen.com/watercolor", "jpg", ["a","b","c","d"]],
		["https://stamen-tiles-d.", ".ssl.fastly.net/toner", "png", ["a"]]
	];
	//var WORLD_VIEW_MAP_TYPE = 2;
	//var ENV_VIEW_MAP_TYPE = 3;
	var WORLD_VIEW_MAP_TYPE = 2;
	var ENV_VIEW_MAP_TYPE = 2;

	//DEFINE POTREE VIEWER
	window.viewer = new Potree.Viewer(document.getElementById("potree_render_area"), {
		useDefaultRenderLoop: false
	});

	//CONFIGURE POTREE VIEWER PER DEVICE
	var device = new MobileDetect(window.navigator.userAgent);
	var OPTIMISATION_PointBudget = 500000;
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
	viewer.loadSettingsFromURL();
	viewer.useHQ = OPTIMISATION_UseHQ;
	viewer.setMinNodeSize(OPTIMISATION_MinNodeSize);
	//console.log("Optimisation result:\nPOINT BUDGET - " + OPTIMISATION_PointBudget + "\nMIN NODE SIZE - " + OPTIMISATION_MinNodeSize + "\nSHOULD USE HQ - " + OPTIMISATION_UseHQ);

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

	//SETUP SKYBOX
	viewer.scene.getActiveCamera().far = 5000*1000*1000;
	viewer.setBackground("skybox");

	//ENABLE DEMO PANEL
	viewer.loadGUI(function() {
		viewer.setLanguage('en');
		$("#menu_appearance").next().show();
		$("#menu_tools").next().show();
		//$("#menu_scene").next().show();
		//viewer.toggleSidebar();
	}); 

	$(".ARTSTATION_LoadScreen").fadeIn(1500, function() {
		//LOAD REQUIRED DATA
		loadRegionData();
		loadLocationsFromJson();
	});

	/*
		--
		RENDER & UPDATE
		--
	*/

	//RENDER/UPDATE LOOP
	function loop(timestamp){
		requestAnimationFrame(loop);

		if (currentDevice == null) {
			currentDevice = new MobileDetect(window.navigator.userAgent)
		}

		viewer.update(viewer.clock.getDelta(), timestamp);

		if (WORLD_STATE == IS_TRACKING_VIDEO || WORLD_STATE == IN_ENVIRONMENT) {
			$(".annotation").hide();
		}

		viewer.render();
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
	    var regions_json_path = "http://"+ASSET_URL+"/CONFIGS/regions.json"; 
	    $.getJSON(regions_json_path, function(data) {
	        $.each(data, function(key, val) {
	            region_data.push(val); //Add to array
	        });
	    }).done(function(json) {
	    	//Load data for this region
			region_data = region_data[0];
			for (var i=0;i<region_data.length;i++) {
				if (region_data[i].region_id == THIS_REGION) {
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
	    var locations_json_path = "http://"+ASSET_URL+"/CONFIGS/locations.json"; 
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
						generateWorldWeb(locationIndex);

						//Reset view pitch
						viewer.scene.view.pitch = -0.7853981633974672;
					}
				);
			}
		});
	}

	//LOAD LOCATION POINTCLOUD INTO VIEWER
	function loadLocation(locationData, callback) {
		var filename = "default";
		var env_marker_radius = 100;
		if (locationData.is_pointcloud) {
			filename = locationData.filename;
			env_marker_radius = 300;
		}
		Potree.loadPointCloud("http://"+ASSET_URL+"/POINTCLOUDS/"+filename+"/cloud.js", filename, function(e) {
			//Simplify namecalls
			var pointcloud = e.pointcloud;
			var material = pointcloud.material;

			//Position correctly
			var z_offset = locationData.z_offset;
			if (z_offset == undefined) { z_offset = 0; }
			if (locationData.is_pointcloud) {
				pointcloud.position.z = z_offset;
			}
			else
			{
				//"Non-pointcloud" locations need manual GPS positioning as well as Z override
				var coords = ConvertToUTM(locationData.gps[0], locationData.gps[1]);
				pointcloud.position.set(coords[0], coords[1], z_offset);
			}

			//Setup material, add to scene, realign camera
			viewer.scene.addPointCloud(pointcloud);
			material.pointColorType = Potree.PointColorType.RGB;
		    material.size = 1;
		    material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
		    material.shape = Potree.PointShape.CIRCLE;
		    viewer.fitToScreen();

		    //Make environment marker
		    var env_marker_geo = new THREE.CircleGeometry(env_marker_radius, 32);
			var env_marker_mat = new THREE.MeshBasicMaterial({color: 0x8b0000});
			var env_marker = new THREE.Mesh(env_marker_geo, env_marker_mat);
			env_marker.name = "ARTSTATION_LocationMarker";

			//Position environment marker & update location data
			var pointcloud_uuid = pointcloud.uuid;
			var pointcloud_center_position = null;
			var pointcloud_gps = null;
			var pointcloud_map_load_check = [];
			if (locationData.is_pointcloud) {
				//Find pointcloud centre & position there
				pointcloud.updateMatrixWorld();
				var box = pointcloud.pcoGeometry.tightBoundingBox.clone();
				box.applyMatrix4(pointcloud.matrixWorld);
				pointcloud_center_position = box.getCenter();
				env_marker.position.set(pointcloud_center_position.x, pointcloud_center_position.y, 10);

				//Convert position to GPS for compatibility
				pointcloud_gps = ConvertToCoordinates(pointcloud_center_position.x, pointcloud_center_position.y);
				pointcloud_map_load_check = [false, false];
			}
			else
			{
				//Place marker by GPS
				env_marker.position.set(coords[0], coords[1], 10);

				//Update location data & others appropriately
				pointcloud_uuid = null;
				pointcloud_center_position = new THREE.Vector3(coords[0], coords[1], z_offset);
				pointcloud_gps = locationData.gps;
				pointcloud_map_load_check = [false];
			}
			viewer.scene.scene.add(env_marker);

			//Save location data to global array
			var location_data = {
				Name: locationData.name,
				FileName: filename,
				UUID: pointcloud_uuid, 
		        Z_Offset: locationData.z_offset,
		        Position: pointcloud_center_position,
		        BasePosition: pointcloud.position, //Unused for "non-pointclouds"
		        LocationGPS: pointcloud_gps,
		        LocationID: locationData.location_id,
		        MapLoaded: pointcloud_map_load_check,
		        Marker: env_marker
			};
		    var location_data_length = LOCATION.push(location_data);

		    //Generate maps around location
		    createMapForLocation(location_data_length - 1);

			//Add location name annotation
		    {
				var locationAnnotation = new Potree.Annotation({
					position: pointcloud_center_position,
					title: locationData.name
				});
				if (locationData.is_pointcloud) {
					//Enter pointcloud on annotation click
					locationAnnotation.addEventListener('click', function(event) {
						var controls = viewer.getControls(viewer.scene.view.navigationMode);
						controls.zoomToLocation({x:0,y:0}, true, 1600, true, function() { enterLocation(); }, {pointcloud_origin: pointcloud.position, pointcloud_center: center});
						$(".annotation").fadeOut(600, function(){ $(".annotation").hide(); });
						StateChangeUI(UI_HIDE_WORLDVIEW);
					});
				}
				else
				{
					//Show info popup on annotation click
					locationAnnotation.addEventListener('click', function(event) {
						clickedEnvironmentMarker(location_data_length - 1);
					});
				}
				viewer.scene.annotations.add(locationAnnotation);
			}

		    Potree.measureTimings = true;
			
			//Zone 30U covers most of England and Wales so we should be fine with this - geoutm.js can always calculate for us.
			var pointcloudProjection = "+proj=utm +zone=30 +ellps=GRS80 +datum=NAD83 +units=m +no_defs";
			var mapProjection = proj4.defs("WGS84");

			window.toMap = proj4(pointcloudProjection, mapProjection);
			window.toScene = proj4(mapProjection, pointcloudProjection);
			
			{
				var bb = viewer.getBoundingBox();

				var minWGS84 = proj4(pointcloudProjection, mapProjection, bb.min.toArray());
				var maxWGS84 = proj4(pointcloudProjection, mapProjection, bb.max.toArray());
			}

			locationProgress(1);

			//Run callback to load env data
			callback(locationData, location_data_length - 1);
		});
	}

	//ENTER LOCATION
	function enterLocation() {
		if (controls.didClickEnvironment) {
			//Populate environment info popup & title
			for (var i=0; i<LOCATION.length; i++) {
				if (controls.clickedEnvironmentUUID == LOCATION[i].UUID) {
					CURRENT_LOCATION = LOCATION[i];
					ToggleInactivePointclouds(false);
					populateEnvInfoPopup(i);
					$(".ARTSTATION_LocationTitle").text(LOCATION[i].Name);
				}
			}

			//Save camera config
			ENTRY_RADIUS_SAVE = viewer.scene.view.radius;

			//Configure camera
        	controls.worldViewCameraConfig = false;
			setState(IN_ENVIRONMENT, true);

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
	}

	//ADD ENVIRONMENT INFO
	function addEnvInfo(locationIndex,title,subtitle,listItems) {
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
	function populateEnvInfoPopup(locationIndex) {
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
	function createVideo(locationIndex, videoName, videoTitle, xOffset, yOffset, zOffset) {
	    //Create HTML video element to draw texture from
	    var video_element = document.createElement("video");
	    video_element.src = "http://"+ASSET_URL+"/VIDEOS/"+LOCATION[locationIndex].FileName+"/"+videoName;
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
	    var video_material = new THREE.MeshBasicMaterial({color: 0xffffff, map: video_texture, transparent: true, opacity: 0}); 
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
		var video_marker_texture = new THREE.TextureLoader().load("http://"+ASSET_URL+"/VIDEOS/"+LOCATION[locationIndex].FileName+"/"+videoName+".png");
		video_marker_texture.crossOrigin = 'anonymous';
		var sprite_material = new THREE.SpriteMaterial({map: video_marker_texture, color: 0xffffff, transparent:true, opacity: 0});
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
            	VIDEO_TWEEN_POSITION.onStart(function() {
            		VIDEO_TWEEN_ROTATION.start();
            		PARENT_TWEEN_ROTATION.start();

            		controls.isTransitioning = true;
            		camera_is_locked = true;
				});
				VIDEO_TWEEN_POSITION.onComplete(function() {
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
	function playVideo(video_id, reset) {
		var video_player = document.getElementById(VIDEO[video_id].ElementID); 
		if (reset) {
			//Reset video time and play
			video_player.currentTime = 0;
    		video_player.play(); 
			//Set title
			$(".ARTSTATION_VideoTitle").text(VIDEO[video_id].VideoTitle);
			//Playing video from the beginning
			EnterVideoTrackMode(video_id, true, function() {
				//Configure tracking camera
				VIDEO[video_id].LockCamera = true;
				TRACKING_CAMERA_OBJECT = VIDEO[video_id].VideoCamera;
				TRACKING_CAMERA_IS_ENABLED = true;
				setState(IS_TRACKING_VIDEO, true);
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
		video_player.style.display="none";
		video_player.pause();
		video_player.currentTime = 0;
	    VIDEO[video_id].VideoMesh.visible = false;
		ToggleMarkerVisibility(true, false, 500);
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
					setState(IN_ENVIRONMENT, true);
					controls.isTransitioning = false;
					VIDEO[current_video].LockCamera = false;
					TRACKING_CAMERA_OBJECT = null;
					TRACKING_CAMERA_IS_ENABLED = false;
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
				video_player.style.display="initial";
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
				enterLocation();
			});
			if (controls.didClickEnvironment) {
				//Fade out name annotation during transition
				$(".annotation").fadeOut(600, function(){ $(".annotation").hide(); });

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
				playVideo(video_id, true);
			}
		}
	}

	//MOVE BACK TO "WORLD VIEW"
	var controls = viewer.getControls(viewer.scene.view.navigationMode);
	function ReturnToWorldView() {
		//if (WORLD_STATE == IN_ENVIRONMENT) {
			//Move camera to world view
			viewer.scene.view.pitch = -0.7853981633974672;
			viewer.fitToScreen(1, 2600);
			DOLLY_COUNTER = [0,0]; //Reset zoom limits

			//Toggle pointcloud visibility
			ToggleInactivePointclouds(true);

			//Fade out all video markers
			ToggleMarkerVisibility(false, true, 500);

			//Swap maps
			enterEnvMapMode(false);
			CURRENT_LOCATION = null;

			//Fade annotations back in and configure controls for world view
			setState(IN_WORLDVIEW, true); 
			$(".annotation").fadeIn(600, "swing", function() { 
				controls.worldViewCameraConfig = true;
			});
		//}
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
		$("body").fadeOut(500, function() {
	    	window.location = "/";
		});
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
		PROGRESS CHECKS
		--
	*/

	//LOCATION PROGRESS
	function locationProgress(updateBy) {
		NUMBER_OF_LOCATIONS_LOADED += updateBy;
		var load_percent = (NUMBER_OF_LOCATIONS_LOADED / NUMBER_OF_LOCATIONS) * 100;
		globalProgress(load_percent, 0);
	}

	//MAP PROGRESS
	function mapProgress(mapDetail, location_id) {
		if (mapDetail == MAP_DETAIL_HIGH || mapDetail == MAP_DETAIL_HIGHER) {
			LOCATION[location_id].MapLoaded[1] = true;
		}
		else
		{
			LOCATION[location_id].MapLoaded[0] = true;
		}
		var map_loaded_count = 0;
		var map_not_loaded_count = 0;
		for (var i=0; i<LOCATION.length; i++) {
			for (var x=0; x<LOCATION[i].MapLoaded.length; x++) {
				if (LOCATION[i].MapLoaded[x] == true) {
					map_loaded_count++;
				}
				else
				{
					map_not_loaded_count++;
				}
			}
		}
		var load_percent = (map_loaded_count / (map_loaded_count + map_not_loaded_count)) * 100;
		globalProgress(load_percent, 1);
	}

	//GLOBAL PROGRESS
	function globalProgress(updateBy, loader_id) {
		GLOBAL_LOAD_CALCULATOR[loader_id] = (updateBy/2); //Divided by 2 as we have 2 loaders
		GLOBAL_LOAD_PERCENT = 0;
		for (var i=0; i<GLOBAL_LOAD_CALCULATOR.length; i++) {
			GLOBAL_LOAD_PERCENT += GLOBAL_LOAD_CALCULATOR[i];
		}
		$(".ARTSTATION_LoadPercent").text(Math.floor(GLOBAL_LOAD_PERCENT));
		$(".ARTSTATION_LoadBar").width(GLOBAL_LOAD_PERCENT + "%");
		if (GLOBAL_LOAD_PERCENT == 100) {
			setState(IN_WORLDVIEW, false);
			StateChangeUI(UI_RESET);
			ToggleMarkerVisibility(false,false, 500);

			$("#ARTSTATION_ControlPanel").modal("show");
			$(".potree_container").fadeIn();
			$(".ARTSTATION_LoadScreen").fadeOut();
		}
	}

	/*
		--
		STATES
		--
	*/

	//CHANGE STATE
	function setState(newState, shouldFadeOut) {
		if (WORLD_STATE == newState) {
			return;
		}

		//Update state
		WORLD_STATE = newState;

		//Basic UI updates
		if (WORLD_STATE == IN_ENVIRONMENT) {
			//StateChangeUI(UI_HIDE_WORLDVIEW); - now handled elsewhere
			showWorldWeb(false);
			StateChangeUI(UI_SHOW_ENVIRONMENT);
		} 
		else if (WORLD_STATE == IN_WORLDVIEW) {
			//StateChangeUI(UI_HIDE_ENVIRONMENT); - now handled elsewhere
			INFO_POPUP_IS_HIDDEN = false;
			showWorldWeb(true);
			StateChangeUI(UI_SHOW_WORLDVIEW);
		}

		//Marker click sanity bug-fix
		if (WORLD_STATE != IS_TRACKING_VIDEO) {
			CAN_CLICK_ON_MARKERS = true;
		}
	}

	//SHOW/HIDE WORLD WEB
	function showWorldWeb(shouldShow) {
		for (var i=0; i<viewer.scene.measurements.length; i++) {
			viewer.scene.measurements[i].visible = shouldShow;
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
	function ToggleMarkerVisibility(shouldShow, shouldFade, customTime) {
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

	//TOGGLE VISIBILITY OF INACTIVE POINTCLOUDS
	function ToggleInactivePointclouds(shouldShow) {
		for (var i=0; i<viewer.scene.pointclouds.length; i++) {
			if (viewer.scene.pointclouds[i].uuid != CURRENT_LOCATION.UUID) {
				viewer.scene.pointclouds[i]._visible = shouldShow;
			}
		}
		for (var i=0; i<LOCATION.length; i++) {
			if (LOCATION[i].Marker != CURRENT_LOCATION.Marker) {
				LOCATION[i].Marker.visible = shouldShow;
			}
		}
	}

	//ENTER VIDEO TRACKING MODE
	function EnterVideoTrackMode(video_id, isEnteringVideo, callback) {
		var speedIn=500;
		var speedOut=1000;
		var speedDelay=500;
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

			//Set transition camera as active
			TRACKING_CAMERA_OBJECT = VIDEO[video_id].TransitionCamera;
			TRACKING_CAMERA_IS_ENABLED = true;

			//Reset main camera to initial environment position
			viewer.scene.view.pitch = -0.7853981633974672;
			viewer.scene.view.radius = ENTRY_RADIUS_SAVE;
			DOLLY_COUNTER = [0,0];
			viewer.controls.stop();
			controls.zoomToLocation({x:0,y:0}, false, 1000, true, function() {}, {pointcloud_origin: CURRENT_LOCATION.BasePosition, pointcloud_center: CURRENT_LOCATION.Position});
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

		    //Set transition camera as active
			TRACKING_CAMERA_OBJECT = VIDEO[video_id].TransitionCamera;
			TRACKING_CAMERA_IS_ENABLED = true;
		}

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
	function generateWorldWeb(location_id) {
		NUMBER_OF_LOADED_LOCATIONS++;
		if (location_id == (NUMBER_OF_LOCATIONS-1)) {
			var line_data = [];
		    var line_path = "http://"+ASSET_URL+"/CONFIGS/lines.json"; 
		    $.getJSON(line_path, function(data) {
		        $.each(data, function(key, val) {
		            line_data.push(val); //Add to array
		        });
		    }).done(function(json) {
				line_data = line_data[0];
				for (var i=0;i<line_data.length;i++) {
					//Replace location ids with positions
					for (var x=0; x<LOCATION.length;x++) {
						if (LOCATION[x].LocationID == line_data[i].from) {
							line_data[i].from = new THREE.Vector3(LOCATION[x].Position.x, LOCATION[x].Position.y, 5);
						}
						if (LOCATION[x].LocationID == line_data[i].to) {
							line_data[i].to = new THREE.Vector3(LOCATION[x].Position.x, LOCATION[x].Position.y, 5);
						}
					}
					//Create line
					{ 
						var line = new Potree.Measure();
						line.addMarker(line_data[i].from);
						line.addMarker(line_data[i].to);
						for (var x=0; x<line.spheres.length; x++) {
							line.spheres[x].visible = false;
						}
						for (var x=0; x<line.edgeLabels.length; x++) {
							if (line_data[i].text) {
								line.edgeLabels[x].setText(line_data[i].text);
								line.edgeLabels[x].visible = true;
							}
							else
							{
								line.edgeLabels[x].visible = false;
							}
						}
						line.color = {r:0,g:0,b:0};
						viewer.scene.addMeasurement(line);
					}
				}
			});
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
						new TWEEN.Tween(viewer.scene.scene.children[i].children[x].material).to({opacity: 0}, 1500).start();
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
	function tileList(gps, zoom, radius, quality, mapType) {
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

                //Generate URLs (new optional quality param)
                var tile_url = [];
                for (var i=0; i<mapType[3].length; i++) {
                	var subdomains = mapType[3];
	                tile_url.push(mapType[0]+subdomains[i]+mapType[1]+"/"+zoom+"/"+tile_x+"/"+tile_y+"."+mapType[2]);
	                if (quality != 0) {
	                	//Supports 1.3, 1.5, 2, 2.6, 3 times the original resolution with wiki maps
	                	tile_url.push(mapType[0]+subdomains[i]+mapType[1]+"/"+zoom+"/"+tile_x+"/"+tile_y+"@"+quality+"x."+mapType[2]);
	                }
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
	function createMapAround(gps, zoom, mapType, location_id) {
		//Map object to return
		var thisMap = new THREE.Group();
		thisMap.name = "ARTSTATION_BespokeMapGroup"; //Overwriten on env maps

        //Override zoom if unsupported on map servers
        if (mapType[1] != ".wikimedia.org/osm-intl") {
        	if (zoom == MAP_DETAIL_HIGHER) {
        		zoom = MAP_DETAIL_HIGH;
        	}
        }

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
			17: {
				size: 192, 
				radius: 10,
				mapOffset: new THREE.Vector3(100,-100, 49),
				quality: MAP_QUALITY_EXTRA, //caps out at MEDIUM on mobile
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

        //Override quality if unsupported on map servers
        if (mapType[1] != ".wikimedia.org/osm-intl") {
        	tile[zoom].quality = MAP_QUALITY_STANDARD;
        }

		//Get all map tiles for requested location
		var mapList = tileList(gps, zoom, tile[zoom].radius, tile[zoom].quality, mapType);

		//Create all map tile planes
		var load_counter = 0;
		for (var i=0; i<mapList.length; i++) {
			var tileURLs = mapList[i].TileURL;
			var map_texture = null;
			map_texture = new THREE.TextureLoader().load(tileURLs[0], function (tex) {
				//Loaded
				load_counter++;
				if (load_counter == mapList.length) {
					mapProgress(zoom, location_id);
				}
			}, undefined, function(e) {
				if (tileURLs[1] != null) {
					//console.warn("ARTSTATION: Dropping back to subdomain 2.");
					map_texture = new THREE.TextureLoader().load(tileURLs[1], function (tex) {
						//Loaded
						load_counter++;
						if (load_counter == mapList.length) {
							mapProgress(zoom, location_id);
						}
					}, undefined, function(e) {
						if (tileURLs[2] != null) {
							//console.warn("ARTSTATION: Dropping back to subdomain 3.");
							map_texture = new THREE.TextureLoader().load(tileURLs[2], function (tex) {
								//Loaded
								load_counter++;
								if (load_counter == mapList.length) {
									mapProgress(zoom, location_id);
								}
							}, undefined, function(e) {
								if (tileURLs[3] != null) {
									//console.warn("ARTSTATION: Dropping back to subdomain 4.");
									map_texture = new THREE.TextureLoader().load(tileURLs[3], function (tex) {
										//Loaded
										load_counter++;
										if (load_counter == mapList.length) {
											mapProgress(zoom, location_id);
										}
									}, undefined, function(e) {
										//A loading error occured
										console.error("ARTSTATION: Map loading error occured. Reloading page to utilise cache.");
										$(".ARTSTATION_LoadScreen").fadeOut(1000, function() {
											location.reload();
										});
									});
								}
								else
								{
									//A loading error occured
									console.error("ARTSTATION: Map loading error occured. Reloading page to utilise cache.");
									$(".ARTSTATION_LoadScreen").fadeOut(1000, function() {
										location.reload();
									});
								}
							});
						}
						else
						{
							//A loading error occured
							console.error("ARTSTATION: Map loading error occured. Reloading page to utilise cache.");
							$(".ARTSTATION_LoadScreen").fadeOut(1000, function() {
								location.reload();
							});
						}
					});
				}
				else
				{
					//A loading error occured
					console.error("ARTSTATION: Map loading error occured. Reloading page to utilise cache.");
					$(".ARTSTATION_LoadScreen").fadeOut(1000, function() {
						location.reload();
					});
				}
			});
			map_texture.crossOrigin = 'anonymous';
			map_texture.wrapS = THREE.RepeatWrapping;
			map_texture.wrapT = THREE.RepeatWrapping;
			map_texture.repeat.set(1, 1);
			var map_material = new THREE.MeshBasicMaterial({color: 0xffffff, map: map_texture, transparent: true, opacity: tile[zoom].defaultOpacity, alphaTest: 0.5});
			var map_plane = new THREE.PlaneGeometry(tile[zoom].size, tile[zoom].size, 1, 1);
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

	//CREATE A MAP FOR AN EXISTING LOCATION
	function createMapForLocation(location_id) {
		if (LOCATION[location_id].UUID != null) {
			//Generate "environment view" map data for pointclouds
			var envViewMap = createMapAround(LOCATION[location_id].LocationGPS, MAP_DETAIL_HIGHER, MAP_TYPES[ENV_VIEW_MAP_TYPE], location_id);
			envViewMap.name = "ARTSTATION_EnvViewMap_"+LOCATION[location_id].UUID;
			envViewMap.visible = false; //only visible when location clicked (opacity too!)
			viewer.scene.scene.add(envViewMap);
		}

		//Generate "world view" map data for all
		WORLD_VIEW_MAP.add(createMapAround(LOCATION[location_id].LocationGPS, MAP_DETAIL_LOW, MAP_TYPES[WORLD_VIEW_MAP_TYPE], location_id));

		//Update the "world view" map
		for (var i=0; i<viewer.scene.scene.children.length; i++) {
			if (viewer.scene.scene.children[i].name == "ARTSTATION_WorldViewMap") {
				viewer.scene.scene.remove(viewer.scene.scene.children[i]);
			}
		}
		viewer.scene.scene.add(WORLD_VIEW_MAP);
	}
}