(function () {
'use strict';

const OBJECT_SIZE = 40;
const MAX_ITEM = 12;
const MAX_PARTS = 4000;
const MAX_PARTS_PROP = 60;
const MAX_STRING_SIZE = 1510;
const CANVAS_OFFSET = 0.5;
const APP_VERSION = 31;
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
};

function $(id) {
	return document.getElementById(id);
}

function decryptPass(pass) {
	return (parseInt(pass) - 412660) / 170;
}

function toggleModalBkg(e) {
	let modal = $("modal-background");
	if (modal.hidden) {
		modal.hidden = false;
		$(e.target.dataset.window).hidden = false;
		modal.dataset.window = e.target.dataset.window;
	} else {
		closeModalBkg(e);
	}
}

function closeModalBkg(e) {
	$(e.target.dataset.window).hidden = true;
	$("modal-background").hidden = true;
}

function flatten(matrixArray) {
	return matrixArray.reduce(function(prev, curt) {
		return prev.concat(curt);
	});
}

function setMatrixData(lenX, lenY, data) {
	let matrixData = [];
	for (let x = 0; x < lenX; x++) {
		matrixData[x] = [];
		for (let y = 0; y < lenY; y++) {
			matrixData[x][y] = data();
		}
	}
	return matrixData;
}

class Binary {
	constructor(data) {
		this.data = data;
		this.ptr = 0;
	}

	setPtr(offset) {
		this.ptr = offset !== "" ? offset : this.ptr;
	}

	readByte() {
		return this.data[this.ptr++];
	}

	getHash() {
		let checkData = 0;
		let int8 = new Int8Array(1);
		for (let i = 2; i < this.data.length; i++) {
			int8[0] = this.data[i]; // octetからbyteにキャスト
			checkData += int8[0] * (i % 8 + 1);
		}
		return checkData % 0x10000;
	}

	readAs16bit() {
		return this.data[this.ptr++] + (this.data[this.ptr++] << 8);
	}

	writeByte(data) {
		this.data[this.ptr++] = data;
	}

	writeAs8bit(uint16) {
		let uint16_ = new Uint16Array(1);
		uint16_[0] = uint16;
		let uint8 = new Uint8Array(uint16_.buffer);
		this.data[this.ptr++] = uint8[0];
		this.data[this.ptr++] = uint8[1];
	}

	setAs8bit(array) {
		let uint8 = new Uint8Array(array.buffer);
		this.data.set(uint8, this.ptr);
		this.ptr += uint8.length;
	}

	push(array) {
		this.data.push(array);
		this.ptr = this.data.length;
	}

	writeString(str) {
		for (let i = 0; i < str.length; i++) {
			let str_ = str.charCodeAt(i);
			if (str_ === 0x0D) {
				continue;
			}
			this.writeAs8bit(str_);
		}
		this.writeAs8bit(0);
	}

	loadString() {
		let buffer = "";
		let charcode = 0;
		let count = 0;

		while ((charcode = this.readAs16bit())) {
			if (count++ === MAX_STRING_SIZE) {
				break;
			}
			buffer += String.fromCharCode(charcode);
		}

		return buffer;
	}
}

class App {
	constructor() {
		this.player = null;
		this.obj = null;
		this.bkg = null;
		this.fileName = null;
		this.imgFileName = null;
		this.worldName = "";
		this.pass = "";
		this.item = new Uint8Array(MAX_ITEM);
		this.reference = {
			active: null,
			message: []
		};
	}

	set mapSize(size) {
		if (size !== this.mapSize_) {
			this.mapSize_ = size;
			this.bkg.editor.size = size;
			this.obj.editor.size = size;
			this.mapFace.size = size;
		}
	}

	get mapSize() {
		return this.mapSize_;
	}

	loadImage(image, callback) {
		let bufferImg = new FileReader();
		let img = new Image();
		img.addEventListener("load", (e) => {
			this.player = new Player();
			this.bkg = new Bkg(img, this.reference);
			this.obj = new Obj(img, this.reference);
			this.mapFace = new MapFace(this.bkg, this.obj, this.img, this.reference);
			callback();
			ViewModel.enabledButton();
			this.drawAll();
		});
		img.addEventListener("error", (e) => {
			alert(TEXT_BROKENIMG);
			throw new Error(e);
		});
		bufferImg.readAsDataURL(image);
		bufferImg.onload = (e) => {
			img.src = e.target.result;
		};
	}

	drawAll() {
		this.mapFace.drawAll();
		this.bkg.editor.drawAll();
		this.obj.editor.drawAll();
	}

	newFile(imgFile) {
		this.mapSize = 101;

		this.bkg.newFile(this.mapSize);
		this.obj.newFile(this.mapSize);

		this.fileName = "newmap.dat";
		this.imgData = imgFile;
		this.imgFileName = imgFile.name;
		this.sysMsg = new Array(20).fill("");
		this.reference.message = Array.from({length: 10}, () => "");
	}

	openFile(map, str, fileName, imgFile) {
		this.fileName = fileName;

		map.setPtr(10);
		this.player.energy = map.readAs16bit();
		this.player.strength = map.readAs16bit();
		this.player.defence = map.readAs16bit();
		this.player.gold = map.readAs16bit();

		map.setPtr(20);
		this.item.map(map.readByte, map);
		this.player.energyMax = map.readAs16bit();
		let bkg_length = map.readAs16bit();
		let obj_length = map.readAs16bit();
		this.player.x = map.readAs16bit();
		this.player.y = map.readAs16bit();
		this.player.overX = map.readAs16bit();
		this.player.overY = map.readAs16bit();
		this.mapSize = map.readAs16bit();
		let message_length = map.readAs16bit();

		map.setPtr(90);
		this.bkg.mapData = setMatrixData(this.mapSize, this.mapSize, map.readAs16bit.bind(map));
		this.obj.mapData = setMatrixData(this.mapSize, this.mapSize, map.readAs16bit.bind(map));
		this.bkg.attribute = setMatrixData(bkg_length, MAX_PARTS_PROP, map.readAs16bit.bind(map));
		this.obj.attribute = setMatrixData(obj_length, MAX_PARTS_PROP, map.readAs16bit.bind(map));

		if ((this.pass = str.loadString())) {
			let inputPass = prompt(TEXT_INPUTPASS);
			if (inputPass !== decryptPass(this.pass)) {
				alert(TEXT_WRONGPASS);
				return;
			}
		}

		this.reference.message = Array.apply(null, Array(message_length)).map(str.loadString, str);
		this.worldName = str.loadString();

		/* 次の2つは現在のバージョンでは使われていない */
		let dummy;
		dummy = str.loadString();
		dummy = str.loadString();

		this.imgData = imgFile;
		this.imgFileName = str.loadString();
		this.sysMsg = Array.apply(null, Array(20)).map(str.loadString, str);
	}

	saveFile(callback) {
		let mapBufferSize = 90 + Math.pow(this.mapSize, 2) * 4 + (this.bkg.attribute.length + this.obj.attribute.length) * 120;
		let mapArray = new Uint8Array(mapBufferSize);
		let map = new Binary(mapArray);
		map.setPtr(2);
		map.writeByte(APP_VERSION);

		map.setPtr(10);
		map.writeAs8bit(this.player.energy);
		map.writeAs8bit(this.player.strength);
		map.writeAs8bit(this.player.defence);
		map.writeAs8bit(this.player.gold);

		map.setPtr(20);
		for(let i = 0; i < MAX_ITEM; i++) {
			map.writeByte(this.item[i]);
		}
		map.writeAs8bit(this.player.energyMax);
		map.writeAs8bit(this.bkg.attribute.length);
		map.writeAs8bit(this.obj.attribute.length);
		map.writeAs8bit(this.player.x);
		map.writeAs8bit(this.player.y);
		map.writeAs8bit(this.player.overX);
		map.writeAs8bit(this.player.overY);
		map.writeAs8bit(this.mapSize);
		map.writeAs8bit(this.reference.message.length);

		map.setPtr(90);
		map.setAs8bit(new Uint16Array(flatten(this.bkg.mapData)));
		map.setAs8bit(new Uint16Array(flatten(this.obj.mapData)));
		map.setAs8bit(new Uint16Array(flatten(this.bkg.attribute)));
		map.setAs8bit(new Uint16Array(flatten(this.obj.attribute)));

		map.setPtr(0);
		map.writeAs8bit(map.getHash());

		let strArray = [];
		let str = new Binary(strArray);
		str.writeString(this.pass);
		for (let i = 0; i < this.reference.message.length; i++) {
			str.writeString(this.reference.message[i]);
		}
		str.writeString(this.worldName);

		/* 次の2つは現在のバージョンでは使われていない */
		str.writeString("");
		str.writeString("");

		str.writeString(this.imgFileName);
		for (let i = 0; i < 20; i++) {
			str.writeString(this.sysMsg[i]);
		}

		let worker = new Worker("compress.js");
		worker.postMessage({
			map : mapArray,
			str : strArray
		}, [
			mapArray.buffer
		]);
		worker.onmessage = (e) => {
			let file = new File([e.data], this.fileName, {
				type : "application/octet-stream"
			});
			let url = URL.createObjectURL(file);
			callback(url);
		};
	}

	downloadFile(url) {
		let element = document.createElement("a");
		element.href = url;
		document.body.appendChild(element);
		element.click();
		element.parentNode.removeChild(element);
	}

	checkFile(map, str) {
		let dataCheck = map.readAs16bit();
		let dataVersion = map.readByte(2);
		if (dataVersion <= 29) {
			alert(TEXT_NOTSUPPORT);
			throw new Error (TEXT_NOTSUPPORT);
		}
		if (map.getHash() !== dataCheck) {
			alert(TEXT_BROKENDATA);
			throw new Error (TEXT_BROKENDATA);
		}
	}
}

class GameObject {
	constructor(reference, img, jsonSrc, mapElement, selectorElement, imageElements, imgListElement) {
		this.mapData = null;
		this.reference = reference;
		this.editor = new Editor(this, img, this.reference, jsonSrc, mapElement, selectorElement, imageElements, imgListElement);
	}

	set attribute(value) {
		this.attribute_ = new Proxy(value, {
			get: (attribute, id) => {
				if (typeof attribute[id] === "undefined") {
					attribute[id] = new Uint16Array(MAX_PARTS_PROP);
				}
				return attribute[id];
			}
		});
	}

	get attribute() {
		return this.attribute_;
	}

	newFile(mapSize) {
		this.mapData = Array.from({length: mapSize}, () => Array.from({length: mapSize}, () => 0));
		this.attribute = [];
	}

	getSX(id, frame = 0) {
		let image = frame === 0 ? DATA_PROP_X : DATA_PROP_X2;
		return this.attribute[id][image];
	}

	getSY(id, frame = 0) {
		let image = frame === 0 ? DATA_PROP_Y : DATA_PROP_Y2;
		return this.attribute[id][image];
	}

	setSXSY(id, x, y, frame = 0) {
		let imageX = frame === 0 ? DATA_PROP_X : DATA_PROP_X2;
		let imageY = frame === 0 ? DATA_PROP_Y : DATA_PROP_Y2;
		this.attribute[id][imageX] = x;
		this.attribute[id][imageY] = y;
	}

	write(id, element) {
		if (id === 0) {
			return;
		}
		this.attribute[id][element.dataset.subscript] = (() => {
			if (element.dataset.string) {
				if (element.dataset.messageid === "0" && element.value) {
					/* 何もメッセージが入力されていなかったパーツにメッセージが入力された場合 */
					this.reference.message.push(element.value);
					element.dataset.messageid = this.reference.message.length - 1;
				}
				this.reference.message[element.dataset.messageid] = element.value;
				return element.dataset.messageid;
			} else if (element.getAttribute("type") === "checkbox") {
				return Number(element.checked);
			} else if (element.dataset.relative) {
				if (element.value === "P") {
					return 9000;
				} else if (element.value[0] === "+") {
					return parseInt(element.value.replace(/[^0-9^\.]/g,"")) + 10000;
				} else if (element.value[0] === "-") {
					return 10000 - parseInt(element.value.replace(/[^0-9^\.]/g,""));
				}
			}
			return element.value;
		})();
	}
}
class Bkg extends GameObject{
	constructor(img, reference) {
		super(reference, img, "bkg.json", $("map_background"), $("selector-bkg"), [
			$("bkg-image")
		], $("bkg-list"));
		this.element = {
			setting : $("background-settings"),
			type_select : null
		};
	}
}

class Obj extends GameObject{
	constructor(img, reference) {
		super(reference, img, "obj.json", $("map_object"), $("selector-obj"), [
			$("obj-image1"),
			$("obj-image2")
		], $("obj-list"));
		this.element = {
			setting : $("object-settings"),
			type_select : null
		};
	}
}

class Canvas {
	constructor(img, ctx) {
		this.img = img;
		this.ctx = ctx;
	}

	drawWithoutZeroParts(parts_num, sx, sy, dx, dy) {
		if (parts_num === 0) {
			this.clearParts(dx, dy);
		} else {
			this.drawParts(sx, sy, dx, dy);
		}
	}

	drawParts(sx, sy, dx = 0, dy = 0) {
		this.clearParts(dx, dy);
		this.ctx.drawImage(this.img, sx, sy, OBJECT_SIZE, OBJECT_SIZE, dx, dy, OBJECT_SIZE, OBJECT_SIZE);
	}

	clearParts(dx, dy) {
		this.ctx.clearRect(dx, dy, OBJECT_SIZE, OBJECT_SIZE);
	}

	drawRectByID(id) {
		let x = Math.floor(id * OBJECT_SIZE % this.ctx.canvas.width);
		let y = Math.floor(id * OBJECT_SIZE / this.ctx.canvas.width) * OBJECT_SIZE;
		this.ctx.strokeStyle = "red";
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		const offset = this.ctx.lineWidth / 2;
		this.ctx.rect(x + offset, y + offset, OBJECT_SIZE - this.ctx.lineWidth, OBJECT_SIZE - this.ctx.lineWidth);
		this.ctx.closePath();
		this.ctx.stroke();
	}
}

class Player {
	constructor() {
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
}

class MapFace {
	constructor(bkg, obj, img, reference) {
		this.bkg = bkg;
		this.obj = obj;
		this.reference = reference;
		this.gameObj = this.bkg.editor;
		this.element = $("map_grid");
		this.element.addEventListener("click", this.onClick.bind(this), false);
		this.element.addEventListener("mousedown", this.startSelect.bind(this), false);
		this.element.addEventListener("mouseup", this.endSelect.bind(this), false);
		this.element.addEventListener("contextmenu", this.onContextmenu.bind(this), false);
		this.element.addEventListener("mousemove", this.updateCoords.bind(this), false);
	}

	set size(size) {
		this.size_ = size;
		let pxsize = OBJECT_SIZE * size;
		this.element.width = pxsize;
		this.element.height = pxsize;
	}

	get size() {
		return this.size_;
	}

	drawAll() {
		let ctx = this.element.getContext("2d");
		for (let x = 0; x < this.size; x++) {
			for (let y = 0; y < this.size; y++) {
				ctx.strokeStyle = "blue";
				ctx.lineWidth = 1;

				ctx.beginPath();
				ctx.moveTo(0, y * OBJECT_SIZE + CANVAS_OFFSET);
				ctx.lineTo(this.element.width, y * OBJECT_SIZE + CANVAS_OFFSET);
				ctx.moveTo(x * OBJECT_SIZE + CANVAS_OFFSET, 0);
				ctx.lineTo(x * OBJECT_SIZE + CANVAS_OFFSET, this.element.height);
				ctx.closePath();
				ctx.stroke();

				ctx.strokeStyle = "red";
				ctx.lineWidth = 2;

				ctx.beginPath();
				if (y % 10 === 0 && x % 10 === 0) {
					ctx.moveTo(0, y * OBJECT_SIZE + OBJECT_SIZE / 2);
					ctx.lineTo(this.element.width, y * OBJECT_SIZE + OBJECT_SIZE / 2);
					ctx.moveTo(x * OBJECT_SIZE + OBJECT_SIZE / 2, 0);
					ctx.lineTo(x * OBJECT_SIZE + OBJECT_SIZE / 2, this.element.height);
				}
				ctx.closePath();
				ctx.stroke();
			}
		}
	}

	onClick(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE);
		let y = Math.floor(e.offsetY / OBJECT_SIZE);
		[this.bkg, this.obj].forEach((obj) => {
			if (this.reference.active === obj.constructor) {
				this.gameObj = obj.editor;
			}
		});
		this.gameObj.writeAllData();
		let id = this.gameObj.insertPart(e);
		this.gameObj.canvas.drawWithoutZeroParts(id, this.gameObj.data.getSX(id), this.gameObj.data.getSY(id), x * OBJECT_SIZE, y * OBJECT_SIZE);
	}

	onContextmenu(e) {
		e.preventDefault();
		[this.bkg.editor, this.obj.editor].forEach((obj) => {
			obj.writeAllData();
			obj.editPart(e);
		});
	}

	startSelect(e) {
		this.selected = {
			x : Math.floor(e.offsetX / OBJECT_SIZE),
			y : Math.floor(e.offsetY / OBJECT_SIZE)
		};
	}

	endSelect(e) {
		let x = {
			min : Math.min(Math.floor(e.offsetX / OBJECT_SIZE), this.selected.x),
			max : Math.max(Math.floor(e.offsetX / OBJECT_SIZE), this.selected.x)
		};
		let y = {
			min : Math.min(Math.floor(e.offsetY / OBJECT_SIZE), this.selected.y),
			max : Math.max(Math.floor(e.offsetY / OBJECT_SIZE), this.selected.y)
		};

		for (let i = x.min; i <= x.max; i++) {
			for (let j = y.min; j <= y.max; j++) {
				this.onClick({
					offsetX : i * OBJECT_SIZE,
					offsetY : j * OBJECT_SIZE
				});
			}
		}
		this.selected = null;
	}

	updateCoords(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE);
		let y = Math.floor(e.offsetY / OBJECT_SIZE);
		$("coord-x").textContent = x;
		$("coord-y").textContent = y;
	}
}

