//
// blanket plot - a WebGL helper library to draw a blanket plot.
//					basically, a surface z = f(x, y), like that.
//
/* eslint-disable eqeqeq, no-throw-literal  */

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
// import {line} from 'd3-shape';
// import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
// import {select} from 'd3-selection';
import {hsl} from 'd3-color';

import {mat4} from 'gl-matrix';

import {vertexBuffer} from './genComplex';
import blanketTriangles from './blanketTriangles';
import {blanketAxes, weatherVane} from './blanketAxes';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π






/* *************************************************** blanketPlot */
// call them like this:
//    create it, passing a Canvas element, and how big
//		let plot = new blanketPlot(
// 			document.getElementById('blanket-plot'),
// 			{nXCells: xxxx, nYCells:xxx, ...});
// 
//      plot.attachData(blanketData);
// 
//    um, this is subject to change...
//      plot.startInteraction();	

// class to talk to graphics processor via webgl.  This doesn't touch data coordinates,
// just cell coordinates and cellsize in viewable space
class blanketPlot {
	// canvas is the canvas DOM node
	// nXCells and nYCells is dimensions of blanket area in cell coords
	// options: nXCells, nYCells = cell dimensions of xy area
	// xPerCell, yPerCell = size of a cell in visible space
	constructor(canvas, options) {
		this.canvas = canvas;
		Object.assign(this, options);
		
		// these set up for the geometry, and calculate number of vertices they need
		this.axes = new blanketAxes(this);
		this.triangles = new blanketTriangles(this);
		
		this.painters = [
			this.triangles, this.axes, 
			new weatherVane(this),
		];

		this.nVertices = this.painters.reduce((sum, painter) => sum + painter.nVertices, 0);

		// set up and make sure gl is possible
		this.gl = canvas.getContext('webgl') || 
					canvas.getContext('experimental-webgl');

		// If it can't do GL, give up now
		if (!this.gl) {
			throw new Error("Unable to initialize WebGL. "+ 
				"Your browser or machine may not support it.");
		}

		// stuff to be done once
		this.initShaderProgram();
		//this.attachMouseHandlers();
		//this.events.attachEventHandlers()
		//this.createProgramInfo();

		this.then = 0;
	}
	
	// check for a WebGL error.  This is taken out of some documentation.
	checkOK() {
		let gl = this.gl;
		if (! gl)
			return;  // doesn't exist yet
			
		let err = gl.getError();
		if (err) {
			let msg = '';
			switch (err) {
			case gl.INVALID_ENUM:
				msg = "Bad enumerated argument.";
				break;
			case gl.INVALID_VALUE:
				msg = "Numeric argument out of range.";
				break;
			case gl.INVALID_OPERATION:
				msg = "Command is not allowed for the current state.";
				break;
			case gl.INVALID_FRAMEBUFFER_OPERATION:
				msg = "Current framebuffer is not complete.";
				break;
			case gl.OUT_OF_MEMORY:
				msg = "Out of Memory.";
				break;
			case gl.CONTEXT_LOST_WEBGL:
				msg = "WebGL context was lost.";
				break;
			default:
				msg = "Unknown error from GL: "+ err;
			}
			console.error("error from webgl: ", msg);
		}
	}

	//********************************************************* Programs


	// Initialize a shader program, so WebGL knows how to draw our data
	initShaderProgram() {
		let gl = this.gl;

		// Vertex shader program
		const vsSource = `
			attribute vec4 aVertexPosition;
			attribute vec4 aVertexColor;

			uniform mat4 uModelViewMatrix;
			uniform mat4 uProjectionMatrix;

			varying lowp vec4 vColor;

			void main() {
				gl_Position = uProjectionMatrix 
					* uModelViewMatrix 
					* aVertexPosition;
				vColor = aVertexColor;

				//gl_PointSize = 2;  // dot size, apparently a square
			}
		`;

		// Fragment shader program
		const fsSource = `
			varying lowp vec4 vColor;

			void main(void) {
				gl_FragColor = vColor;
			}
		`;

		// creates shader from source and compiles it.
		function loadShader(gl, type, source) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);

