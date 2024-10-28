//
// weather vane - reference object in case we lose orientation in the 3d space.
//
/* eslint-disable eqeqeq, no-throw-literal  */
import Webgl3D from '../Webgl3D.js';

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
		let vBuffer = this.vBuffer = this.plot.vBuffer;
		this.startVertex = this.vBuffer.nVertices;
		let g = Webgl3D.me;
		const bkdrop = g.bkdrop;
		let zero = bkdrop.scaleXYZ1([0, 0, 0]);
		let one  = bkdrop.scaleXYZ1([1, 1, 1]);
		////{x: bkdrop.xScale(0), y: bkdrop.yScale(0), z: p.zScale(0)};
		//.let one = {x: bkdrop.xScale(1), y: bkdrop.yScale(1), z: p.zScale(1)};
		// we want to use a triangle fan with the white corner at 0,0,0
		vBuffer.addVertex([zero[0], zero[1], zero[2], 0], [1, 1, 1, 1]);  // origin is white
		vBuffer.addVertex([ one[0], zero[1], zero[2], 0], [1, 0, 0, 1]);  // x direction is red
		vBuffer.addVertex([zero[0],  one[1], zero[2], 0], [0, 1, 0, 1]);  // y green
		vBuffer.addVertex([zero[0], zero[1],  one[2], 0], [0, 0, 1, 1]);  // z blue
		vBuffer.addVertex([ one[0], zero[1], zero[2], 0], [1, 0, 0, 1]);  // return again
		this.nVertices = this.vBuffer.nVertices - this.startVertex;
	}

	draw(gl) {
		gl.drawArrays(gl.TRIANGLE_FAN, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

	dispose() {
		this.plot = null;
	}
}

export default weatherVane;

