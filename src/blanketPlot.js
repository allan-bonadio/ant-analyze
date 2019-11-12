
import {mat4} from './gl-matrix';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

// how much rotation velocities fade over time.  
// Keep between ~.5 ... .999 or 1 for no friction
const ROTATION_FRICTION = .75;

// call them like this
// let plot = new blanketPlot(
// 		document.getElementById('blanket-plot'),
// 		nXCells, nYCells);
// 
// plot.attachData(blanketData);
// 
// plot.startInteraction();	

class blanketPlot {
	// canvas is the canvas DOM node
	// nXCells and nYCells is dimensions of blanket area in cell coords
	constructor(canvas, nXCells, nYCells) {
		[this.canvas, this.nXCells, this.nYCells] = [canvas, nXCells, nYCells];
		
		// allocation of array spaces
		this.nBlanketVertices = 2 * (nXCells + 2) * nYCells - 2;
		this.nAxisVertices = 24;
		this.nVertices = this.nBlanketVertices + this.nAxisVertices;

		// angle human is looking at it with
		this.lattRotation = 3;  // 0...π
		this.longRotation = 0;  // primarily 0...2π but it's allowed to 
					// wrap around a few circles if needed...??
		this.lattVelocity = 0;
		this.longVelocity = 0;
		
		// better for production, imparts initial spin
		//this.lattVelocity = -.1;
		//this.longVelocity = .1;
		
		
		// set up and make sure gl is possible
		this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

		// If it can't do GL, give up now
		if (!this.gl) {
			throw new Error("Unable to initialize WebGL. "+ 
				"Your browser or machine may not support it.");
			return null;
		}

		// stuff to be done once
		this.initShaderProgram();
		this.attachMouseHandlers();
		this.createProgramInfo();

		this.then = 0;
	}
	
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
				msg = "WebGL context is lost.";
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
	
	setBlanketVertices(pOffset, cOffset) {
		let pos = this.positions;
		let col = this.colors;
		let bla = this.blanket;
		
		function addVertex(x, y) {
			let b = bla[x][y];

			// all single floats the way the gpu likes it
			pos[pOffset++] = x;
			pos[pOffset++] = y;
			pos[pOffset++] = b.z;
			
			col[cOffset++] = b.red;
			col[cOffset++] = b.green;
			col[cOffset++] = b.blue;
			col[cOffset++] = b.alpha;
		}
		
		// now go through all blanket vertices
		// each is a triangle drawn with gl.TRIANGLE_STRIP, 
		// one for every 3 consecutive vertices (overlapping)
		let x, y;
		// note we don't do the last row!  each band is 1 high.
		for (y = 0; y < this.nYCells; y++) {
			let b;
		
			// a degenerate vertex; needed to goto next row
			if (y > 0)
				addVertex(0, y);
			
			for (x = 0; x <= this.nXCells; x++) {
				// 2 buffer, 2 floats each
				addVertex(x, y);
				addVertex(x, y + 1);
			}
			
			// a degenerate vertex; needed to goto next row
			if (y < this.nYCells-1)
				addVertex(this.nXCells, y+1);
		}
		return [pOffset, cOffset];
	}
	