class Editor {
	constructor(data, img, reference, jsonSrc, mapElement, selectorElement, imageElements, imgListElement) {
		this.data = data;
		this.img = img;
		this.map_element = mapElement;
		this.variable = null;
		this.setting_formdata = null;
		this.selector = new Selector(data, img, reference, this, selectorElement);
		this.canvas = new Canvas(img, this.map_element.getContext('2d'));
		this.image_canvas = [];

		this.image_elements = imageElements;
		this.image_elements.forEach((element, index) => {
			this.image_canvas[index] = new Canvas(img, element.getContext('2d'));
			element.addEventListener("click", this.imageClicked.bind(this), false);
			element.dataset.frame = index;
		});

		this.imglist_element = imgListElement;
		this.imglist_element.addEventListener("click", this.imgListClicked.bind(this), false);
		this.imglist_element.src = this.img.src;
		this.imglist_element.style.width = 0;

		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					this.addType(xhr.response);
				}
			}
		};
		xhr.open("GET", jsonSrc, true);
		xhr.responseType = 'json';
		xhr.send(null);
	}

	set size(size) {
		let pxsize = OBJECT_SIZE * size;
		this.map_element.width = pxsize;
		this.map_element.height = pxsize;
		this.selector.element.width = OBJECT_SIZE * 10;
		this.selector.element.height = MAX_PARTS / 10 * OBJECT_SIZE;
	}

	set selectedID(id) {
		this.selector.drawSelected(this.selectedID_, id);
		this.selectedID_ = id;
		this.drawImage();
	}

	get selectedID() {
		return this.selectedID_;
	}

	drawAll() {
		this.drawMap();
		this.drawImage();
		this.selector.draw();
		this.selector.drawSelected(this.selectedID, this.selectedID);
	}

	drawMap() {
		for (let x = 0; x < this.data.mapData.length; x++) {
			for (let y = 0; y < this.data.mapData.length; y++) {
				let parts = this.data.mapData[y][x];
				this.canvas.drawWithoutZeroParts(parts, this.data.getSX(parts), this.data.getSY(parts), x * OBJECT_SIZE, y * OBJECT_SIZE);
			}
		}
	}

	drawImage() {
		this.image_elements.forEach((_, i) => {
			let id = this.selectedID;
			this.image_canvas[i].drawParts(this.data.getSX(id, i), this.data.getSY(id, i));
		});
	}

	imageClicked(e) {
		this.imglist_element.dataset.frame = e.target.dataset.frame;
		this.imglist_element.style.width = "auto";
	}

	imgListClicked(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE) * OBJECT_SIZE;
		let y = Math.floor(e.offsetY / OBJECT_SIZE) * OBJECT_SIZE;
		this.data.setSXSY(this.selectedID, x, y, parseInt(e.target.dataset.frame));
		this.drawAll();
		this.imglist_element.style.width = 0;
	}

	addType(json) {
		this.variable = json.variable;
		this.setting_formdata = json.setting;

		let element = document.createElement("select");
		element.dataset.subscript = 3;
		this.data.element.setting.insertBefore(element, element.nextSibling);
		for (let parts_name in json.data) {
			const option = document.createElement("option");
			option.textContent = parts_name;

			option.value = json.data[parts_name]["data-subscript"];
			option.dataset.attribute = JSON.stringify(json.data[parts_name]);
			element.appendChild(option);
		}
		element.addEventListener("change", this.typeChanged.bind(this), false);
		this.data.element.type_select = element;
	}

	typeChanged(e) {
		const type = this.data.element.type_select;
		this.data.write(this.selectedID, type);
		this.createSettingForm();
	}

	createSettingForm() {
		const target = this.data.element.type_select;
		target.value = this.data.attribute[this.selectedID][3];

		const formData = JSON.parse(target.options[target.selectedIndex].dataset.attribute).formData;
		const element = this.data.element.setting;

		while (element.lastChild !== target) {
		    element.removeChild(element.lastChild);
		}
		for (let alias of formData) {
			CreateDOM.createLabelAndForm(element, alias, this.variable);
		}
		Array.from(element.querySelectorAll("[data-subscript]")).forEach((element) => {
			let value = this.data.attribute[this.selectedID][element.dataset.subscript];
			if (element.dataset.string) {
				element.dataset.messageid = value;
				element.value = this.data.reference.message[value];
			} else if (element.dataset.typecheckbox) {
				element.checked = Boolean(value);
			} else if (element.dataset.relative) {
				if (value === 9000) {
					element.value = "P";
				} else if (value === 10000) {
					element.value = "+0";
				} else if (value > 10000 && value < 11000) {
					element.value = "+" + (value - 10000);
				} else if (value < 10000 && value > 9000) {
					element.value = value - 10000;
				} else {
					element.value = value;
				}
			} else {
				element.value = value;
			}
		});
	}

	editPart(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE);
		let y = Math.floor(e.offsetY / OBJECT_SIZE);
		this.writeAllData();
		this.selectedID = this.data.mapData[y][x];
		this.createSettingForm();
	}

	insertPart(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE);
		let y = Math.floor(e.offsetY / OBJECT_SIZE);
		this.data.mapData[y][x] = this.selectedID;
		return this.selectedID;
	}

	writeAllData() {
		Array.from(this.data.element.setting).forEach((element) => {
			this.data.write(this.selectedID, element);
		});
	}
}

