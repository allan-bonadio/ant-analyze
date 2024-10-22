//
// axis bars - axis lines and tic marks for a blanket plot.
//
/* eslint-disable eqeqeq, no-throw-literal  */
import Webgl3D from '../Webgl3D.js';
/* ************************************************************** axis bars */
// this ends up being a mixin for blanketPlot
export class axisBars {
	constructor(plot) {
		this.plot = plot;
		this.name = 'axes';
		// four axes with 8 vertices, times 3 dimensions
		this.maxVertices = 24;
	}
	// Always 24 vertices.
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;
		// these are all in cell coords
		let x, y, z, xCells = this.plot.nXCells, yCells = this.plot.nYCells;
		let zMin = 0, zMax = this.plot.nZCells, zSize = this.plot.nZCells;
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
		// the axis bars look aliased and gunky so get rid of them
//		if (config.aniGifFrames)
//			return;
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}
	dispose() {
		this.plot = this.buffer = null;
	}
};
export default axisBars;
/* ************************************************************** weatherVane */
// include this if you're losing your orientation and you need to know which side is up
// just draws this triangular pyramid at (0,0,0) pointing to +x, +y and +z
// all angles at zero are 90°; fourth face is equilateral but not drawn
export class weatherVane {
	constructor(plot) {
		this.plot = plot;
		this.name = 'weatherVane';
		this.maxVertices = 5;
	}
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;
		let g = Webgl3D.me;
		let zero = g.scaleXYZ1([0, 0, 0]);
		let one  = g.scaleXYZ1([1, 1, 1]);
		////{x: g.xScale(0), y: g.yScale(0), z: p.zScale(0)};
		//.let one = {x: g.xScale(1), y: g.yScale(1), z: p.zScale(1)};
		// we want to use a triangle fan with the white corner at 0,0,0
		buffer.addVertex([zero[0], zero[1], zero[2], 0], [1, 1, 1, 1]);  // origin is white
		buffer.addVertex([ one[0], zero[1], zero[2], 0], [1, 0, 0, 1]);  // x direction is red
		buffer.addVertex([zero[0],  one[1], zero[2], 0], [0, 1, 0, 1]);  // y green
		buffer.addVertex([zero[0], zero[1],  one[2], 0], [0, 0, 1, 1]);  // z blue
		buffer.addVertex([ one[0], zero[1], zero[2], 0], [1, 0, 0, 1]);  // return again
		this.nVertices = this.buffer.nVertices - this.startVertex;
	}
	draw(gl) {
		gl.drawArrays(gl.TRIANGLE_FAN, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}
	dispose() {
		this.plot = null;
	}
}
