(function () {
'use strict';

const OBJECT_SIZE = 40;

const MAX_ITEM = 12;
const MAX_PARTS = 4000;
const MAX_PARTS_PROP = 60;
const MAX_STRING_SIZE = 1510;

const CANVAS_OFFSET = 0.5;
const APP_VERSION = 31;

const APP_MODE_BKG_INSERT = 0;
const APP_MODE_OBJ_INSERT = 1;
const APP_MODE_EDIT = 2;

const DATA_CHECK = 0;
const DATA_VERSION = 2;
const DATA_ENERGYMAX = 32;
const DATA_ENERGY = 10;
const DATA_ITEM = 20;
const DATA_STRENGTH = 12;
const DATA_DEFENCE = 14;
const DATA_GOLD = 16;
const DATA_PLAYER_X = 38;
const DATA_PLAYER_Y = 40;
const DATA_OVER_X = 42;
const DATA_OVER_Y = 44;
const DATA_MAPSIZE = 46;
const DATA_BKG_LENGTH = 34;
const DATA_OBJ_LENGTH = 36;
const DATA_MSG_LENGTH = 48;

const DATA_PROP_X = 6;
const DATA_PROP_Y = 7;
const DATA_PROP_X2 = 8;
const DATA_PROP_Y2 = 9;

const TEXT_NOTSUPPORT = "バージョン3.0以降のWWAマップのみ対応しています。";
const TEXT_BROKENDATA = "データが壊れています。";
const TEXT_BROKENIMG = "画像の読み込みに失敗しました。";
const TEXT_INPUTPASS = "パスワードを入力";
const TEXT_WRONGPASS = "パスワードが違います。";

window.onload = function() {
	let app = new App();
	let viewModel = new ViewModel(app);
}

function $(id) {
	return document.getElementById(id);
}

/**
 * 配列中任意のBYTE型をWORD型へ変換した値を取得する
 * @param {Array|Uint8Array} uint8 変換対象のBYTE型が含まれた配列
 * @param {Number} offset 変換対象のBYTE型までのオフセット
 * @return {Number} WORD型の値
 */
function uint8to16(uint8, offset) {
	return uint8[offset] + (uint8[offset+1] << 8);
}

/**
 * WORD型をBYTE型へ変換して配列中任意の位置へ代入する
 * @param {Array|Uint8Array} uint8 代入する配列
 * @param {Number} uint16 BYTE型へ変換するWORD型の値
 * @param {Number} offset WORD型の値を代入する配列のオフセット
 */
function uint16to8(uint8, uint16, offset) {
	let _uint16 = new Uint16Array(1);
	_uint16[0] = uint16;
	let int8 = new Uint8Array(_uint16.buffer);
	uint8[offset] = int8[0];
	uint8[offset + 1] = int8[1];
}

/**
 * データのハッシュ値を計算する
 * @param {Array|Uint8Array} map 元となるデータ
 * @return {Number} ハッシュ値
 */
function getHash(map) {
	let i;
	let checkData = 0;
	let int8 = new Int8Array(1);
	for (i = 2; i < map.length; i++) {
		int8[0] = map[i]; // octetからbyteにキャスト
		checkData += int8[0] * (i % 8 + 1);
	}
	return checkData % 0x10000;
}

/**
 * パスワードを復号化する
 * @param {String} 暗号化されたパスワード
 * @return {Number} 復号化されたパスワード
 */
function decryptPass(pass) {
	return (parseInt(pass) - 412660) / 170;
}

function toggleWindow(e, callback) {
	let data_window = $(e.target.dataset.window);
	data_window.hidden = !data_window.hidden;
	callback(e);
};

function showWindow(e) {
	toggleWindow(e, (e) => {
		if ($("modal-background")) {
			document.body.removeChild($("modal-background"));
		} else {
			let modal = document.createElement("div");
			modal.id="modal-background";
			modal.dataset.window = e.target.dataset.window;
			modal.addEventListener("click", closeModalWindow, false);
			document.body.appendChild(modal);
		}
	});
}

function closeModalWindow(e) {
	toggleWindow(e, (e) => {
		document.body.removeChild(e.target);
	});
}

/**
 * マップデータ全体の情報を表す
 * @constructor
 */
function App() {
	this.player = new Player();
	this.obj = new Obj();
	this.bkg = new Bkg();
	this.draw = new Draw();
	
	this.fileName = null;
	this.imgFileName = null;
	this.worldName = null;
	this.pass = null;
	this.mapSize = null;
	this.item = new Uint8Array(MAX_ITEM);
	
	this.message = [];
	
	this.element = {
		type_select : {
			bkg : null,
			obj : null
		},
		setting_form : {
			system : $("system-settings"),
			map : $("map-settings"),
			player : $("player-settings"),
			bkg : $("background-settings"),
			obj : $("object-settings")
		}
	};
}

App.prototype = {
	newFile : function(imgFile) {
		this.bkg = new Bkg();
		this.bkg.newFile(this.mapSize);
		this.obj = new Obj();
		this.obj.newFile(this.mapSize);
		
		this.mapSize = 101;
		this.fileName = "newmap.dat";
		this.imgFileName = imgFile.name;
		this.worldName = "";
		this.pass = "";
		this.sysMsg = new Array(20).fill("");
		this.message = Array.from({length: 10}, () => "");

		this.draw.init(this.bkg, this.obj, this.player, this.mapSize, imgFile);
	},
	
	openFile : function(map, str, fileName, imgFile) {
		let dummy, dat;
		let mapByte = 90;
		let objByte;
		let ptr = [0];
		let numBkg = uint8to16(map, DATA_BKG_LENGTH);
		let numObj = uint8to16(map, DATA_OBJ_LENGTH);
		let numMsg = uint8to16(map, DATA_MSG_LENGTH);
		
		this.mapSize = uint8to16(map, 46);
		this.fileName = fileName;
		
		for (let i = 0; i < 12; i++) {
			this.item[i] = map[DATA_ITEM+i];
		}
		
		this.player.energyMax = uint8to16(map, DATA_ENERGYMAX);
		this.player.energy = uint8to16(map, DATA_ENERGY);
		this.player.strength = uint8to16(map, DATA_STRENGTH);
		this.player.defence = uint8to16(map, DATA_DEFENCE);
		this.player.gold = uint8to16(map, DATA_GOLD);
		this.player.x = uint8to16(map, DATA_PLAYER_X);
		this.player.y = uint8to16(map, DATA_PLAYER_Y);
		this.player.overX = uint8to16(map, DATA_OVER_X);
		this.player.overY = uint8to16(map, DATA_OVER_Y);
		
		for (let x = 0; x < this.mapSize; x++) {
			this.bkg.mapData[x] = [];
			this.obj.mapData[x] = [];
			for (let y = 0; y < this.mapSize; y++) {
				objByte = mapByte + Math.pow(this.mapSize, 2) * 2;
				this.bkg.mapData[x][y] = uint8to16(map, mapByte);
				this.obj.mapData[x][y] = uint8to16(map, objByte);
				mapByte += 2;
			};
		};
		mapByte = objByte + 2;
		
		for(let id = 0; id < numBkg; id++) {
			this.bkg.attribute[id] = new Uint16Array(MAX_PARTS_PROP);
			for(dat = 0; dat < MAX_PARTS_PROP; dat++) {
				this.bkg.attribute[id][dat] = uint8to16(map, mapByte);
				mapByte += 2;
			}
		}
		
		objByte = mapByte;
		
		for(let id = 0; id < numObj; id++) {
			this.obj.attribute[id] = new Uint16Array(MAX_PARTS_PROP);
			for(dat = 0; dat < MAX_PARTS_PROP; dat++) {
				this.obj.attribute[id][dat] = uint8to16(map, objByte);
				objByte += 2;
			}
		}
		
		this.pass = this.loadString(str, ptr);
		if (this.pass.length > 0) {
			inputPass = prompt(TEXT_INPUTPASS);
			if (inputPass !== decryptPass(this.pass)) {
				alert(TEXT_WRONGPASS);
				return;
			}
		}
		
		for (let i = 0; i < numMsg; i++) {
			this.message[i] = this.loadString(str, ptr);
		}
		this.worldName = this.loadString(str, ptr);
		
		/* 現在のバージョンでは利用されていないため無視 */
		dummy = this.loadString(str, ptr);
		dummy = this.loadString(str, ptr);
		
		this.imgFileName = this.loadString(str, ptr);
		
		this.sysMsg = [];
		for (let i = 0; i < 20; i++) {
			this.sysMsg[i] = this.loadString(str, ptr);
		}
		
		this.draw.init(this.bkg, this.obj, this.player, this.mapSize, imgFile);
	},
	
	saveFile : function() {
		let i, id, dat, file, element;
		let xmax, ymax;
		let isNullarray;
		let mapByte = 90;
		let objByte;
		let worker = new Worker("compress.js");
		let mapBufferSize = 90 + Math.pow(this.mapSize, 2) * 4 + (this.bkg.attribute.length + this.obj.attribute.length) * 120;
		let mapArray = new Uint8Array(mapBufferSize);
		let strArray = [];
		let maxMapData = Math.max(this.bkg.mapData.length, this.obj.mapData.length) - 1; // lengthは1から数えるため
		
		mapArray[DATA_VERSION] = APP_VERSION;
		uint16to8(mapArray, this.player.energyMax, DATA_ENERGYMAX);
		uint16to8(mapArray, this.player.energy, DATA_ENERGY);
		uint16to8(mapArray, this.player.strength, DATA_STRENGTH);
		uint16to8(mapArray, this.player.defence, DATA_DEFENCE);
		uint16to8(mapArray, this.player.gold, DATA_GOLD);
		uint16to8(mapArray, this.player.x, DATA_PLAYER_X);
		uint16to8(mapArray, this.player.y, DATA_PLAYER_Y);
		uint16to8(mapArray, this.player.overX, DATA_OVER_X);
		uint16to8(mapArray, this.player.overY, DATA_OVER_Y);
		for(i = 0; i < MAX_ITEM; i++) {
			mapArray[DATA_ITEM + i] = this.item[i];
		};
		
		/* マップ画面最大数の検出 */
	// 	for(y = maxMapData; y >= 0; y--) {
	// 		isNullarray = this.bkg.mapData[y].every((array) => {
	// 			return array === 0;
	// 		});
	// 		if(isNullarray) {
	// 			ymax = y;
	// 		}
	// 	};
		uint16to8(mapArray, this.mapSize, DATA_MAPSIZE); // 暫定的
		
		/* マップデータの保存 */
		for (let x = 0; x < this.mapSize; x++) {
			for (let y = 0; y < this.mapSize; y++) {
				objByte = mapByte + Math.pow(this.mapSize, 2) * 2;
				uint16to8(mapArray, this.bkg.mapData[x][y], mapByte);
				uint16to8(mapArray, this.obj.mapData[x][y], objByte);
				mapByte += 2;
			}
		}
		mapByte = objByte + 2;
		
		/* パーツ情報の保存 */
		uint16to8(mapArray, this.bkg.attribute.length, DATA_BKG_LENGTH);
		uint16to8(mapArray, this.obj.attribute.length, DATA_OBJ_LENGTH);
		
		for(id = 0; id < this.bkg.attribute.length; id++) {
			for(dat = 0; dat < 60; dat++) {
				uint16to8(mapArray, this.bkg.attribute[id][dat], mapByte);
				mapByte += 2;
			}
		}
		
		objByte = mapByte;
		
		for(id = 0; id < this.obj.attribute.length; id++) {
			for(dat = 0; dat < 60; dat++) {
				uint16to8(mapArray, this.obj.attribute[id][dat], objByte);
				objByte += 2;
			}
		}
		
		uint16to8(mapArray, this.message.length, DATA_MSG_LENGTH);
		uint16to8(mapArray, getHash(mapArray), DATA_CHECK);
		
		/* メッセージの読み込み */
		this.saveStr(strArray, this.pass);
		for (i = 0; i < this.message.length; i++) {
			this.saveStr(strArray, this.message[i]);
		}
		this.saveStr(strArray, this.worldName);
		this.saveStr(strArray, ""); // 旧バージョンにて利用
		this.saveStr(strArray, ""); // 旧バージョンにて利用
		this.saveStr(strArray, this.imgFileName);
		for (i = 0; i < 20; i++) {
			this.saveStr(strArray, this.sysMsg[i]);
		}
		worker.postMessage({
			map : mapArray,
			str : strArray
		}, [
			mapArray.buffer
		]);
		worker.onmessage = (e) => {
			file = new File([e.data], this.fileName, {
				type : "application/octet-stream"
			});
			element = document.createElement("a");
			element.href = URL.createObjectURL(file);
			document.body.appendChild(element);
			element.click();
			element.parentNode.removeChild(element);
		}
	},
	
	checkFile : function(map, str) {
		let dataCheck = uint8to16(map, DATA_CHECK);
		let dataVersion = map[2];
		if (dataVersion <= 29) {
			alert(TEXT_NOTSUPPORT);
			throw new Error (TEXT_NOTSUPPORT);
		}
		if (getHash(map) !== dataCheck) {
			alert(TEXT_BROKENDATA);
			throw new Error (TEXT_BROKENDATA);
		}
	},
	
	/**
	* バイナリから文字列を読み込む
	* @param {Array|Uint8Array} src バイナリの配列
	* @param {Array} ptr ポインタ（参照の値渡し）
	* @return {String} 文字列
	*/
	loadString : function(src, ptr) {
		let length;
		let buffer = "";
		for(length = 0; length < (MAX_STRING_SIZE / 2 - 1); length++){

			if( (src[ptr[0] + length * 2] == 0) && (src[ptr[0] + length * 2 + 1] == 0) ) {
				ptr[0] += length * 2 + 2;
				break;
			}
			buffer += String.fromCharCode(uint8to16(src, ptr[0] + length * 2));
		}

		return buffer;
	},
	
	/**
	* バイナリから文字列を読み込む
	* @param {Array|Uint8Array} src バイナリの配列
	* @param {Array} ptr ポインタ（参照の値渡し）
	* @return {String} 文字列
	*/
	saveStr : function(src, str) {
		let i, str_;
		let buffer = "";
		for (i = 0; i < str.length; i++) {
			str_ = str.charCodeAt(i)
			if (str_ === 0x0D) {
				continue;
			}
			uint16to8(src, str_, src.length)
		}
		src.push(0, 0);
	}
}

/**
 * 描画を表す
 * @constructor
 */
function Draw(bkg, obj, mapSize) {
	this.bkg = bkg;
	this.obj = obj;
	this.mapSize = mapSize;
	this.img = null;
}

Draw.prototype = {
	init : function(bkg, obj, player, mapSize, image) {
		let bufferImg = new FileReader();
		this.bkg = bkg;
		this.obj = obj;
		this.player = player;
		this.mapSize = mapSize;
		this.img = new Image();
		this.img.onload = () => {
			this.drawAll();
		};
		Array.from(document.querySelectorAll("[data-main-canvas]")).forEach((element) => {
			element.hidden = false;
			element.width = OBJECT_SIZE * this.mapSize;
			element.height = OBJECT_SIZE * this.mapSize;
		});
		bufferImg.readAsDataURL(image);
		bufferImg.onload = (e) => {
			this.img.src = e.target.result;
		};
	},
	
	drawAll : function() {
		let bkg_parts_ctx = $("map_background").getContext('2d');
		let obj_parts_ctx = $("map_object").getContext('2d');
		this.drawMap(bkg_parts_ctx, this.bkg);
		this.drawMap(obj_parts_ctx, this.obj)
		
		let grid_ctx = $("map_grid").getContext('2d');
		let player_ctx = $("map_player").getContext('2d')
		this.drawPlayer(player_ctx);
		this.drawGrid(grid_ctx);
		
		let bkg_selector_ctx = $("selector-bkg").getContext('2d');
		let obj_selector_ctx = $("selector-obj").getContext('2d');
		this.drawSelector(bkg_selector_ctx, this.bkg);
		this.drawSelector(obj_selector_ctx, this.obj);
	},
	
	drawMap : function(ctx, data) {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		for (let x = 0; x < this.mapSize; x++) {
			for (let y = 0; y < this.mapSize; y++) {
				this.drawParts(ctx, data, x, y);
			};
		};
	},
	
	drawParts : function(ctx, parts_data, x, y) {
		let sx = parts_data.getSX(parts_data.mapData[y][x]);
		let sy = parts_data.getSY(parts_data.mapData[y][x]);
		let sw = OBJECT_SIZE;
		let sh = OBJECT_SIZE;
		let dx = x * OBJECT_SIZE;
		let dy = y * OBJECT_SIZE;
		let dw = OBJECT_SIZE;
		let dh = OBJECT_SIZE;
		if (parts_data.mapData[y][x] === 0) {
			/* パーツ0ならば */
			ctx.clearRect(dx, dy, dw, dh);
		} else {
			ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
		};
	},
	
	drawSelector : function(ctx, type) {
		let sx, sy, sw, sh, dx, dy, dw, dh;
		ctx.canvas.width = OBJECT_SIZE * 10;
		ctx.canvas.height = MAX_PARTS * OBJECT_SIZE / ctx.canvas.width * OBJECT_SIZE;
		for(let id = 0; id < type.attribute.length; id++) {
			sx = type.getSX(id);
			sy = type.getSY(id);
			sw = OBJECT_SIZE;
			sh = OBJECT_SIZE;
			dx = Math.floor(id * OBJECT_SIZE % ctx.canvas.width);
			dy = Math.floor(id * OBJECT_SIZE / ctx.canvas.width) * OBJECT_SIZE;
			dw = OBJECT_SIZE;
			dh = OBJECT_SIZE;
			ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
		}
	},
	
	imageSet : function(element, type, id, frame = 1) {
		let ctx = element.getContext('2d');
		let sx = type.getSX(id, frame);
		let sy = type.getSY(id, frame);
		let sw = OBJECT_SIZE;
		let sh = OBJECT_SIZE;
		let dx = 0;
		let dy = 0;
		let dw = OBJECT_SIZE;
		let dh = OBJECT_SIZE;
		element.hidden = (id === 0);
		ctx.clearRect(dx, dy, dw, dh);
		ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
	},
	
	drawSelectedParts : function(id) {
		this.imageSet($("obj-image1"), this.obj, id.obj, 1);
		this.imageSet($("obj-image2"), this.obj, id.obj, 2);
		this.imageSet($("bkg-image"), this.bkg, id.bkg);
	},
	
	drawGrid : function(ctx) {
		for (let x = 0; x < this.mapSize; x++) {
			for (let y = 0; y < this.mapSize; y++) {
				ctx.strokeStyle = "blue";
				ctx.lineWidth = 1;
				
				ctx.beginPath();
				ctx.moveTo(0, y * OBJECT_SIZE + CANVAS_OFFSET);
				ctx.lineTo($("map_grid").width, y * OBJECT_SIZE + CANVAS_OFFSET);
				ctx.moveTo(x * OBJECT_SIZE + CANVAS_OFFSET, 0);
				ctx.lineTo(x * OBJECT_SIZE + CANVAS_OFFSET, $("map_grid").height);
				ctx.closePath();
				ctx.stroke();
				
				ctx.strokeStyle = "red";
				ctx.lineWidth = 2;
				
				ctx.beginPath();
				if (y % 10 === 0 && x % 10 === 0) {
					ctx.moveTo(0, y * OBJECT_SIZE + OBJECT_SIZE / 2);
					ctx.lineTo($("map_grid").width, y * OBJECT_SIZE + OBJECT_SIZE / 2);
					ctx.moveTo(x * OBJECT_SIZE + OBJECT_SIZE / 2, 0);
					ctx.lineTo(x * OBJECT_SIZE + OBJECT_SIZE / 2, $("map_grid").height);
				}
				ctx.closePath();
				ctx.stroke();
			}
		}
	},
	
	drawPlayer : function(ctx) {
		let sx = OBJECT_SIZE * 4;
		let sy = 0;
		let sw = OBJECT_SIZE;
		let sh = OBJECT_SIZE;
		let dx = OBJECT_SIZE * this.player.x;
		let dy = OBJECT_SIZE * this.player.y;
		let dw = OBJECT_SIZE;
		let dh = OBJECT_SIZE;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
	}
}

/**
 * 背景パーツ、物体パーツのスーパークラス
 * @constructor
 */
function Parts() {
	let attribute_ = [];
	this.attribute = new Proxy(attribute_, {
		get: (attribute, id, receiver) => {
			if (typeof attribute[id] === "undefined") {
				attribute[id] = new Uint16Array(MAX_PARTS_PROP);
			}
			return attribute[id];
		}
	});
	this.mapData = [];
}

Parts.prototype = {
	newFile : function(mapSize) {
		this.mapData = Array.from({length: mapSize}, () => Array.from({length: mapSize}, () => 0));
	},
	getSX : function(id, frame = 1) {
		let image = frame === 1 ? DATA_PROP_X : DATA_PROP_X2;
		return this.attribute[id][image];
	},

	getSY : function(id, frame = 1) {
		let image = frame === 1 ? DATA_PROP_Y : DATA_PROP_Y2;
		return this.attribute[id][image];
	},

	setSXSY : function(id, frame = 1, x, y) {
		let imageX = frame === 1 ? DATA_PROP_X : DATA_PROP_X2;
		let imageY = frame === 1 ? DATA_PROP_Y : DATA_PROP_Y2;
		this.attribute[id][imageX] = x;
		this.attribute[id][imageY] = y;
	}
}

/**
 * プレイヤーを表す
 * @constructor
 */
function Player() {
	this.x = 0;
	this.y = 0;
	this.energyMax = 0;
	this.energy = 0;
	this.strength = 0;
	this.defence = 0;
	this.gold = 0;
	this.overX = 0;
	this.overY = 0;
}

/**
 * 背景パーツを表す
 * @constructor
 * @extends Parts
 */
function Bkg(type) {
	Parts.apply(this);
}

Bkg.prototype = Object.create(Parts.prototype);
Bkg.prototype.constructor = Bkg;

/**
 * 物体パーツを表す
 * @constructor
 * @extends Parts
 */
function Obj(type) {
	Parts.apply(this);
}

Obj.prototype = Object.create(Parts.prototype);
Obj.prototype.constructor = Obj;

/**
 * マップデータの情報を描画に伝達する
 * @constructor
 */
function ViewModel(app) {
	let option_xhr = new XMLHttpRequest();
	
	this.app = app;
	this.mode = null;
	this.variable = null;
	this.setting_formdata = null;
	Object.defineProperty(this, "mode", {
		set: (mode) => {
			$("editor-mode").value = mode;
		},
		get: () => {
			return parseInt($("editor-mode").value);
		}
	});
	this.selectedID = {
		bkg : 0,
		obj : 0
	};
	this.ctx = {
		player : $("map_player").getContext('2d'),
		map : {
			bkg : $("map_background").getContext('2d'),
			obj : $("map_object").getContext('2d')
		},
		selector : {
			bkg : $("selector-bkg").getContext('2d'),
			obj : $("selector-obj").getContext('2d')
		}
	};
	
	$("new-file").addEventListener("click", this.newFile.bind(this), false);
	$("open-file").addEventListener("click", this.openFile.bind(this), false);
	$("save-button").addEventListener("click", this.saveFile.bind(this), false);
	$("settings-button").addEventListener("click", this.settingsClicked.bind(this), false);
	$("settings-ok-button").addEventListener("click", this.settingsOKClicked.bind(this), false);
	$("system-button").addEventListener("click", this.systemClicked.bind(this), false);
	$("system-ok-button").addEventListener("click", this.systemOKClicked.bind(this), false);
	$("map_grid").addEventListener("click", this.partsClicked.bind(this), false);
	$("map_grid").addEventListener("contextmenu", this.partsRightClicked.bind(this), false);
	$("map_grid").addEventListener("mousemove", this.showCoords.bind(this), false);
	$("selector-bkg").addEventListener("click", this.selectorClicked.bind(this), false);
	$("selector-obj").addEventListener("click", this.selectorClicked.bind(this), false);
	$("editor-mode").addEventListener("change", this.changeMode.bind(this), false);
	$("bkg-image").addEventListener("click", this.imageClicked.bind(this), false);
	$("obj-image1").addEventListener("click", this.imageClicked.bind(this), false);
	$("obj-image2").addEventListener("click", this.imageClicked.bind(this), false);
	Array.from(document.querySelectorAll("[data-window]")).forEach((element) => {
		element.addEventListener("click", showWindow, false);
	});
	
	option_xhr.onreadystatechange = () => {
		if (option_xhr.readyState === 4) {
			if (option_xhr.status === 200) {
				this.addPartsTypeOption(option_xhr.response);
			}
		}
	};
	option_xhr.open("GET", "option_data.json", true);
	option_xhr.responseType = 'json';
	option_xhr.send(null);
}

ViewModel.prototype = {
	addPartsTypeOption : function(json_src) {
		this.variable = json_src.variable;
		this.setting_formdata = json_src.setting;
		
		["bkg", "obj"].forEach((parts_group) => {
			let element = document.createElement("select");
			element.dataset.group = parts_group;
			element.dataset.subscript = 3;
			this.app.element.setting_form[parts_group].insertBefore(element, element.nextSibling);
			for (let parts_name in json_src[parts_group]) {
				const option = document.createElement("option");
				option.textContent = parts_name;
				
				option.value = json_src[parts_group][parts_name]["data-subscript"];
				option.dataset.attribute = JSON.stringify(json_src[parts_group][parts_name]);
				element.appendChild(option);
			}
			element.addEventListener("change", this.createPartSettingWindow.bind(this), false);
			this.app.element.type_select[parts_group] = element;
		});
	},
	
	createForm : function(attributeAndChildNode, parentNode) {
		Object.keys(attributeAndChildNode).forEach((tag_name) => {
			let element_attribute = attributeAndChildNode[tag_name];
			if (Array.isArray(element_attribute)) {
				element_attribute.forEach((attribute) => {
					let attribute_form = document.createElement(tag_name);
					let textNode = document.createTextNode(attribute["data-name"] || "");
					attribute_form.appendChild(textNode);
					this.createForm(attribute, attribute_form);
					parentNode.appendChild(attribute_form);
				});
			} else {
				parentNode.setAttribute(tag_name, element_attribute);
			};
		});
	},
	
	createLabel : function(alias) {
		let attribute_name = document.createElement('label');
		attribute_name.textContent = alias;
		return attribute_name;
	},
	
	settingsClicked : function(e) {
		this.createSettingsWindow(this.app.element.setting_form.map, this.setting_formdata.map, this.app);
		this.createSettingsWindow(this.app.element.setting_form.player, this.setting_formdata.player, this.app.player);
	},
	
	settingsOKClicked : function(e) {
		this.writeSettingsData(this.app.element.setting_form.map, this.app);
		this.writeSettingsData(this.app.element.setting_form.player, this.app.player);
		this.app.draw.drawPlayer(this.ctx.player);
	},
	
	systemClicked : function(e) {
		this.createSettingsWindow(this.app.element.setting_form.system, this.setting_formdata.system, null);
	},
	
	systemOKClicked : function(e) {
		
	},
	
	writeSettingsData : function(element, group) {
		Array.from(element).forEach((element) => {
			group[element.dataset.subscript] = element.value;
		});
	},
	
	createSettingsWindow : function(element, data, group) {
		while (element.lastChild) {
		    element.removeChild(element.lastChild);
		};
		Object.keys(data).forEach((alias) => {
			let label = this.createLabel(alias, element);
			element.appendChild(label);
			this.createForm(data[alias], element);
		});
		Array.from(element.querySelectorAll("[data-subscript]")).forEach((element) => {
			if (element.dataset.string) {
				let value = element.dataset.subscript;
				element.dataset.messageid = value;
				if (element.dataset.sysmsg) {
					element.value = this.app.sysMsg[value];
				} else {
					element.value = this.app.message[value];
				}
			} else {
				let value = group[element.dataset.subscript];
				element.value = value;
			};
		});
	},
	
	createPartSettingWindow : function(e) {
		const target = e.target || e;
		const formData = JSON.parse(target.options[target.selectedIndex].dataset.attribute).formData;
		const group = target.dataset.group;
		const id = this.selectedID[group];
		const element = this.app.element.setting_form[group];
		while (element.lastChild !== this.app.element.type_select[group]) {
		    element.removeChild(element.lastChild);
		};
		for (let alias of formData) {
			let label = this.createLabel(alias);
			element.appendChild(label);
			this.createForm(this.variable[alias], label);
		};
		Array.from(element.querySelectorAll("[data-subscript]")).forEach((element) => {
			let value = this.app[group]["attribute"][id][element.dataset.subscript];
			if (element.dataset.string) {
				element.dataset.messageid = value;
				element.value = this.app.message[value];
			} else if (element.dataset.typecheckbox) {
				element.checked = Boolean(value);
			} else {
				element.value = value;
			};
		});
	},
	
	showCoords : function(e) {
		let x = Math.floor(e.layerX / OBJECT_SIZE);
		let y = Math.floor(e.layerY / OBJECT_SIZE);
		$("coord-x").textContent = x;
		$("coord-y").textContent = y;
	},
	
	imageClicked : function(e) {
		let container = document.createElement("div");
		container.className = "popup";
		container.id = "image-window";
		container.style.position = "absolute";
		container.style.left = e.clientX + "px";
		container.style.top = e.clientY + "px";
		container.style.right = "auto";
		container.style.bottom = "auto";
		document.body.appendChild(container);
		
		let selector = document.createElement("img");
		selector.src = this.app.draw.img.src;
		selector.dataset.group = e.target.dataset.group;
		selector.dataset.frame = e.target.dataset.frame;
		selector.addEventListener("click", this.imageSelectorClicked.bind(this), false);
		container.appendChild(selector);
	},
	
	imageSelectorClicked : function(e) {
		let group = e.target.dataset.group;
		let x = Math.floor(e.offsetX / OBJECT_SIZE) * OBJECT_SIZE;
		let y = Math.floor(e.offsetY / OBJECT_SIZE) * OBJECT_SIZE;
		
		this.app[group].setSXSY(this.selectedID[group], parseInt(e.target.dataset.frame), x, y);
		this.app.draw.drawMap(this.ctx.map[group], this.app[group]);
		this.app.draw.drawSelector(this.ctx.selector[group], this.app[group]);
		this.app.draw.drawSelectedParts(this.selectedID);
		document.body.removeChild($("image-window"))
	},
	
	changeMode : function(e) {
		this.mode = parseInt(e.target.value);
	},
	
	typeSet : function(element, id) {
		element.parentNode.hidden = (id === 0);
		element.value = this.app[element.dataset.group]["attribute"][id][3];
		this.createPartSettingWindow(element);
	},
	
	newFile: function(e) {
		let imgFile = $("new-img").files[0];
		this.app.newFile(imgFile);
	},
	
	openFile : function(e) {
		let datFile = $("open-dat").files[0];
		let imgFile = $("open-img").files[0];
		let bufferData = new FileReader();
		
		bufferData.readAsArrayBuffer(datFile);
		
		bufferData.onload = (e) => {
			let worker = new Worker("decompress.js");
			let dataArray = bufferData.result;
			worker.postMessage(dataArray, [dataArray]);
			worker.onmessage = (e) => {
				this.app.checkFile(e.data.map);
				this.app.openFile(e.data.map, e.data.str, datFile.name, imgFile);
			};
		};
	},
	
	saveFile : function(e) {
		this.app.saveFile();
	},
	
	partsClicked : function(e) {
		this.writePartsData(this.app.bkg.attribute[this.selectedID.bkg], "bkg");
		this.writePartsData(this.app.obj.attribute[this.selectedID.obj], "obj");
		if (this.mode === APP_MODE_BKG_INSERT) {
			this.insertPart(e, $("map_background"));
		} else if (this.mode === APP_MODE_OBJ_INSERT) {
			this.insertPart(e, $("map_object"));
		} else if (this.mode === APP_MODE_EDIT) {
			this.editPart(e);
		};
	},
	
	partsRightClicked : function(e) {
		e.preventDefault();
		this.writePartsData(this.app.bkg.attribute[this.selectedID.bkg], "bkg");
		this.writePartsData(this.app.obj.attribute[this.selectedID.obj], "obj");
		this.editPart(e);
	},
	
	insertPart : function(e, element) {
		let x = Math.floor(e.layerX / OBJECT_SIZE);
		let y = Math.floor(e.layerY / OBJECT_SIZE);
		let group = element.dataset.group;
		let ctx = element.getContext('2d');
		this.app[group]["mapData"][y][x] = this.selectedID[group];
		this.app.draw.drawParts(ctx, this.app[group], x, y);
	},
	
	editPart : function(e) {
		let x = Math.floor(e.layerX / OBJECT_SIZE);
		let y = Math.floor(e.layerY / OBJECT_SIZE);
		
		["bkg", "obj"].forEach((group) => {
			this.selectedID[group] = this.app[group].mapData[y][x];
			this.typeSet(this.app.element.type_select[group], this.selectedID[group]);
		});
		this.app.draw.drawSelectedParts(this.selectedID);
	},
	
	selectorClicked : function(e) {
		let x = Math.floor(e.layerX / OBJECT_SIZE);
		let y = Math.floor(e.layerY / OBJECT_SIZE);
		let type = e.target.dataset.group;
		if (this.mode !== APP_MODE_EDIT) {
			this.mode = type === "bkg" ? APP_MODE_BKG_INSERT : APP_MODE_OBJ_INSERT;
		};
		this.writePartsData(this.app.bkg.attribute[this.selectedID.bkg], "bkg");
		this.writePartsData(this.app.obj.attribute[this.selectedID.obj], "obj");
		this.selectedID[type] = 10 * y + x;
		this.typeSet(this.app.element.type_select[type], this.selectedID[type]);
		this.app.draw.drawSelectedParts(this.selectedID);
	},
	
	writePartsData : function(attribute, group) {
		if (this.selectedID[group] === 0) {
			return;
		};
		
		Array.from(this.app.element.setting_form[group]).forEach((element) => {
			if (element.dataset.string) {
				if (element.dataset.messageid === "0" && element.value !== "") {
					/* 何もメッセージが入力されていなかったパーツにメッセージが入力された場合 */
					this.app.message.push(element.value);
					element.dataset.messageid = this.app.message.length - 1;
				}
				this.app.message[element.dataset.messageid] = element.value;
				attribute[element.dataset.subscript] = element.dataset.messageid;
			} if (element.dataset.typecheckbox) {
				attribute[element.dataset.subscript] = Number(element.checked);
			} else {
				attribute[element.dataset.subscript] = element.value;
			};
		});
	}
}

})();