			// See if it compiled successfully
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				gl.deleteShader(shader);
				throw new Error('An error occurred compiling the shaders: ' +
						gl.getShaderInfoLog(shader));
			}

			return shader;
		}

		const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
		const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

		// Create the shader program
		const shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		// If creating the shader program failed, alert
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			throw new Error("Unable to initialize the shader program: " + 
				gl.getProgramInfoLog(shaderProgram));
		}

		this.shaderProgram = shaderProgram;
		this.createProgramInfo();
	}

	// Collect all the info needed to use the shader program.
	// Look up which attributes our shader program is using
	// for aVertexPosition, aVevrtexColor and also
	// look up uniform locations.
	createProgramInfo() {
		let gl = this.gl, sp = this.shaderProgram;
		
		this.programInfo = {
			program: this.shaderProgram,
			attribLocations: {
				vertexPosition: gl.getAttribLocation(sp, 'aVertexPosition'),
				vertexColor: gl.getAttribLocation(sp, 'aVertexColor'),
			},
			uniformLocations: {
				projectionMatrix: gl.getUniformLocation(sp, 'uProjectionMatrix'),
				modelViewMatrix: gl.getUniformLocation(sp, 'uModelViewMatrix'),
			},
		};

	}
	
	//********************************************************* Data Layout
	
	// list out ALL the vertices and their colors
	dumpBuffer() {
		
		console.log("actual data put into vertex buffer")
		
		this.painters.forEach(painter => 
			this.buffer.dump(painter.name, painter.startVertex, painter.nVertices));
			
// 		this.buffer.dump("triangles", this.triangles.startVertex, this.triangles.nVertices);
// 		console.log();
// 		this.buffer.dump("axes", this.axes.startVertex, this.axes.nVertices);
	}

	
	// derive Z scaler from points calculated in calcPoints()
	// also lightness for complex
	// again, convert from dataspace coords to cell coords, use scale.invert for opposite
	// Blanket z values must be calculated by now!
	deriveZScale() {
		// find the unified extent of all of the z values on all rows
		// At this point there should be no z values that are objects
		let b = this.blanket;
		if (! b)
			throw "No Blanket Array in deriveScalers()";

		let mini = Infinity, maxi = -Infinity, mi, mx;
		let biggest = -Infinity, big, small;
		for (let f = 0; f < b.length; f++) {
			[mi, mx] = extent(b[f], d => d.z_height);
			[small, big] = extent(b[f], d => d.abs);
			//console.log(`mi=${mi} mx=${mx} from d.z=`, b[f].map(d => d.z_height));
			if (isNaN(mi) || isNaN(mx)) debugger;

			mini = Math.min(mi, mini);
			maxi = Math.max(mx, maxi);
			biggest = Math.max(big, biggest);
		}
		
		// that's min and max in data coords.  convert to cell coords.
		// but z values converted to 'cell coords' for webgl
		// um... isn't one of these an identity?
		this.zScale = scaleLinear()
			.range([mini, maxi])  //// figure this out later!!
			.domain([mini, maxi]);
		this.zMin = mini;
		this.zMax = maxi;

		// adjust the color algorithm for larger/smaller z magnitudes
		this.lightnessScale = scaleLinear()
			.range([0, 1])
			.domain([0, biggest]);

		if (isNaN(this.zScale(1))) debugger;
	}
	

	// we always keep saturation at 100% for the complex plane

	// take a complex value for vert.z (like {re: 1, im: -1}) 
	// and fill in other components (color, height) to make the 3d complex graph
	complexScaleAndColor(vert, lightnessScale) {
		let zre = vert.z_data.re, zim = vert.z_data.im;
	
		let hue = 180 * Math.atan2(zim, zre) / Math.PI + 180;  // make it positive
		let lightness = Math.atan(lightnessScale(vert.abs)) * 2 / Math.PI;  // make it 0...1
	
		let rgb = hsl(hue, 1, lightness).rgb();
		vert.red = rgb.r / 255;
		vert.green = rgb.g / 255;
		vert.blue = rgb.b / 255;
	// 	let rgb = rgbFromHl(hue, lightness);
	// 	Object.assign(vert, rgb);
		vert.z_height = zre;
		//console.log(`(${zre},${zim}) ---> `, vert);
	
		// check to see if ANY of these are NaN
		if (isNaN(zre + zim + hue + lightness + rgb.r + rgb.g + rgb.b)) debugger;
	}

	// call this after you've figured out the Z scaling from data coords to cell coords
	// zScale is a function that converts from z_data values to z cell coords
	scaleBlanket() {
		let blanket = this.blanket;
		let zScale = this.zScale;
		for (let y = 0; y <= blanket.nYCells; y++) {
			let row = blanket[y];
			for (let x = 0; x <= blanket.nXCells; x++) {
				let vert = row[x];
				vert.z = zScale(vert.z_height);

			
				if (typeof vert.z_data == 'object') {
					// a complex number - convert to z scalar, and color
					this.complexScaleAndColor(vert, this.lightnessScale);
					if (isNaN(vert.z_height + vert.red + vert.green)) debugger;
				}
			}
		}
	}

	// called by client to give the data, and generates the compact arrays
	// to be sent to the gpu
	// This is how you feed in your data.  blanket = nested JS arrays like
	//		[[el,el,el],[el,el,el],[el,el,el]]
	// Blanket must have same dimensions as passed to blanketPlot constrctor.
	// each value is an object like 
	// {x: 2.3, y: 4.5, z: 12.7, red: .4, green: .2, blue: .95, alpha: 1}
	attachData(blanket) {
		this.buffer = new vertexBuffer(this.nVertices);
// 		this.positions = new Float32Array(this.nVertices * 3);
// 		this.colors = new Float32Array(this.nVertices * 4);
		this.blanket = blanket;
		
		this.deriveZScale();
		this.scaleBlanket();
	
		// each of these routines fills the arrays with data for different things being drawn
		this.painters.forEach(painter => painter.layDownVertices());

// 		this.triangles.layDownVertices();
// 		
// 		this.axes.layDownVertices();

		this.dumpBuffer();

		this.createProgramInfo();
		this.buffer.attachToGL(this.gl, this.programInfo.attribLocations);

		// Tell WebGL how to pull out the positions from the position
		// buffer into the vertexPosition attribute.
// 		let als = this.programInfo.attribLocations;
// 		this.positionsBuffer = gl.createBuffer();
// 		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
// 		gl.bufferData(gl.ARRAY_BUFFER, this.buffer.positions, gl.STATIC_DRAW);
// 		gl.vertexAttribPointer(
// 				als.vertexPosition,
// 				3, gl.FLOAT,  // n numbers per vertex, n type
// 				false, 0, 0);  // normalize, stride, offset
// 		gl.enableVertexAttribArray(als.vertexPosition);
// 
// 		// Tell WebGL how to pull out the colors from the color buffer
// 		// into the vertexColor attribute.
// 		this.colorsBuffer = gl.createBuffer();
// 		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
// 		gl.bufferData(gl.ARRAY_BUFFER, this.buffer.colors, gl.STATIC_DRAW);
// 		gl.vertexAttribPointer(
// 			als.vertexColor,
// 			4, gl.FLOAT,    // r, g, b, a, type float
// 			false, 0, 0);  // normalize, stride, offset
// 		gl.enableVertexAttribArray(als.vertexColor);
	}

	//********************************************************* Draw One Frame
	
	// make the matrices that position and rotate it all into view
	createMatrices(longitude, latitude) {
		let gl = this.gl;

		// note: gl-matrix.js always has the first argument
		// as the destination to receive the result.

		// Create a perspective matrix, a special matrix that is
		// used to simulate the distortion of perspective in a camera.
		// Our field of view is 45 degrees, with a width/height
		// ratio that matches the display size of the canvas
		// and we only want to see objects between whatever units
		// away from the camera.
		const projectionMatrix = mat4.create();
		mat4.perspective(projectionMatrix,
			 45 * Math.PI / 180,
			 gl.canvas.clientWidth / gl.canvas.clientHeight,
			 0.1,  // clipping near
			 10000.0);  // clipping far

		// Set the drawing position to the center of the scene.
		// then transform it as needed
		const modelViewMatrix = mat4.create();
		
		// this starts with the viewer on this end, and ends with the data model on the other end
		
		// where to back up to, to see it best
		let xLength = this.xPerCell * this.nXCells;  // overall dimensions in view space
		let yLength = this.yPerCell * this.nYCells;
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[0, 0, -0.9 * (xLength + yLength)]);
		
		// rotate by latt
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			latitude + π_2,   // tip north/south in radians
			[1, 0, 0]);       // around x axis

		// rotate by long
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			longitude,   // east-west rotate in radians
			[0, 0, 1]);       // rotate around z

		// where to slide viewing eye to to, xy, to see it best
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[-xLength/2, -yLength/2, -(this.zMax + this.zMin) / 2]);

		// apply the xPerCell and yPerCell scaling
		mat4.scale(modelViewMatrix, modelViewMatrix, [this.xPerCell, this.yPerCell, 1])

		// Set the shader uniforms
		let uls = this.programInfo.uniformLocations;
		gl.uniformMatrix4fv(uls.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(uls.modelViewMatrix, false, modelViewMatrix);
	}
	
	// longitude and latitude are in radians
	drawOneFrame(longitude, latitude) {
		let gl = this.gl;
		
		// set some gl variables
		gl.clearColor(0.0, 0.0, 0.0, 1.0);	// Clear to black, fully opaque
		gl.clearDepth(1.0);				 // Clear depth buffer (16 bits, distance from viewer)
		gl.enable(gl.DEPTH_TEST);	 // Enable depth testing
		gl.depthFunc(gl.LEQUAL);		// Near things obscure far things
		gl.lineWidth(1.0);  // really the only choice

		// Clear the canvas before we start drawing on it.
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		this.checkOK();

		gl.useProgram(this.programInfo.program);
		this.createMatrices(longitude, latitude);
		this.checkOK();

		// actual drawing
		this.painters.forEach(painter => painter.draw(gl));
// 		this.triangles.draw(gl);
// 		this.axes.draw(gl);
	}

}

export default blanketPlot;

