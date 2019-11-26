//
// blanket axes - axis lines and tic marks for a blanket plot.
//
/* eslint-disable eqeqeq, no-throw-literal  */


import {mat4} from 'gl-matrix';

import {vertexBuffer} from './genComplex';

// don't try to type these names, just copy paste
//const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

// this ends up being a mixin for blanketPlot
class blanketAxes {
	constructor(plot, nXCells, nYCells) {
		this.plot = plot;
		
		// four axes with 8 vertices, times 3 dimensions
		this.nVertices = 24;
	}

	// Always 24 vertices.
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;
		let x, y, z, xCells = this.plot.nXCells, yCells = this.plot.nYCells;
		let zMin = this.plot.zMin, zMax = this.plot.zMax, zSize = zMax - zMin;
		let pos = this.plot.positions;
		let col = this.plot.colors;
		
		let addVertex = (x, y, z) => {
			buffer.addVertex([x, y, z], [1, 1, 1, .5]);
		};
		
		// these are individual line segments, drawn with gl.LINES.
		// each pair of vertices is one line.  Each loop goes around 2ice.
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
	}

	draw(gl) {
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}
};

export default blanketAxes;

