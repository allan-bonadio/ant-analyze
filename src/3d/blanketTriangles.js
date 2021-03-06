//
// blanket triangles - Draw the actual surface of a blanket plot.
//					It's all made of triangles.
//
/* eslint-disable eqeqeq, no-throw-literal  */

//import {mat4} from 'gl-matrix';
//import {vertexBuffer} from './genComplex';

// don't try to type these names, just copy paste
//const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π didn't compile


class blanketTriangles {
	constructor(plot) {
		this.plot = plot;
		this.name = 'triangles';
		
		// Blanket: 2 triangles per cell, 1 vertex per triangle + 2 to get started,
		// then 2 extra every time you move from one x-row to the next
		this.maxVertices = 2 * (plot.nXCells + 2) * plot.nYCells - 2;
	}

	// generate all the vertices for the whole blanket
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = buffer.nVertices;
		let bla = this.plot.blanket;  // where the data comes from
		
		let addVertex = (x, y) => {
			let b = bla[y][x];
			buffer.addVertex([x, y, b.z, 0], [b.red, b.green, b.blue, 1]);
		};
		
		// now go through all blanket vertices
		// each is a triangle drawn with gl.TRIANGLE_STRIP, 
		// one for each vertex, minus 2 cuz the first two don't make a triangle yet.  
		// every 3 consecutive vertices (overlapping) become a triangle
		// x and y are in cell coordinates
		let x, y;
		// note we don't do the last row!  each band is 1 high.
		for (y = 0; y < this.plot.nYCells; y++) {
			// a degenerate vertex; needed to come from last row
			if (y > 0)
				addVertex(0, y);
			
			// all the vertices of this strip
			for (x = 0; x <= this.plot.nXCells; x++) {
				// 2 buffer, 2 floats each
				addVertex(x, y);
				addVertex(x, y + 1);
			}
			
			// a degenerate vertex; needed to goto next row
			if (y < this.plot.nYCells-1)
				addVertex(this.plot.nXCells, y+1);
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
		this.plot = this.buffer = null;
	}
}

export default blanketTriangles;

