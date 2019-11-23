//
// blanket triangles - Do the actual surface of a blanket plot.
//					It's all made of triangles.
//

import {mat4} from './gl-matrix';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π


class blanketTriangles {
	constructor(plot, nXCells, nYCells) {
		this.plot = plot;
		
		// Blanket: 2 triangles per cell, 1 vertex per triangle + 2 to get started,
		// then 2 extra every time you move from one x-row to the next
		this.nVertices = 2 * (nXCells + 2) * nYCells - 2;
	}

	setVertices(pOffset, cOffset) {
		this.startVertex = pOffset / 3;
		let pos = this.plot.positions;
		let col = this.plot.colors;
		let bla = this.plot.blanket;
		let miniZ = Infinity, maxiZ = -Infinity;
		
		function addVertex(x, y) {
			let b = bla[y][x];

			// all single floats the way the gpu likes it
			pos[pOffset++] = x;
			pos[pOffset++] = y;
			pos[pOffset++] = b.z;
			
			col[cOffset++] = b.red;
			col[cOffset++] = b.green;
			col[cOffset++] = b.blue;
			col[cOffset++] = b.alpha;
			
			miniZ = Math.min(miniZ, b.z);
			maxiZ = Math.max(maxiZ, b.z);
		}
		
		// now go through all blanket vertices
		// each is a triangle drawn with gl.TRIANGLE_STRIP, 
		// one for every 3 consecutive vertices (overlapping)
		let x, y;
		// note we don't do the last row!  each band is 1 high.
		for (y = 0; y < this.plot.nYCells; y++) {
			let b;
		
			// a degenerate vertex; needed to goto next row
			if (y > 0)
				addVertex(0, y);
			
			for (x = 0; x <= this.plot.nXCells; x++) {
				// 2 buffer, 2 floats each
				addVertex(x, y);
				addVertex(x, y + 1);
			}
			
			// a degenerate vertex; needed to goto next row
			if (y < this.plot.nYCells-1)
				addVertex(this.plot.nXCells, y+1);
		}
		
		// only the triangles surface gets to set the z min/max
		this.plot.miniZ = miniZ;
		this.plot.maxiZ = maxiZ;
		
		return [pOffset, cOffset];
	}

	draw(gl) {
		gl.drawArrays(gl.TRIANGLE_STRIP, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}
}

export default blanketTriangles;

