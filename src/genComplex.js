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

// convert a complex value for vert.z (like {re: 1, im: -1}) to have z = z.re
// and to add the color for the complex value
function complexTo3DColor(vert) {
	let zre = vert.z_data.re, zim = vert.z_data.im;
	let hue = 180 * Math.atan2(zim, zre) / Math.PI + 180;  // make it positive
	let lightness = Math.atan(Math.hypot(zre, zim) / 3) * 2 / Math.PI;  // make it 0...1
	let rgb = hsl(hue, 1, lightness).rgb();
	vert.red = rgb.r / 255;
	vert.green = rgb.g / 255;
	vert.blue = rgb.b / 255;
// 	let rgb = rgbFromHl(hue, lightness);
// 	Object.assign(vert, rgb);
	vert.z_data = zre;
	console.log(`(${zre},${zim}) ---> `, vert);
	
	// check to see if ANY of these are NaN
	if (isNaN(zre + zim + hue + lightness + rgb.r + rgb.g + rgb.b)) debugger;
}

// ****************************************************************** data generation

// generate random data, z = 0 ... 0.99999...
function XXXcalcRandom(nXCells, nYCells) {
	let blanket = new Array(nYCells + 1);
	let blue = 0.5;

	for (let y = 0; y <= nYCells; y++) {
		let row = blanket[y] = new Array(nXCells + 1);
		let green = y / nYCells;
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.  
			// some sort of obj with whatever we might need for the rendering.
			row[x] = {
				x, y, 
				z: Math.random(),
				red: x / nXCells, green, blue, alpha: 1,
				//red: Math.random(), green: Math.random(), blue: Math.random(),
			};
		}
	}
	return blanket;
}

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
			
			if (typeof vert.z_data == 'object') {
				// a complex number - convert to z scalar, and color
				complexTo3DColor(vert);
				if (isNaN(vert.z_data)) debugger;
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
export function scaleBlanket(blanket, zd2zc) {
	for (let y = 0; y <= blanket.nYCells; y++) {
		let row = blanket[y];
		for (let x = 0; x <= blanket.nXCells; x++) {
			let vert = row[x];
			vert.z = zd2zc(vert.z_data);
		}
	}
}

