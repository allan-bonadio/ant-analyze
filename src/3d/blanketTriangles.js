//
// blanket triangles - Draw the actual surface of a blanket plot.
//					It's all made of triangles.
//
/* eslint-disable eqeqeq, no-throw-literal  */

class blanketTriangles {
	constructor(plot) {
		this.plot = plot;
		let bkdrop = plot.bkdrop;
		this.name = 'triangles';
		// Blanket: 2 triangles per cell, 1 vertex per triangle + 2 to get started,
		// then 2 extra every time you move from one x-row to the next
		this.maxVertices = 2 * (bkdrop.nXCells + 2) * bkdrop.nYCells - 2;
	}

	// generate all the vertices for the whole blanket
	layDownVertices() {
		let bkdrop = this.plot.bkdrop;
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = buffer.nVertices;
		let blanketAr = this.plot.blanketAr;  // where the data comes from
		let addVertex = (x, y) => {
			let b = blanketAr[y][x];
			buffer.addVertex([x, y, b.z, 0], [b.red, b.green, b.blue, 1]);
		};
		// now go through all blanket vertices
		// each is a triangle drawn with gl.TRIANGLE_STRIP,
		// one for each vertex, minus 2 cuz the first two don't make a triangle yet.
		// every 3 consecutive vertices (overlapping) become a triangle
		// x and y are in cell coordinates
		let x, y;
		// note we don't do the last row!  each band is 1 high.
		for (y = 0; y < bkdrop.nYCells; y++) {
			// a degenerate vertex; needed to come from last row
			if (y > 0)
				addVertex(0, y);
			// all the vertices of this strip
			for (x = 0; x <= bkdrop.nXCells; x++) {
				// 2 buffer, 2 floats each
				addVertex(x, y);
				addVertex(x, y + 1);
			}
			// a degenerate vertex; needed to goto next row
			if (y < bkdrop.nYCells-1)
				addVertex(bkdrop.nXCells, y+1);
		}
		this.nVertices = this.buffer.nVertices - this.startVertex;
		return;
	}

	draw(gl) {
		// change these for a diagnostic
		gl.drawArrays(
			//gl.POINTS,     // most useful and foolproof but set width in vertex shader
			//gl.LINES,      // tend to scribble all over
			//gl.LINE_STRIP, // tend to scribble all over
			//gl.TRIANGLES,  // more sparse triangles
			gl.TRIANGLE_STRIP, // this is the normal one
			this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

	dispose() {
		this.plot.bkdrop = null;
		this.plot = this.buffer = null;
	}
}
export default blanketTriangles;
