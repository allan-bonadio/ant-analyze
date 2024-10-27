//
// gen blanket -- generate complex arithmetic blanket array
//
/* eslint-disable eqeqeq, no-throw-literal  */

// decide which formula/generator to use, and use it to generate a matrix of
// vertex objects with keys x, y, z_data, red, green, blue, alpha
// also hand in scalers for x, y from cell to science coords
// Unfortunately we can't map z values to cell coords yet
// cuz we need them all to figure out the scaler
export function generateBlanket(func, nXCells, nYCells, xCell2Science, yCell2Science) {
	let blanketAr = new Array(nYCells + 1);
	for (let y = 0; y <= nYCells; y++) {
		let row = blanketAr[y] = new Array(nXCells + 1);
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.
			// some sort of obj with whatever we might need for the rendering.
			let vert = row[x] = {
				x, y,   // cell coords

				// still in science coords cuz we don't know the extent yet
				z_data: func(xCell2Science(x), yCell2Science(y)),

				// just a default color, set your own later if you care
				// i don't think these numbers do anything; just placeholders
				red: .6, green: .6, blue: .3, alpha: 1,
			};

			// z_science is the ultimate height on the 3d surface, science units,
			// whether complex or not
			if (typeof vert.z_data == 'object') {
				// complex number
				// the abs is used for complex coloring
				vert.abs = Math.hypot(vert.z_data.re, vert.z_data.im);
				vert.z_science = vert.z_data.re;
			}
			else {
				// real
				vert.abs = 0;
				vert.z_science = vert.z_data;
			}
		}
	}

	// a few more things to remember
	blanketAr.nXCells = nXCells;
	blanketAr.nYCells = nYCells;
	return blanketAr;
}

export default generateBlanket;
