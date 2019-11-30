//
// gen complex -- generate complex arithmetic blanket plots
// 				um, actually, random functions I don't know where to put right now
//

/* eslint-disable eqeqeq, no-throw-literal  */


// ****************************************************************** data generation


// decide which formula/generator to use, and use it to generate a matrix of 
// vertex objects with keys x, y, z_data, red, green, blue, alpha
// also hand in scalers for x, y from cell to science coords
// Unfortunately we can't map z values to cell coords yet 
// cuz we need them all to figure out the scaler
export function generateBlanket(func, nXCells, nYCells, xCell2Science, yCell2Science) {
	let blanket = new Array(nYCells + 1);

	for (let y = 0; y <= nYCells; y++) {
		let row = blanket[y] = new Array(nXCells + 1);
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.  
			// some sort of obj with whatever we might need for the rendering.
			let vert = row[x] = {
				x, y,   // cell coords
				
				// still in science coords cuz we don't know the extent yet
				z_data: func(xCell2Science(x), yCell2Science(y)),
				
				// just a default color, set your own later if you care
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
	blanket.nXCells = nXCells;
	blanket.nYCells = nYCells;
	return blanket;
}

// ****************************************************************** painters

// superclass of blanketTriangles and blanketAxes
// no,not much shared between these; it'll be more of a pain in the butt
// export class painter {
// 	constructor(plot) {
// 		this.plot = plot;
// 	}
// }

// ****************************************************************** vertex buffers

// handy for filling these buffers.  Decide ahead how many vertices you need room for.
// then create it and call addVertex with each vertex info.
// get the division between groups by checking nVertices between addVertex() calls.
// Finally, call attachToGL() to get ready to use it drawing.
export class vertexBuffer {
	constructor(nVertices) {
		this.allocatedVertices = nVertices
		this.positions = new Float32Array(nVertices * 3);
		this.colors = new Float32Array(nVertices * 4);
		
		// these start at zero and grow as vertices are added; final count when done
		this.posOffset = 0;
		this.colOffset = 0;
		this.nVertices = 0;
	}

	// call this with an array of the three x y z, and the four r g b a
	addVertex(posArray3, colArray4) {
		let p = this.positions;
		p[this.posOffset++] = posArray3[0];
		p[this.posOffset++] = posArray3[1];
		p[this.posOffset++] = posArray3[2];
	
		let c = this.colors;
		c[this.colOffset++] = colArray4[0];
		c[this.colOffset++] = colArray4[1];
		c[this.colOffset++] = colArray4[2];
		c[this.colOffset++] = colArray4[3];
		
		this.nVertices++;
	}
	
	// after filling in your vertices, come here to bless it and attach it to a gl
	// context so it'll be used in drawing
	attachToGL(gl, attribLocations) {
		// Tell WebGL how to pull out the positions from the position
		// buffer into the vertexPosition attribute.
		this.positionsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
				attribLocations.vertexPosition,
				3, gl.FLOAT,  // n numbers per vertex, n type
				false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(attribLocations.vertexPosition);

		// Tell WebGL how to pull out the colors from the color buffer
		// into the vertexColor attribute.
		this.colorsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
			attribLocations.vertexColor,
			4, gl.FLOAT,    // r, g, b, a, type float
			false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(attribLocations.vertexColor);
	}
	

	// list out ALL the vertices and their colors
	// between startVertex and endVertexP1-1
	dump(title, startVertex, nVertices) {
		function f(q) {
			return Number(q).toFixed(2).padStart(6);
		}
		
		console.log(` data put into ${title} vertex buffers`);
		
		let pos = this.positions;
		let col = this.colors;
		let p, c, v;

		for (v = 0; v < nVertices; v++) {
			p = (startVertex + v) * 3;
			c = (startVertex + v) * 4;
			console.log("v%s: p%s %s %s - c%s %s %s  %s", 
				v.toFixed().padStart(4), f(pos[p]), f(pos[p+1]), f(pos[p+2]),
				f(col[c]), f(col[c+1]), f(col[c+2]), f(col[c+3])
			);
		}
		console.log(' ');
	}
}


