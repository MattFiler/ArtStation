<?php
	header('Content-Type: application/json');
	$raw_data = file_get_contents("http://assets.artstation.mattfiler.co.uk/VIDEOS/" . $_GET['location'] . "/" . $_GET['srt'] . ".srt");
	$json_data = array();
	foreach(preg_split("/((\r?\n)|(\r\n?))/", $raw_data) as $line){
	    if (substr($line, 0, 3) == "GPS") {
	    	$BAROMETER_POSITION = strpos($line, "BAROMETER");
	    	$BAROMETER_VALUE = substr($line, $BAROMETER_POSITION+10);
	    	$GPS_VALUES = explode(",", substr($line, 4, $BAROMETER_POSITION-6));

	    	$line_data = array($GPS_VALUES[1], $GPS_VALUES[0], $GPS_VALUES[2], $BAROMETER_VALUE);
	    	array_push($json_data, $line_data);
	    }
	} 
	$json_data = json_encode($json_data);
	echo $json_data;
?>