class CreateDOM {
	static createLabelAndForm(element, alias, data) {
		let label = this.createLabel(alias);
		element.appendChild(label);
		this.createForm(data[alias], label);
	}

	static createLabel(alias) {
		let attribute_name = document.createElement('label');
		attribute_name.textContent = alias;
		return attribute_name;
	}

	static createForm(attributeAndChildNode, parentNode) {
		Object.keys(attributeAndChildNode).forEach((tag_name) => {
			let element_attribute = attributeAndChildNode[tag_name];
			if (Array.isArray(element_attribute)) {
				element_attribute.forEach((attribute) => {
					let attribute_form = document.createElement(tag_name);
					let textNode = document.createTextNode(attribute["data-name"] || "");
					attribute_form.appendChild(textNode);
					CreateDOM.createForm(attribute, attribute_form);
					parentNode.appendChild(attribute_form);
				});
			} else {
				parentNode.setAttribute(tag_name, element_attribute);
			}
		});
	}
}

class Selector {
	constructor(data, img, reference, editor, element) {
		this.data = data;
		this.canvas = new Canvas(img, element.getContext('2d'));
		this.reference = reference;
		this.editor = editor;
		this.element = element;
		this.element.addEventListener("click", this.onClick.bind(this), false);
	}

	draw() {
		for(let id = 1; id < this.data.attribute.length; id++) {
			let dx = Math.floor(id * OBJECT_SIZE % this.element.width);
			let dy = Math.floor(id * OBJECT_SIZE / this.element.width) * OBJECT_SIZE;
			this.canvas.drawParts(this.data.getSX(id), this.data.getSY(id), dx, dy);
		}
	}

