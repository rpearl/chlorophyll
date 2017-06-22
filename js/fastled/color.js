FastLED = Module;

var hsv2rgb = function(hue, sat, val) {
	var h = 360*(hue/255), s = sat/255, v = val/255;
	var rgb, i, data = [];
	if (s === 0) {
		rgb = [v,v,v];
	} else {
		h = h / 60;
		i = Math.floor(h);
		data = [v*(1-s), v*(1-s*(h-i)), v*(1-s*(1-(h-i)))];
		switch(i) {
			case 0:
				rgb = [v, data[2], data[0]];
				break;
			case 1:
				rgb = [data[1], v, data[0]];
				break;
			case 2:
				rgb = [data[0], v, data[2]];
				break;
			case 3:
				rgb = [data[0], data[1], v];
				break;
			case 4:
				rgb = [data[2], data[0], v];
				break;
			default:
				rgb = [v, data[0], data[1]];
				break;
		}
	}
	return rgb[0]*255 << 16 | rgb[1]*255 << 8 | rgb[2]*255;
}

function CHSV(h, s, v) {
	this.h = h;
	this.s = s;
	this.v = v;
}

function CRGB(r, g, b) {
	this.r = r;
	this.g = g;
	this.b = b;
}

function make_node(target, name, args, code) {
	var output, hasThis;
	// expose as normal code
	target[name] = code;

	// now expose to GraphLib
	var arglist = args.slice();

	if (target.prototype == undefined) { // this is on the prototype
		output = target.constructor.name;
		arglist.unshift([output, output]);
		hasThis = true;
	} else {
		output = target.name;
		hasThis = false;
	}


	var f = function() {
		for (var arg of arglist) {
			this.addInput(arg[0], arg[1]);
		}
		this.addOutput(output, output);
	}

	f.title = output + '.' + name;

	f.prototype.onExecute = function() {
		var values = [];

		for (var i = 0; i < arglist.length; i++) {
			values.push(this.getInputData(i).valueOf());
		}

		var that = undefined;

		if (hasThis) {
			that = values.shift();
		}
		this.setOutputData(0, code.apply(that, values));
	}

	GraphLib.registerNodeType(output+'/'+name, f);
}

CRGB.fromColorCode = function(colorCode) {
	var c = new CRGB();
	return c.setColorCode(colorCode);
}

CRGB.prototype.setColorCode = function(colorCode) {
	this.r = (colorCode >> 16) & 0xFF;
	this.g = (colorCode >>  8) & 0xFF;
	this.b = (colorCode >>  0) & 0xFF;
	return this;
}

make_node(CRGB, 'construct', [['r', Units.UInt8], ['g', Units.UInt8], ['b', Units.UInt8]], function(r,g,b) {
	return new CRGB(r,g,b);
});

make_node(CRGB, 'fromHSV', [['hue', Units.UInt8], ['sat', Units.UInt8], ['val', Units.UInt8]], function(hue, sat, val) {
	return CRGB.fromColorCode(hsv2rgb(hue, sat, val));
});

make_node(CRGB, 'fromHue', [['hue', Units.UInt8]], function(hue) {
	return CRGB.fromColorCode(hsv2rgb(hue, 255, 255));
});

make_node(CRGB.prototype, 'setHue', [['hue', Units.UInt8]],  function(hue) {
	var ccode = hsv2rgb(hue, 255, 255);
	this.setColorCode(ccode);
	return this;
});

make_node(CRGB.prototype, 'add', [['rhs', 'color']], function(rhs) {
	this.r = Math8.qadd8(this.r, rhs.r);
	this.g = Math8.qadd8(this.g, rhs.g);
	this.b = Math8.qadd8(this.b, rhs.b);
	return this;
});

make_node(CRGB.prototype, 'addToRGB', [['d', Units.UInt8]], function(d) {
	this.r = Math8.qadd8(this.r, d);
	this.g = Math8.qadd8(this.g, d);
	this.b = Math8.qadd8(this.b, d);
	return this;
});

make_node(CRGB.prototype, 'inc', [], function() {
	return this.addToRGB(1);
});

make_node(CRGB.prototype, 'subtract', [['rhs', 'color']], function(rhs) {
	this.r = Math8.qsub8(this.r, rhs.r);
	this.g = Math8.qsub8(this.g, rhs.g);
	this.b = Math8.qsub8(this.b, rhs.b);
	return this;
});

