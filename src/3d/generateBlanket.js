//
// gen blanket -- generate complex arithmetic blanket array
//
/* eslint-disable eqeqeq, no-throw-literal  */

const toPolar = (re, im) => ({r: Math.hypot(re, im), θ: Math.atan2(im, re)});

const fromPolar = ({r, θ}) => ({re: r * Math.cos(θ), im: r * Math.sin(θ)});


// decide which formula/generator to use, and use it to generate a matrix of
// vertex objects with keys x, y, z_reim, red, green, blue, alpha
// also hand in scalers for x, y from cell to science coords
// Unfortunately we can't map z values to cell coords yet
// cuz we need them all to figure out the scaler
export function generateBlanket(sheet, nXCells, nYCells, xCell2Science, yCell2Science) {
	let blanketVerts = new Array(nYCells + 1);
	for (let y = 0; y <= nYCells; y++) {
		let row = blanketVerts[y] = new Array(nXCells + 1);
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.
			// some sort of obj with whatever we might need for the rendering.
			let vert = row[x] = {
				x, y,   // cell coords

				// Actually Calculate!  still in science coords cuz we don't know the extent yet
				z_reim: sheet.polar
					? fromPolar(sheet.func(toPolar(xCell2Science(x), yCell2Science(y))))
					: sheet.func(xCell2Science(x), yCell2Science(y)),

				// placeholders
				red: 0, green: 0, blue: 0, alpha: 1,
			};

			// z_vertical is the ultimate height on the 3d surface, science units,
			// whether complex or not
			if (typeof vert.z_reim == 'object') {
				// complex number    the abs is used for complex coloring
				vert.abs = Math.hypot(vert.z_reim.re, vert.z_reim.im);
				vert.z_vertical = vert.z_reim.re;
			}
			else {
				// real - I guess not used
				vert.abs = 0;
				vert.z_vertical = vert.z_reim;
			}
		}
	}

	// a few more things to remember
	blanketVerts.nXCells = nXCells;
	blanketVerts.nYCells = nYCells;
	return blanketVerts;
}

export default generateBlanket;
