<?php
	$json_data = array();

	//SRT Parse (DJI Drone Data)
	if (file_get_contents("http://filepost.artstation.org.uk/ASSETS/VIDEOS/" . $_GET['location'] . "/" . $_GET['video'] . ".csv") == "") {
		$raw_data = file_get_contents("http://filepost.artstation.org.uk/ASSETS/VIDEOS/" . $_GET['location'] . "/" . $_GET['video'] . ".srt");
		if ($raw_data == "") {
			$raw_data = file_get_contents("http://filepost.artstation.org.uk/ASSETS/VIDEOS/" . $_GET['location'] . "/" . $_GET['video'] . ".SRT");
		}
		$line_count = 0;
		foreach(preg_split("/((\r?\n)|(\r\n?))/", $raw_data) as $line){
		    if (substr($line, 0, 3) == "GPS") {
		    	$BAROMETER_POSITION = strpos($line, "BAROMETER");
		    	$BAROMETER_VALUE = substr($line, $BAROMETER_POSITION+10);
		    	$GPS_VALUES = explode(",", substr($line, 4, $BAROMETER_POSITION-6));
		    	$line_data = array(
		    		$GPS_VALUES[1], 
		    		$GPS_VALUES[0], 
		    		$GPS_VALUES[2], 
		    		(string)($BAROMETER_VALUE + 25), 
		    		(string)($line_count * 1000),
		    		"90", 
		    		"0", 
		    		"0", 
		    		"90", 
		    		"0", 
		    		"0",
		    		"SRT");
		    	array_push($json_data, $line_data);
		    	$line_count++;
		    }
		} 
	}

	//CSV Parse (Litchi Data)
	if ($json_data == array()) {
		$raw_data = file_get_contents("http://filepost.artstation.org.uk/ASSETS/VIDEOS/" . $_GET['location'] . "/" . $_GET['video'] . ".csv");
		$line_count = 0;
		$previous_line = array();
		foreach(preg_split("/((\r?\n)|(\r\n?))/", $raw_data) as $line){
			if ($line_count > 0) {
		    	$line_data_raw = explode(",", $line);
		    	if ($line_data_raw[0] != null) {
		    		if ($line_data_raw[37] == 0) {
		    			continue; //Drone isn't recording, so this data isn't relevant to the video
		    		}
			    	$line_data_important = array(
			    		$line_data_raw[0], 
			    		$line_data_raw[1], 
			    		"0", 
			    		$line_data_raw[2], 
			    		$line_data_raw[10], 
			    		(string)(($line_data_raw[60] / 10)+90), 
			    		(string)($line_data_raw[61] / 10), 
			    		(string)(($line_data_raw[62] / 10)*-1), 
			    		(string)(($line_data_raw[63] / 10)+90), 
			    		(string)($line_data_raw[64] / 10), 
			    		(string)(($line_data_raw[65] / 10)*-1),
			    		"CSV");
			    	array_push($json_data, $line_data_important);
		    		$previous_line = $line_data_raw;
		    	}
			}
		    $line_count++;
		} 
	}

	/*
	Outputs: 
		GPS LAT, 
		GPS LON, 
		GPS HEIGHT, 
		ALTITUDE, 
		FLIGHT TIME (MS), 
		DRONE PITCH (deg),
		DRONE ROLL (deg), 
		DRONE YAW (deg),
		GIMBAL PITCH (deg), 
		GIMBAL ROLL (deg), 
		GIMBAL YAW (deg),
		DATA SOURCE
	*/
	if ($json_data != array()) {
		header('Content-Type: application/json');
		echo json_encode($json_data); //Output data
	}
	else
	{
		header("HTTP/1.0 404 Not Found"); //No data found from request, hide the page.
	}
?>