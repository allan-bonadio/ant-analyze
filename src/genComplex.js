//
// gen complex -- generate complex arithmetic blanket plots
// 				um, actually, random functions I don't know where to put right now
//

/* eslint-disable eqeqeq, no-throw-literal  */


// ****************************************************************** data generation


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

