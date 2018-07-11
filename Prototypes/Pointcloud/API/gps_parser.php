<?php
	header('Content-Type: application/json');
	$json_data = array();

	//SRT Parse (DJI Drone Data)
	if (isset($_GET['srt'])) {
		$raw_data = file_get_contents("http://assets.artstation.mattfiler.co.uk/VIDEOS/" . $_GET['location'] . "/" . $_GET['srt'] . ".srt");
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
		    		$BAROMETER_VALUE, 
		    		(string)($line_count * 1000),
		    		"0", 
		    		"0", 
		    		"0", 
		    		"0", 
		    		"0", 
		    		"0");
		    	array_push($json_data, $line_data);
		    	$line_count++;
		    }
		} 
	}

	//CSV Parse (Litchi Data)
	if (isset($_GET['csv'])) {
		$raw_data = file_get_contents("http://assets.artstation.mattfiler.co.uk/VIDEOS/" . $_GET['location'] . "/" . $_GET['csv'] . ".csv");
		$line_count = 0;
		foreach(preg_split("/((\r?\n)|(\r\n?))/", $raw_data) as $line){
			if ($line_count > 0) {
		    	$line_data_raw = explode(",", $line);
		    	if ($line_data_raw[0] != null) {
			    	$line_data_important = array(
			    		$line_data_raw[0], 
			    		$line_data_raw[1], 
			    		"0", 
			    		$line_data_raw[2], 
			    		$line_data_raw[10], 
			    		$line_data_raw[60], 
			    		$line_data_raw[61], 
			    		$line_data_raw[62], 
			    		$line_data_raw[63], 
			    		$line_data_raw[64], 
			    		$line_data_raw[65]);
			    	array_push($json_data, $line_data_important);
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
		DRONE PITCH,
		DRONE ROLL, 
		DRONE YAW,
		GIMBAL PITCH, 
		GIMBAL ROLL, 
		GIMBAL YAW
	*/
	$json_data = json_encode($json_data);
	echo $json_data;
?>