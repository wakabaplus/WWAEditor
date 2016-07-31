onmessage = function(e) {
	let mapBuffer = [];
	let counter = 0;
	let strBuffer = e.data.str;
	
	for (let srcByte = 0; srcByte < e.data.map.length; srcByte++) {
		if (e.data.map[srcByte] === e.data.map[srcByte + 1]) {
			counter += 1;
			if ((counter === 0xff) || (srcByte + 2 > e.data.map.length)) {
				mapBuffer.push(e.data.map[srcByte], e.data.map[srcByte], counter);
				srcByte += 1;
				counter = 0;
			}
		} else if (counter === 0) {
			mapBuffer.push(e.data.map[srcByte]);
			counter = 0;
		} else {
			mapBuffer.push(e.data.map[srcByte], e.data.map[srcByte], counter);
			counter = 0;
		}
	}
	
	mapBuffer.push(0, 0, 0);
	
	buffer = new Uint8Array(mapBuffer.length + strBuffer.length);
	buffer.set(mapBuffer);
	buffer.set(strBuffer, mapBuffer.length);
	
	postMessage(buffer, [buffer.buffer]);
}
