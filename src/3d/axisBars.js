//
// axis bars - axis lines and tic marks for a blanket plot.
//
/* eslint-disable eqeqeq, no-throw-literal  */

/* ************************************************************** axis bars */
// this ends up being a mixin for blanketPlot
export class axisBars {
	constructor(plot) {
		this.plot = plot;
		this.bkdrop = plot.bkdrop;
		this.name = 'axes';

		// four axes with 8 vertices, times 3 dimensions
		this.maxVertices = 24;
	}

	// Always 24 vertices.
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;

		// these are all in cell coords
		let bkdrop = this.bkdrop;
		let x, y, z, xCells = bkdrop.nXCells, yCells = bkdrop.nYCells;
		let zMin = 0;
		let zMax = bkdrop.nZCells;
		let zSize = bkdrop.nZCells;
		let addVertex = (x, y, z) => {
			buffer.addVertex([x, y, z, 0], [1, 1, 1, 1]);
		};

		// these are individual line segments, drawn with gl.LINES.
		// each pair of vertices is one line.  Each loop goes around 2ice, inner or outer.
		for (x = 0; x <= xCells; x += xCells) {
			for (y = 0; y <= yCells; y += yCells) {
				addVertex(x, y, zMin);
				addVertex(x, y, zMax);
			}
		}
		for (y = 0; y <= yCells; y += yCells) {
			for (z = zMin; z <= zMax; z += zSize) {
				addVertex(0, y, z);
				addVertex(xCells, y, z);
			}
		}
		for (z = zMin; z <= zMax; z += zSize) {
			for (x = 0; x <= xCells; x += xCells) {
				addVertex(x, 0, z);
				addVertex(x, yCells, z);
			}
		}
		this.nVertices = this.buffer.nVertices - this.startVertex;
	}

	draw(gl) {
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

	dispose() {
		this.plot = this.buffer = null;
	}
};
export default axisBars;