	// Always 24 vertices.
	setAxisVertices(pOffset, cOffset) {
		let x, y, z, xCells = this.nXCells, yCells = this.nYCells, zCells = 1;
		let pos = this.positions;
		let col = this.colors;
		
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

	dumpBuffers() {
		function n(x) {
			return x.toFixed(2);
		}
		
		let pos = this.positions;
		let col = this.colors;
		let p, vert;

		for (vert = 0; vert < this.nBlanketVertices; vert++) {
			p = vert * 3;
			console.log("blanket positions %d: %s %s %s", 
				vert, n(pos[p]), n(pos[p+1]), n(pos[p+2]));
			
		}
		console.log(' ');

		for (vert = 0; vert < this.nBlanketVertices; vert++) {
			p = vert * 4;
			console.log("blanket color %d: %s %s %s %s", 
				vert, n(col[p]), n(col[p+1]), n(col[p+2]), n(col[p+3]));
 		}
		console.log(' ');

		for (vert = this.nBlanketVertices; vert < this.nVertices; vert++) {
			p = vert * 3;
			console.log("axis positions %d: %s %s %s", 
				vert, n(pos[p]), n(pos[p+1]), n(pos[p+2]));
		}
		console.log(' ');

		for (vert = this.nBlanketVertices; vert < this.nVertices; vert++) {
			p = vert * 4;
			console.log("axis color %d: %s %s %s %s", 
				vert, n(col[p]), n(col[p+1]), n(col[p+2]), n(col[p+3]));
		}
		console.log(' ');
	}
	
	// called by client to give the data, and generates the compact arrays
	attachData(blanket, unitsPerCell) {
		this.positions = new Float32Array(this.nVertices * 3);
		this.colors = new Float32Array(this.nVertices * 4);
	
		// each of these routines fills the arrays with data for different things being drawn
		let pOffset = 0, cOffset = 0;
		[pOffset, cOffset] = this.setBlanketVertices(pOffset, cOffset);
		if (pOffset != this.nBlanketVertices*3)
			console.error("pOffset b is wrong: %d instead of %d", 
				pOffset, this.nBlanketVertices*3);
		if (cOffset != this.nBlanketVertices*4)
			console.error("cOffset b is wrong: %d instead of %d", 
				cOffset, this.nBlanketVertices*4);
		
		[pOffset, cOffset] = this.setAxisVertices(pOffset, cOffset);
		if (pOffset != this.nVertices*3)
			console.error("pOffset a is wrong: %d instead of %d", 
				pOffset, this.nBlanketVertices*3);
		if (cOffset != this.nVertices*4)
			console.error("pOffset a is wrong: %d instead of %d", 
				cOffset, this.nBlanketVertices*4);

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
		// and we only want to see objects between 0.1 units
		// and 100 units away from the camera.
		const projectionMatrix = mat4.create();
		mat4.perspective(projectionMatrix,
			 45 * Math.PI / 180,
			 gl.canvas.clientWidth / gl.canvas.clientHeight,
			 0.1,  // clipping near
			 100.0);  // clipping far

		// Set the drawing position to the center of the scene.
		// then transform it as needed
		const modelViewMatrix = mat4.create();

		// where to back up to, to see it best
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[0, 0, -1.0 * (this.nXCells + this.nYCells)]);
		
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

		// where to slide over to to, to see it best
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[-this.nXCells/2, -this.nYCells/2, 0]);

			//original [-0.0, 0.0, -6.0]);	// amount to translate

		// Set the shader uniforms
		let uls = this.programInfo.uniformLocations;
		gl.uniformMatrix4fv(uls.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(uls.modelViewMatrix, false, modelViewMatrix);
	}
	
	drawOneFrame() {
		let gl = this.gl;
		
		// set some gl variables
		gl.clearColor(0.0, 0.0, 0.0, 1.0);	// Clear to black, fully opaque
		gl.clearDepth(1.0);				 // Clear everything
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
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.nBlanketVertices);
		this.checkOK();
		gl.drawArrays(gl.LINES, this.nBlanketVertices, this.nAxisVertices);
		this.checkOK();
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
		now *= 0.001;  // convert to seconds
		
		// the first time, then is undefined and so are the others
		let deltaTime = now - this.then;
		this.then = now;

		this.drawOneFrame();
		
		// Update the rotation for the next draw (but keep it to 0...whatever)
		this.longRotation = (this.longRotation + this.longVelocity * deltaTime) / twoπ;
		this.longRotation = (this.longRotation - Math.floor(this.longRotation)) * twoπ;
		this.lattRotation = (this.lattRotation + this.lattVelocity * deltaTime);

		// constrain latt to 0...180°, stop it if it hits end
		if (this.lattRotation < 0) {
			this.lattRotation = 0;
			this.lattVelocity = 0;
		}
		if (this.lattRotation > π) {
			this.lattRotation = π;
			this.lattVelocity = 0;
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


