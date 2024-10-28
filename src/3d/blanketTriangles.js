//
// blanket triangles - GL paint the actual surface of a blanket plot.
//					It's all made of triangles.
//
/* eslint-disable eqeqeq, no-throw-literal  */

// sheetIx is for multi valued functions like square root has + and - sheets.
// In those cases, there's multiple blanketTriangles instances, one for each sheet
class blanketTriangles {
	constructor(plot, sheetIx) {
		this.plot = plot;
		this.sheetIx = sheetIx;
		this.sheet = plot.bkdrop.sheets[sheetIx];
		let bkdrop = plot.bkdrop;
		this.name = 'triangles' + sheetIx;
		// Blanket: 2 triangles per cell, 1 vertex per triangle + 2 to get started,
		// then 2 extra every time you move from one x-row to the next
		this.maxVertices = 2 * (bkdrop.nXCells + 2) * bkdrop.nYCells - 2;
	}

	// generate all the vBuffer vertices for this sheet of vertices
	layDownVertices() {
		let plot = this.plot;
		let sheet = this.sheet;
		let bkdrop = plot.bkdrop;
		let vBuffer = this.vBuffer = plot.vBuffer;
		this.startVertex = vBuffer.nVertices;
		let blanketVerts = sheet.blanketVerts;  // where the data comes from
		let addVertex = (x, y) => {
			let b = blanketVerts[y][x];
			vBuffer.addVertex([x, y, b.z, 0], [b.red, b.green, b.blue, 1]);
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
		this.nVertices = this.vBuffer.nVertices - this.startVertex;
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
		this.plot = this.vBuffer = null;
	}
}
export default blanketTriangles;