make_node(CRGB.prototype, 'subtractFromRGB', [['d', Units.UInt8]], function(d) {
	this.r = Math8.qsub8(this.r, d);
	this.g = Math8.qsub8(this.g, d);
	this.b = Math8.qsub8(this.b, d);
	return this;
});

make_node(CRGB.prototype, 'dec', [], function() {
	return this.subtractFromRGB(1);
});

make_node(CRGB.prototype, 'div', [['d', Units.UInt8]], function(d) {
	this.r /= d;
	this.g /= d;
	this.b /= d;
	return this;
});

make_node(CRGB.prototype, 'rsh', [['d', Units.UInt8]], function(d) {
	this.r >>= d;
	this.g >>= d;
	this.b >>= d;
	return this;
});

make_node(CRGB.prototype, 'mul', [['d', Units.UInt8]], function(d) {
	this.r = Math8.qmul8(this.r, d);
	this.g = Math8.qmul8(this.g, d);
	this.b = Math8.qmul8(this.b, d);
	return this;
});

make_node(CRGB.prototype,'nscale8_video', [['scaledown', Units.UInt8]], function(scaledown) {
	return this.setColorCode(Math8.nscale8x3_video(this.r, this.b, this.g, scaledown));
});

make_node(CRGB.prototype,'fadeLightBy', [['fadefactor', Units.UInt8]], function(fadefactor) {
	return this.setColorCode(Math8.nscale8x3_video(this.r, this.g, this.b, 255-fadefactor));
});

make_node(CRGB.prototype,'nscale8', [['scaledown', Units.UInt8]], function(scaledown) {
	return this.setColorCode(Math8.nscale8x3(this.r, this.b, this.g, scaledown));
});

make_node(CRGB.prototype,'nscale8_each', [['rgb', 'color']], function(rgb) {
	this.r = Math8.scale8(this.r, rgb.r);
	this.g = Math8.scale8(this.g, rgb.g);
	this.b = Math8.scale8(this.b, rgb.b);
	return this;
});

make_node(CRGB.prototype,'fadeToBlackBy', [['fadefactor', Units.UInt8]], function(fadefactor) {
	return this.setColorCode(Math8.nscale8x3(this.r, this.g, this.b, 255-fadefactor));
});

make_node(CRGB.prototype,'or_each', [['rhs', 'color']], function(rhs) {
	if (rhs.r > this.r) this.r = rhs.r;
	if (rhs.g > this.g) this.g = rhs.g;
	if (rhs.b > this.b) this.b = rhs.b;
	return this;
});

make_node(CRGB.prototype,'or', [['d', Units.UInt8]], function(d) {
	if (d > this.r) this.r = d;
	if (d > this.g) this.g = d;
	if (d > this.b) this.b = d;
	return this;
});

make_node(CRGB.prototype,'and_each', [['rhs', 'color']], function(rhs) {
	if (rhs.r < this.r) this.r = rhs.r;
	if (rhs.g < this.g) this.g = rhs.g;
	if (rhs.b < this.b) this.b = rhs.b;
	return this;
});

make_node(CRGB.prototype,'and', [['d', Units.UInt8]], function(d) {
	if (d < this.r) this.r = d;
	if (d < this.g) this.g = d;
	if (d < this.b) this.b = d;
	return this;
});

make_node(CRGB.prototype,'invert', [], function() {
	this.r = 255 - this.r;
	this.g = 255 - this.g;
	this.b = 255 - this.b;
	return this;
});

make_node(CRGB.prototype,'lerp8', [['other', Units.UInt8], ['frac', Units.UInt8]], function(other, frac) {
	var r = Math8.lerp8by8(this.r, other.r, frac);
	var g = Math8.lerp8by8(this.g, other.g, frac);
	var b = Math8.lerp8by8(this.b, other.b, frac);
	return new CRGB(r,g,b);
});

make_node(CRGB.prototype,'lerp16', [['other', Units.UInt8], ['frac', Units.UInt16]], function(other, frac) {
	var r = Math8.lerp16by16(this.r, other.r, frac);
	var g = Math8.lerp16by16(this.g, other.g, frac);
	var b = Math8.lerp16by16(this.b, other.b, frac);
	return new CRGB(r,g,b);
});
