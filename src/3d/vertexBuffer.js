//
// vertex buffer -- backing store for the GL image
//
/* eslint-disable eqeqeq, no-throw-literal  */

// handy for filling these buffers.  Decide ahead how many vertices you need room for.
// then create it and call addVertex with each vertex info.
// get the division between groups by checking nVertices between addVertex() calls.
// Finally, call attachToGL() to get ready to use it drawing.
export class vertexBuffer {
	constructor(nVertices) {
		this.allocatedVertices = nVertices
		this.positions = new Float32Array(nVertices * 4);
		this.colors = new Float32Array(nVertices * 4);

		// these start at zero and grow as vertices are added; final count when done
		this.posOffset = 0;
		this.colOffset = 0;
		this.nVertices = 0;
	}
	// call this with an array of the three x y z, and the four r g b a
	addVertex(posArray4, colArray4) {
		let p = this.positions;
		p[this.posOffset++] = posArray4[0];
		p[this.posOffset++] = posArray4[1];
		p[this.posOffset++] = posArray4[2];
		p[this.posOffset++] = posArray4[3];

		let c = this.colors;
		c[this.colOffset++] = colArray4[0];
		c[this.colOffset++] = colArray4[1];
		c[this.colOffset++] = colArray4[2];
		c[this.colOffset++] = colArray4[3];

		this.nVertices++;
	}

	// after filling in your vertices, come here to bless it and attach it to a gl
	// context so it'll be used in drawing
	attachToGL(gl, attribLocations) {
		// Tell WebGL how to pull out the Positions from the position
		// buffer into the vertexPosition attribute.
		this.positionsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
				attribLocations.vertexPosition,
				4, gl.FLOAT,  // xyz & f (fields) per vertex, n type
				false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(attribLocations.vertexPosition);
		// Tell WebGL how to pull out the Colors from the color buffer
		// into the vertexColor attribute.
		this.colorsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
			attribLocations.vertexColor,
			4, gl.FLOAT,    // r, g, b, a, type float
			false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(attribLocations.vertexColor);
	}

	// list out ALL the vertices and their colors
	// between startVertex and endVertexP1-1
	dump(title, startVertex, nVertices) {
		function f(q) {
			return Number(q).toFixed(2).padStart(6);
		}

		console.log(` data put into ${title} vertex buffers`);

		let pos = this.positions;
		let col = this.colors;
		let p, c, v;
		for (v = 0; v < nVertices; v++) {
			p = (startVertex + v) * 4;
			c = (startVertex + v) * 4;
			console.log("v%s: p%s %s %s f%s - c%s %s %s  %s",
				v.toFixed().padStart(4), f(pos[p]), f(pos[p+1]), f(pos[p+2]), pos[p+3],
				f(col[c]), f(col[c+1]), f(col[c+2]), f(col[c+3])
			);
		}
		console.log(' ');
	}

	// free up big stuff
	dispose(gl) {
		gl.deleteBuffer(this.colorsBuffer);
		gl.deleteBuffer(this.positionsBuffer);
		this.colorsBuffer = this.colors = this.positionsBuffer = this.positions = null;
	}
}