	drawSelected(oldID = 0, newID = 0) {
		let dx = Math.floor(oldID * OBJECT_SIZE % this.element.width);
		let dy = Math.floor(oldID * OBJECT_SIZE / this.element.width) * OBJECT_SIZE;
		this.canvas.clearParts(dx, dy);
		this.canvas.drawParts(this.data.getSX(oldID), this.data.getSY(oldID), dx, dy);
		this.canvas.drawRectByID(newID);
	}

	onClick(e) {
		let x = Math.floor(e.offsetX / OBJECT_SIZE);
		let y = Math.floor(e.offsetY / OBJECT_SIZE);
		this.reference.active = this.data.constructor;
		this.editor.writeAllData();
		this.editor.selectedID = 10 * y + x;
		this.editor.createSettingForm();
	}
}

class ViewModel {
	constructor(app) {
		this.app = app;

		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					$("settings-button").hidden = false;
					$("system-button").hidden = false;
					this.setting_data = xhr.response;
				}
			}
		};
		xhr.open("GET", "setting.json", true);
		xhr.responseType = 'json';
		xhr.send(null);

		$("new-file").addEventListener("click", this.newFileClicked.bind(this), false);
		$("open-file").addEventListener("click", this.openFileClicked.bind(this), false);
		$("save-button").addEventListener("click", this.saveFileClicked.bind(this), false);
		$("preview-button").addEventListener("click", this.previewClicked.bind(this), false);
		$("settings-button").addEventListener("click", this.settingsClicked.bind(this), false);
		$("settings-ok-button").addEventListener("click", this.settingsOKClicked.bind(this), false);
		$("system-button").addEventListener("click", this.systemClicked.bind(this), false);
		$("system-ok-button").addEventListener("click", this.systemOKClicked.bind(this), false);
		Array.from(document.querySelectorAll("[data-window]")).forEach((element) => {
			element.addEventListener("click", toggleModalBkg, false);
		});
		$("modal-background").addEventListener("click", closeModalBkg, false);
	}

	static enabledButton() {
		Array.from(document.querySelectorAll('input[type="button"][disabled]')).forEach((element) => {
			element.removeAttribute("disabled");
		});
	}

	newFileClicked(e) {
		let imgFile = $("new-img").files[0];
		this.app.loadImage(imgFile, (() => this.app.newFile(imgFile)));
	}

	openFileClicked(e) {
		let datFile = $("open-dat").files[0];
		let imgFile = $("open-img").files[0];
		let bufferData = new FileReader();

		bufferData.readAsArrayBuffer(datFile);

		bufferData.onload = (e) => {
			let worker = new Worker("decompress.js");
			let dataArray = bufferData.result;
			worker.postMessage(dataArray, [dataArray]);
			worker.onmessage = (e) => {
				let map = new Binary(e.data.map);
				let str = new Binary(e.data.str);
				this.app.checkFile(map);
				this.app.loadImage(imgFile, (() => this.app.openFile(map, str, datFile.name, imgFile)));
			};
		};
	}

	saveFileClicked(e) {
		this.app.saveFile(this.app.downloadFile);
	}

	previewClicked(e) {
			while ($("wing-container").lastChild) {
			    $("wing-container").removeChild($("wing-container").lastChild);
			}

			this.app.saveFile((url) => {
				let audio_script = document.createElement("script");
				audio_script.src = "WWAWing/audio/audio.min.js";
				document.head.appendChild(audio_script);

				let wwa = document.createElement("script");
				wwa.src = "WWAWing/wwa.js";
				document.head.appendChild(wwa);

				let wwaload = document.createElement("script");
				wwaload.src = "WWAWing/wwaload.noworker.js";
				document.head.appendChild(wwaload);

				let container = document.createElement("div");
				container.id = "wwa-wrapper";
				container.className = "wwa-size-box";
				container.dataset.wwaLoader = "WWAWing/wwaload.js";
				container.dataset.wwaUrlgateEnable = true;
				container.dataset.wwaImgdata = this.app.draw.img.src;
				container.dataset.wwaTitleImg = "WWAWing/cover.gif";
				container.dataset.wwaMapdata = url;
				$("preview-window").style.width = "700px";
				$("preview-window").style.height = "600px";
				$("wing-container").appendChild(container);
			});
	}

	settingsClicked() {
		this.addSetting(this.element.map, this.app, this.setting_data.map);
		this.addSetting(this.element.player, this.app.player, this.setting_data.player);
	}

	systemClicked(e) {
		this.addSetting(this.element.system, null, this.setting_data.system);
	}

	addSetting(element, target, data) {
		while (element.lastChild) {
		    element.removeChild(element.lastChild);
	    	}
		Object.keys(data).forEach((alias) => {
			CreateDOM.createLabelAndForm(element, alias, data);
		});
		Array.from(element.querySelectorAll("[data-subscript]")).forEach((element) => {
			if (element.dataset.string) {
				let value = element.dataset.subscript;
				element.dataset.messageid = value;
				if (element.dataset.sysmsg) {
					element.value = this.app.sysMsg[value];
				} else {
					element.value = this.app.reference.message[value];
				}
			} else {
				let value = target[element.dataset.subscript];
				element.value = value;
			}
		});
	}

	settingsOKClicked(e) {
		this.writeSettingsData(this.element.map, this.app);
		this.writeSettingsData(this.element.player, this.app.player);
		this.app.drawAll();
	}

	systemOKClicked(e) {
		this.writeSettingsData(this.element.system, null);
	}

	writeSettingsData(element, target) {
		Array.from(element).forEach((element) => {
			if (element.dataset.string) {
				let value = element.dataset.subscript;
				if (element.dataset.sysmsg) {
					this.app.sysMsg[value] = element.value;
				} else {
					this.app.message[value] = element.value;
				}
			} else {
				target[element.dataset.subscript] = parseInt(element.value);
			}
		});
	}
}
})();
