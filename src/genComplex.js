//
// gen complex -- generate complex arithmetic blanket plots
//


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
// saturation is always 1
function rgbFromHl(hue, lightness) {
	let hue_60 = hue / 60;
	let hextant = Math.floor(hue_60);  // 0, 1, 2, ...5, maybe 6
	//let colorvector = ((r, g, b) => {red: r, green: g, blue: b});
	function colorvector(r, g, b) {
		return {red: r, green: g, blue: b}
	}
	
	// this is loosely based on wikipedia's HSL to RGB algorithm
	let chroma = (1 - Math.abs(2 * lightness - 1));
	let frac = chroma * (hue_60 - hextant);
	switch (hextant) {
	case NaN:
	case undefined:  return colorvector(0, 0, 0);

	case 6:
	case 0:  return colorvector(chroma, frac, 0);

	case 1:  return colorvector(1-frac, chroma, 0);
	case 2:  return colorvector(0, chroma, frac);
	case 3:  return colorvector(0, 1-frac, chroma);
	case 4:  return colorvector(frac, 0, chroma);
	case 5:  return colorvector(chroma, 0, 1-frac);
	
	default:  throw "hue out of range "+ hue;
	}

}

// convert a complex value for vert.z (like {re: 1, im: -1}) to have z = z.re
// and to add the color for the complex value
function complexTo3DColor(vert) {
	let zre = vert.z.re, zim = vert.z.im;
	let hue = 180 * Math.atan2(zim, zre) / Math.PI + 180;  // make it positive
	let lightness = Math.atan(Math.hypot(zre, zim)) * 4 / Math.PI;  // make it 0...1
	let rgb = rgbFromHl(hue, lightness);
	Object.assign(vert, rgb);
	vert.z = zre;  // why do i have to do this?
	console.log(`(${zre},${zim}) ---> `, vert);
	if (isNaN(zre + zim + hue + lightness + rgb.red + rgb.green + rgb.blue)) debugger;
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
// vertex objects with keys x, y, z, red, green, blue, alpha
export function generateBlanket(func, nXCells, nYCells) {
	let blanket = new Array(nYCells + 1);

	for (let y = 0; y <= nYCells; y++) {
		let row = blanket[y] = new Array(nXCells + 1);
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.  
			// some sort of obj with whatever we might need for the rendering.
			let vert = row[x] = {
				x, y, 
				z: func(x, y),
				
				// just a default color, set your own later if you care
				red: 1, green: 1, blue: 0, alpha: 1,
			};
			
			if (typeof vert.z == 'object') {
				// a complex number - convert to xyz and color
				complexTo3DColor(vert);
				if (isNaN(vert.z)) debugger;
			}
		}
	}
	return blanket;
}


