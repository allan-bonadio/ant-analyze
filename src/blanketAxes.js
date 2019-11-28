//
// blanket axes - axis lines and tic marks for a blanket plot.
//
/* eslint-disable eqeqeq, no-throw-literal  */

//import {mat4} from 'gl-matrix';

//import {vertexBuffer} from './genComplex';
import Webgl3D from './Webgl3D';

// don't try to type these names, just copy paste
//const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

/* ************************************************************** axis bars */

// this ends up being a mixin for blanketPlot
export class blanketAxes {
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
		let x, y, z, xCells = this.plot.nXCells, yCells = this.plot.nYCells;
		let zMin = this.plot.zMin, zMax = this.plot.zMax, zSize = zMax - zMin;
		
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
		
		this.nVertices = this.buffer.nVertices - this.startVertex;
	}

	draw(gl) {
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}
};

export default blanketAxes;

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
		let p = this.plot;
		let zero = {x: g.xScale(0), y: g.yScale(0), z: p.zScale(0)};
		let one = {x: g.xScale(1), y: g.yScale(1), z: p.zScale(1)};
		
		// we want to use a triangle fan with the white corner at 0,0,0
		buffer.addVertex([zero.x, zero.y, zero.z], [1, 1, 1, 1]);  // origin is white
		buffer.addVertex([ one.x, zero.y, zero.z], [1, 0, 0, 1]);  // x direction is red
		buffer.addVertex([zero.x,  one.y, zero.z], [0, 1, 0, 1]);  // y green
		buffer.addVertex([zero.x, zero.y,  one.z], [0, 0, 1, 1]);  // z blue
		buffer.addVertex([ one.x, zero.y, zero.z], [1, 0, 0, 1]);  // return again

		this.nVertices = this.buffer.nVertices - this.startVertex;
	}

	draw(gl) {
		gl.drawArrays(gl.TRIANGLE_FAN, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

}

