onmessage = function(e) {
	let max, strByte, strData;
	let srcData = new Uint8Array(e.data);
	let mapData = [];
	
	for (let srcbyte = 0; srcbyte < srcData.length; srcbyte++) {
		if((srcData[srcbyte] == 0) && (srcData[srcbyte+1] == 0) && (srcData[srcbyte+2] == 0)) {
			strByte = srcbyte + 3;
			strData = new Uint8Array(e.data, strByte);
			break;
		};
		mapData.push(srcData[srcbyte]);
		
		if(srcData[srcbyte] == srcData[srcbyte + 1]) {
			max = srcData[srcbyte+2];
			for (let i=0; i < max; i++) {
				mapData.push(srcData[srcbyte]);
			};
			srcbyte = srcbyte + 2;
		};
	};
	
	postMessage({
		map : mapData,
		str : strData
	}, [srcData.buffer]);
}
