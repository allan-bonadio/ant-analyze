//
// gen complex -- generate complex arithmetic blanket plots
//

import {hsl} from 'd3-color';


// pass it either a svg2d or webgl3d object, and it'll maybe call xxx.calcPoints()
// if it needs to, and remembers stuff for next time
export function ensureCalcPoints(graphComp) {
	let s = graphComp.state;
	
	// note how the y values are undefined for 2d but undefined==undefined so it works
	if (s.renderedIndex === graphComp.lastTimeRenderedIndex && 
				s.xMin == graphComp.lastTimeXMin && s.xMax == graphComp.lastTimeXMax &&
				s.yMin == graphComp.lastTimeYMin && s.yMax == graphComp.lastTimeYMax)
		return;  // it'll be the same
	
	graphComp.calcPoints();
	
	// save these so we can tell if calc needs to be redone
	graphComp.lastTimeRenderedIndex = s.renderedIndex;
	graphComp.lastTimeXMin = s.xMin;
	graphComp.lastTimeXMax = s.xMax;
	graphComp.lastTimeYMin = s.yMin;
	graphComp.lastTimeYMax = s.yMax;
}


// ****************************************************************** complex color

// we always keep saturation at 100% for the complex plane

// take a complex value for vert.z (like {re: 1, im: -1}) 
// and fill in other components (color, height) to make the 3d complex graph
function complexScaleAndColor(vert, lightnessScale) {
	let zre = vert.z_data.re, zim = vert.z_data.im;
	
	let hue = 180 * Math.atan2(zim, zre) / Math.PI + 180;  // make it positive
	let lightness = Math.atan(lightnessScale(vert.abs)) * 2 / Math.PI;  // make it 0...1
	
	let rgb = hsl(hue, 1, lightness).rgb();
	vert.red = rgb.r / 255;
	vert.green = rgb.g / 255;
	vert.blue = rgb.b / 255;
// 	let rgb = rgbFromHl(hue, lightness);
// 	Object.assign(vert, rgb);
	vert.z_height = zre;
	//console.log(`(${zre},${zim}) ---> `, vert);
	
	// check to see if ANY of these are NaN
	if (isNaN(zre + zim + hue + lightness + rgb.r + rgb.g + rgb.b)) debugger;
}

// ****************************************************************** data generation

function calcRandom(x, y) {
	return Math.random();
}


// decide which formula/generator to use, and use it to generate a matrix of 
// vertex objects with keys x, y, z_data, red, green, blue, alpha
// also hand in scalers for x, y from cell to data coords
// Unfortunately we can't map z values to cell coords yet 
// cuz we need them all to figure out the scaler
export function generateBlanket(func, nXCells, nYCells, xc2xd, yc2yd) {
	let blanket = new Array(nYCells + 1);

	for (let y = 0; y <= nYCells; y++) {
		let row = blanket[y] = new Array(nXCells + 1);
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.  
			// some sort of obj with whatever we might need for the rendering.
			let vert = row[x] = {
				x, y,   // cell coords
				
				// still in data coords cuz we don't know the extent yet
				z_data: func(xc2xd(x), yc2yd(y)),
				
				// just a default color, set your own later if you care
				red: 1, green: 1, blue: 0, alpha: 1,
			};
			
			// z_height is the ultimate height on the 3d surface, data units, whether complex or not
			if (typeof vert.z_data == 'object') {
				// complex number
				// the abs is used for complex coloring
				vert.abs = Math.hypot(vert.z_data.re, vert.z_data.im);
				vert.z_height = vert.z_data.re;
			}
			else {
				// real
				vert.abs = 0;
				vert.z_height = vert.z_data;
			}
		}
	}
	
	// a few more things to remember
	blanket.nXCells = nXCells;
	blanket.nYCells = nYCells;
	return blanket;
}

// call this after you've figured out the Z scaling from data coords to cell coords
// zd2zc is a function that converts from z_data values to z cell coords
export function scaleBlanket(blanket, zd2zc, lightnessScale) {
	for (let y = 0; y <= blanket.nYCells; y++) {
		let row = blanket[y];
		for (let x = 0; x <= blanket.nXCells; x++) {
			let vert = row[x];
			vert.z = zd2zc(vert.z_height);

			
			if (typeof vert.z_data == 'object') {
				// a complex number - convert to z scalar, and color
				complexScaleAndColor(vert, lightnessScale);
				if (isNaN(vert.z_height + vert.red + vert.green)) debugger;
			}
		}
	}
}

