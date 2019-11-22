//
// blanket axes - axis lines and tic marks for a blanket plot.
//

import {mat4} from './gl-matrix';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

// this ends up being a mixin for blanketPlot
class blanketAxes {
	constructor(plot, nXCells, nYCells) {
		this.plot = plot;
		
		// four axes with 8 vertices, times 3 dimensions
		this.nVertices = 24;
	}

	// Always 24 vertices.
	setVertices(pOffset, cOffset) {
		let x, y, z, xCells = this.plot.nXCells, yCells = this.plot.nYCells, zCells = 6;
		let pos = this.plot.positions;
		let col = this.plot.colors;
		
		function addVertex(x, y, z) {
			pos[pOffset++] = x;
			pos[pOffset++] = y;
			pos[pOffset++] = z;
			
			col[cOffset++] = col[cOffset++] = col[cOffset++] = 1;
			col[cOffset++] = .5;
		}
		
		// these are individual line segments, drawn with gl.LINES.
		// each pair of vertices is one line.
		for (x = 0; x <= xCells; x += xCells) {
			for (y = 0; y <= yCells; y += yCells) {
				addVertex(x, y, 0);
				addVertex(x, y, zCells);
			}
		}
	
		for (y = 0; y <= yCells; y += yCells) {
			for (z = 0; z <= zCells; z += zCells) {
				addVertex(0, y, z);
				addVertex(xCells, y, z);
			}
		}

		for (z = 0; z <= zCells; z += zCells) {
			for (x = 0; x <= xCells; x += xCells) {
				addVertex(x, 0, z);
				addVertex(x, yCells, z);
			}
		}

		return [pOffset, cOffset];
	}

};

export default blanketAxes;

