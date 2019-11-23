//
// blanket plot - a WebGL helper library to draw a blanket plot.
//					basically, a surface z = f(x, y), like that.
//

import {mat4} from './gl-matrix';

import blanketTriangles from './blanketTriangles';
import blanketAxes from './blanketAxes';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

// how much rotation velocities fade over time.  
// Keep between ~.2 ... .999, or 1 for no coasting,  0 for no friction
const ROTATION_FRICTION = .95;

// call them like this:
// create it, passing a Canvas element, and how big
//		let plot = new blanketPlot(
// 			document.getElementById('blanket-plot'),
// 			{nXCells: xxxx, nYCells:xxx, ...});
// 
// plot.attachData(blanketData);
// 
// um, this is subject to change...
// plot.startInteraction();	

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
		this.axes = new blanketAxes(this, options.nXCells, options.nYCells);
		this.triangles = new blanketTriangles(this, options.nXCells, options.nYCells);
		
		this.nVertices = this.triangles.nVertices + this.axes.nVertices;

		// angle human is looking at it with, geographical coordinates 
		// latt = lattitude = angle tilted up/down, 0=bottom looking up
		// long = longitude = azmuth = horizontal rotation around z axis, 0= +x axis
		// wait maybe not...
		this.lattRotation = 1.7;  // 0...π
		this.longRotation = 0;  // primarily 0...2π but it's allowed to 
					// wrap around a few circles if needed...??
		this.lattVelocity = 0;
		this.longVelocity = 0;
		
		// better for production, imparts initial spin,
		// so user can figure out that they can drag it around
		this.lattVelocity = .5;
		this.longVelocity = .5;
		
		
		// set up and make sure gl is possible
		this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

		// If it can't do GL, give up now
		if (!this.gl) {
			throw new Error("Unable to initialize WebGL. "+ 
				"Your browser or machine may not support it.");
		}

		// stuff to be done once
		this.initShaderProgram();
		this.attachMouseHandlers();
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
	
	

	dumpBuffers() {
		function n(q) {
			return q.toFixed(2);
		}
		
		let pos = this.positions;
		let col = this.colors;
		let p, vert;

		for (vert = 0; vert < this.triangles.nVertices; vert++) {
			p = vert * 3;
			console.log("blanket positions %d: %s %s %s", 
				vert, n(pos[p]), n(pos[p+1]), n(pos[p+2]));
			
		}
		console.log(' ');

		for (vert = 0; vert < this.triangles.nVertices; vert++) {
			p = vert * 4;
			console.log("blanket color %d: %s %s %s %s", 
				vert, n(col[p]), n(col[p+1]), n(col[p+2]), n(col[p+3]));
 		}
		console.log(' ');

		for (vert = this.triangles.nVertices; vert < this.nVertices; vert++) {
			p = vert * 3;
			console.log("axis positions %d: %s %s %s", 
				vert, n(pos[p]), n(pos[p+1]), n(pos[p+2]));
		}
		console.log(' ');

		for (vert = this.triangles.nVertices; vert < this.nVertices; vert++) {
			p = vert * 4;
			console.log("axis color %d: %s %s %s %s", 
				vert, n(col[p]), n(col[p+1]), n(col[p+2]), n(col[p+3]));
		}
		console.log(' ');
	}
	
	// called by client to give the data, and generates the compact arrays
	// to be sent to the gpu
	// This is how you feed in your data.  blanket = nested JS arrays like
	//		[[el,el,el],[el,el,el],[el,el,el]]
	// Blanket must have same dimensions as passed to blanketPlot constrctor.
	// each value is an object like 
	// {x: 2.3, y: 4.5, z: 12.7, red: .4, green: .2, blue: .95, alpha: 1}
	attachData(blanket, unitsPerCell) {
		this.positions = new Float32Array(this.nVertices * 3);
		this.colors = new Float32Array(this.nVertices * 4);
		this.blanket = blanket;
	
		// each of these routines fills the arrays with data for different things being drawn
		let pOffset = 0, cOffset = 0;
		[pOffset, cOffset] = this.triangles.setVertices(pOffset, cOffset);
		console.assert(pOffset == this.triangles.nVertices*3, 'buffer TP');
		console.assert(cOffset == this.triangles.nVertices*4, 'buffer TC');
		
		[pOffset, cOffset] = this.axes.setVertices(pOffset, cOffset);
		console.assert(pOffset == this.nVertices*3, 'buffer AP');
		console.assert(cOffset == this.nVertices*4, 'buffer AC');

		//this.dumpBuffers();

		let gl = this.gl;
		this.createProgramInfo();

		// Tell WebGL how to pull out the positions from the position
		// buffer into the vertexPosition attribute.
		let als = this.programInfo.attribLocations;
		this.positionsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
				als.vertexPosition,
				3, gl.FLOAT,  // n numbers per vertex, n type
				false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(als.vertexPosition);

		// Tell WebGL how to pull out the colors from the color buffer
		// into the vertexColor attribute.
		this.colorsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
		gl.vertexAttribPointer(
			als.vertexColor,
			4, gl.FLOAT,    // r, g, b, a, type float
			false, 0, 0);  // normalize, stride, offset
		gl.enableVertexAttribArray(als.vertexColor);
	}

	//********************************************************* Draw One Frame
	
	// make the matrices that position and rotate it all into view
	createMatrices() {
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
		
		// where to back up to, to see it best
		let xLength = this.xPerCell * this.nXCells;  // overall dimensions in view space
		let yLength = this.yPerCell * this.nYCells;
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[0, 0, -0.7 * (xLength + yLength)]);
		
		// rotate by latt
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			this.lattRotation,   // tip north/south in radians
			[1, 0, 0]);       // around x axis

		// rotate by long
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			this.longRotation,   // east-west rotate in radians
			[0, 0, 1]);       // rotate around z

		// where to slide viewing eye to to, xy, to see it best
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[-xLength/2, -yLength/2, -(this.maxiZ - this.miniZ) / 2]);

		// apply the xPerCell and yPerCell scaling
		mat4.scale(modelViewMatrix, modelViewMatrix, [this.xPerCell, this.yPerCell, 1])

		// Set the shader uniforms
		let uls = this.programInfo.uniformLocations;
		gl.uniformMatrix4fv(uls.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(uls.modelViewMatrix, false, modelViewMatrix);
	}
	
	drawOneFrame() {
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
		this.createMatrices();
		this.checkOK();

		// actual drawing
		this.triangles.draw(gl);
		this.axes.draw(gl);
// 		gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.triangles.nVertices);
// 		this.checkOK();
// 		gl.drawArrays(gl.LINES, this.triangles.nVertices, this.axes.nVertices);
// 		this.checkOK();
		// some alternate modes: gl.LINE_STRIP gl.POINTS
	}
	
	//********************************************************* 
	//********************************************************* 
	
	
	//******************************************* interaction & animation
	
	// update the rotation velocities according to how much movement has happened
	mouseNudge(ev) {
	// 	console.log('event: %O', ev);
	// 	console.log('x=%s, y=%s, button=%s buttons=%s ', ev.offsetX, ev.offsetY, 
	// 		ev.button, ev.buttons);

		if (ev.buttons && this.prevTimeStamp !== undefined) {
			let dt = ev.timeStamp - this.prevTimeStamp;
			let dx = ev.offsetX - this.prevX;
			let dy = ev.offsetY - this.prevY;
			if (dt > .1) {
				// dt is zero or very small, the velocity skyrockets.  prevent.
				this.longVelocity = - 6 * dx / dt;
				this.lattVelocity = 6 * dy / dt;
			}
			
			// in case arithmetic fumbles.  Doesn't seem to happen anymore.
			if (isNaN(this.longRotation) || isNaN(this.lattRotation))
				debugger;
			if (isNaN(this.longRotation)) this.longRotation = 0;
			if (isNaN(this.lattRotation)) this.lattRotation = 0;
		}
		this.prevX = ev.offsetX;
		this.prevY = ev.offsetY;
		this.prevTimeStamp = ev.timeStamp;
	}

	attachMouseHandlers(canvas) {
		// this is all it takes!
		
		this.canvas.addEventListener('mousedown', ev => {
			this.mouseNudge(ev);
		});
	
		this.canvas.addEventListener('mousemove', ev => {
			this.mouseNudge(ev);
		});
	
		this.canvas.addEventListener('mouseup', ev => {
			this.mouseNudge(ev);
		});
	}

	// actually draw on canvas, one frame for animation
	renderOneFrame(now) {
		if (! document.getElementById('attitude-readout'))
			return;
			
		now *= 0.001;  // convert to seconds
		
		// the first time, then is undefined and so are the others
		let deltaTime = now - this.then;
		this.then = now;

		this.drawOneFrame();
		
		// Update the rotation for the next draw (but keep it to 0...whatever)
		this.longRotation = (this.longRotation + this.longVelocity * deltaTime) / twoπ;
		this.longRotation = (this.longRotation - Math.floor(this.longRotation)) * twoπ;

		// constrain latt to 0...180°, stop it if it hits end
		this.lattRotation = (this.lattRotation + this.lattVelocity * deltaTime);
		if (this.lattRotation < 0) {
			this.lattRotation = 0;
			this.lattVelocity = -this.lattVelocity / 2;  // bang!
		}
		if (this.lattRotation > π) {
			this.lattRotation = π;
			this.lattVelocity = -this.lattVelocity / 2;  // bounce!
		}
		
		// and some friction please
		let factor = (1 - ROTATION_FRICTION) ** deltaTime;
		this.longVelocity *= factor;
		this.lattVelocity *= factor;

		let r2d = radians => radians * 180 / Math.PI;
		document.getElementById('attitude-readout').innerHTML = 
			r2d(this.longRotation).toFixed() +'° long '+
			r2d(this.lattRotation).toFixed() +'° lat';

		// comment this out to just render one frame
		requestAnimationFrame(this.renderOneFrame);
	}
	
	// starts the whole thing up
	startInteraction() {
		this.createProgramInfo();

		this.renderOneFrame = this.renderOneFrame.bind(this);
		this.renderOneFrame(0);
	}

}

export default blanketPlot;


