//
// blanket plot - a WebGL helper library to draw a blanket plot.
//					basically, a surface z = f(x, y), like that.
//
/* eslint-disable eqeqeq, no-throw-literal  */
import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {hsl} from 'd3-color';
import {mat4, vec4} from 'gl-matrix';
import {config} from '../config.js';
import vertexBuffer from './vertexBuffer.js';
import blanketTriangles from './blanketTriangles.js';
import axisBars from './axisBars.js';
import weatherVane from './weatherVane.js';
import {AxisTics, axisTicsPainter} from './AxisTics.js';
import Webgl3D from '../Webgl3D.js';

// don't try to type these names, just copy paste
// eslint-disable-next-line no-unused-vars
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π didn't work

// the weather  vane is just a 3d triangular pyramid, for testing
let includeWeatherVane = false;
//let includeWeatherVane = !config.production;

// this is NOT a react component; does GL

// note: gl-matrix.js always has the first argument
// as the destination to receive the result.
/*   Guide to Coordinate Systems: see README file */
/* *************************************************** blanketPlot */
// call them like this:
//    create it, passing a Canvas element, and how big
//		let plot = new blanketPlot(
// 			webgl3d,
// 			{nXCells: xxxx, nYCells:xxx, ...});
//
//      plot.attachData(blanketData);
//		... create your canvas element ...
//		plot.attachCanvas();
//		drawOneFrame(longitude & latitude);
// Manage the webgl and drawing of a surface plot in 3d space.  For each x y value, there's a z value.  THe z values draw a surface, and that's called a blanketPlot.
// Class to talk to graphics processor via webgl.  This use science coordinates much,
// just cell coordinates and cellsize in viewable space
class blanketPlot {
	// options object: nXCells, nYCells = cell dimensions of xy area
	// xPerCell, yPerCell, zPerCell = size of a cell in science space
	constructor(graph, bkdrop) {
		this.graph = graph;  // Webgl3D
		this.bkdrop = bkdrop;

		// these painters set up for the geometry, and in the constructor,
		// calculate max number of vertices they need for each set of graphical things they draw
		this.triangles = new blanketTriangles(this);
		this.axes = new axisBars(this);
		this.axisTics = new axisTicsPainter(this, Webgl3D.me);

		this.painters = [
			this.triangles,
			this.axes,
			this.axisTics,
		];
		// weatherVane diagnostic shows which way is +x, +y and +z (r g b)
		if (includeWeatherVane)
			this.painters.push(new weatherVane(this));

		// total worst-case number of vertices we'll use (each is a pos and a color vertex)
		this.maxVertices = this.painters.reduce((sum, painter) => sum + painter.maxVertices, 0);

		// only for generating frames for an ani gif
		if (config.aniGifFrames)
			setTimeout(this.createVideoFrames.bind(this), 5000);
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
			console.error("error code from webgl: ", err, msg);
		}
	}

	//**************************************************** GL Programs
	// Initialize a shader program, so WebGL knows how to draw our data
	initShaderProgram() {
		let gl = this.gl;
		// Vertex shader program
		const vsSource = `
			attribute vec4 aVertexPosition;
			attribute vec4 aVertexColor;
			uniform mat4 uCompositeMatrix;
			uniform vec4 uClosestCorner;
			varying lowp vec4 vColor;
			void main() {
				vec4 vertexPosition = aVertexPosition;
				vertexPosition.w = 1.0;  // or zero?  doesn't seem to matter

				// for axis tics and labels, always put them in front.
				// the key is the fourth pos component, a bit field stored as a float.
				// notice if 4th component is zero, coordinates stay unmolested
				int bits = int(aVertexPosition.w);
				if (bits > 0) {
					// i can't believe they don't have bitwise and/or
					if (bits >= 4) {
						vertexPosition.z += uClosestCorner.z;
						bits -= 4;
					}
					if (bits >= 2) {
						vertexPosition.y += uClosestCorner.y;
						bits -= 2;
					}
					if (bits == 1)
						vertexPosition.x += uClosestCorner.x;
					;
				}

				gl_Position = uCompositeMatrix * vertexPosition;

				vColor = aVertexColor;
				gl_PointSize = 10.;  // dot size, actually a crude square
				// default is zero so set it if you want to see anything
				// diagnostic: change to POINTS in blanketTriangle's draw method
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
				let err = gl.getShaderInfoLog(shader);
				gl.deleteShader(shader);
				throw new Error('An error occurred compiling the shaders: '+ err);
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
	// for aVertexPosition, aVertexColor and also
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
				compositeMatrix: gl.getUniformLocation(sp, 'uCompositeMatrix'),
				closestCorner: gl.getUniformLocation(sp, 'uClosestCorner'),
			},
		};
	}

	//********************************************************* Data Layout
	// list out ALL the vertices and their colors
	dumpBuffer() {
		console.info("actual data put into vertex buffer")
		this.painters.forEach(painter =>
			this.buffer.dump(painter.name, painter.startVertex, painter.nVertices));
	}

	// derive Z scaler from points calculated in calcPoints()
	// also lightness for complex
	// again, convert from dataspace coords to cell coords, use scale.invert for opposite
	// Blanket z values must be calculated by now!
	deriveZScale() {
		// find the unified extent of all of the z values on all rows
		// At this point there should be no z values that are objects
		let bl = this.blanketAr;
		if (! bl)
			throw "No Blanket Array in deriveScalers()";
		let mini = Infinity, maxi = -Infinity, mi, mx;
		// big is max of absolute values; mi and mx are min/max of z real
		// eslint-disable-next-line no-unused-vars
		let biggest = -Infinity, big, small;
		for (let f = 0; f < bl.length; f++) {
			[mi, mx] = extent(bl[f], d => d.z_science);
			[small, big] = extent(bl[f], d => d.abs);
			if (isNaN(mi + mx)) debugger;
			// collect these but avoid infinity (log over complex plane)
			if (isFinite(mi))
				mini = Math.min(mi, mini);
			if (isFinite(mx))
				maxi = Math.max(mx, maxi);
			// small I don't use
			if (isFinite(big))
				biggest = Math.max(big, biggest);
		}

		// bkdrop holds all these numbers and makes the scales
		let bkdrop = this.bkdrop;
		bkdrop.biggest = biggest;
		bkdrop.zMin = mini;
		bkdrop.zMax = maxi;
		bkdrop.zPerCell = (maxi - mini) / bkdrop.nZCells;

		// that's min and max in science coords.  convert to cell coords.
		// but z values converted to 'cell coords' for webgl
		// note we're scaling z backwards
		bkdrop.createZScale();

		// adjust the color algorithm for larger/smaller complex magnitudes
		// which determine lightness in the complex color
		this.lightnessScale = scaleLinear()
			.range([0, 1])
			.domain([0, biggest]);

		if (!isFinite(bkdrop.zScale(1))) debugger;
	}

	// take a complex value for vert.z (like {re: 1, im: -1})
	// and fill in other components (color, height) to make the 3d complex graph
	// we always keep saturation at 100% for the complex plane
	complexScaleAndColor(vert, lightnessScale) {
		let zre, zim, rgb;
		if (!isFinite(vert.abs)) {
			// special case: |z| = ±∞   eg log(z) at z=0  white
			rgb = {r: 255, g: 255, b: 255};
			zre = Math.min(Math.max(vert.z_data.re, -1e10), +1e10);  // limit it to finite numbers
		}
		else {
			zre = vert.z_data.re;
			zim = vert.z_data.im;

			let hue = 180 * Math.atan2(zim, zre) / Math.PI + 180;  // make it positive
			let lightness = Math.atan(lightnessScale(vert.abs)) * 2 / Math.PI;  // make it 0...1

			rgb = hsl(hue, 1, lightness).rgb();
			// check to see if ANY of these are NaN
			if (isNaN(rgb.r + rgb.g + rgb.b)) debugger;
		}

		vert.red = rgb.r / 255;
		vert.green = rgb.g / 255;
		vert.blue = rgb.b / 255;
		vert.z_science = zre;
	}

	// call this after you've figured out the Z scaling from science coords to cell coords
	// zScale is a function that converts from z_data values to z cell coords
	colorComplexValues() {
		let blanketAr = this.blanketAr;
		let zScale = this.zScale;
		for (let y = 0; y <= blanketAr.nYCells; y++) {
			let row = blanketAr[y];
			for (let x = 0; x <= blanketAr.nXCells; x++) {
				let vert = row[x];

				if (typeof vert.z_data == 'object') {
					// a complex number - convert to z scalar, and color
					this.complexScaleAndColor(vert, this.lightnessScale);
					if (isNaN(vert.z_science + vert.red + vert.green)) debugger;
				}
				vert.z = this.bkdrop.zScale(vert.z_science);
			}
		}
	}

	// called by client to give the data, and generates the compact arrays
	// to be sent to the gpu
	// This is how you feed in your data.  blanketAr = nested JS arrays like
	//		[[el,el,el],[el,el,el],[el,el,el]]
	// Blanket must have same dimensions as passed to blanketPlot constrctor.
	// each value is an object like
	// {x: 2.3, y: 4.5, z: 12.7, red: .4, green: .2, blue: .95, alpha: 1, ...misc}
	// This can be called BEFORE the canvas and gl are created.
	attachData(blanketAr) {
		this.buffer = new vertexBuffer(this.maxVertices);
		this.blanketAr = blanketAr;
		this.deriveZScale();
		this.colorComplexValues();

		// decide on the tics.  Must be after deriveZScale() but before layDownVertices()
		this.axisTics.generateAllTics();

		// each of these routines fills the arrays with data for different things being drawn
		this.painters.forEach(painter => painter.layDownVertices());
		//this.dumpBuffer();
	}
	// This must be called AFTER the canvas and gl are created; pass in the canvas
	// then we'll have this.gl and this.graphElement and everything set up
	// to call drawOneFrame().  Call upon any change to new canvas element.
	attachCanvas(graphElement) {
		if (this.graphElement === graphElement)
			return;

		// all the rest of this is done, pretty much, once during graph startup
		this.graphElement = this.graph.graphElement = graphElement;
		this.graphWidth = graphElement.width;
		this.graphHeight = graphElement.height;
		// takes the canvas, makes the gl
		// set up and make sure gl is possible
		this.gl = this.graphElement.getContext('webgl') ||
					this.graphElement.getContext('experimental-webgl');
		// If it can't do GL, give up now
		if (!this.gl) {
			throw new Error("Unable to initialize WebGL. "+
				"Your browser or machine may not support it.");
		}
		this.initShaderProgram();

		// preps the buffer, attaches it to attributes
		this.buffer.attachToGL(this.gl, this.programInfo.attribLocations);
	}
	// ********************************************************* Draw One Frame

	// diagnostic: make sure these are ok
	verifyMatrices(compositeMatrix) {
		let graph = Webgl3D.me;

		console.info("verify all 8 corners of cell space");
		let vec = vec4.create(), out = vec4.create();
		vec[3] = 1;
		[0, graph.nXCells].forEach(x => {
			vec[0] = x;
			[0, graph.nYCells].forEach(y => {
				vec[1] = y;
				[0, graph.nZCells].forEach(z => {
					vec[2] = z;
					vec4.transformMat4(out, vec, compositeMatrix);
					console.info('%d %d %d =>', x, y, z,
						(out[0]/out[3]).toFixed(2).padStart(6),
						(out[1]/out[3]).toFixed(2).padStart(6),
						(out[2]/out[3]).toFixed(2).padStart(6));
				});
			});
		});
	}

	// find the corner of our space closest to the user.  In Cell coords.
	// changes every time it rotates
	// returns a 3 vector, useful for tic positioning
	findClosestCorner() {
		let graph = this.graph;
		const bkdrop = this.bkdrop;
		if (! ('longitude' in this && 'latitude' in this))
			return [bkdrop.xMin, bkdrop.yMin, bkdrop.zMin];  // too early

		// convert to cell coords on the way out
		return bkdrop.scaleXYZ1([
			Math.floor(this.longitude / π) & 1 ? bkdrop.xMin : bkdrop.xMax,
			Math.floor(this.longitude / π + 1/2) & 1 ? bkdrop.yMax : bkdrop.yMin,
			this.latitude < 0 ? bkdrop.zMin : bkdrop.zMax
		]);
	}
	// calculate the matrices that position and rotate it all into view
	// attach them to this.  Mostly, just the calculation.  No GL.
	deriveMatrices(longitude, latitude) {
		const bkdrop = this.bkdrop;

		// Create a perspective matrix, a special matrix that is
		// used to simulate the distortion of perspective in a camera.
		// Our field of view is 45 degrees, with a width/height
		// ratio that matches the display size of the canvas
		// and we only want to see objects between whatever units
		// away from the camera.
		const projectionMatrix = mat4.create();
		mat4.perspective(projectionMatrix,
			 45 * Math.PI / 180,
			 this.graphWidth / this.graphHeight,
			 0.1,  // clipping near
			 10000.0);  // clipping far
		// Set the drawing position to the center of the scene.
		// then transform it as needed.  This matrix accumultes all the misc transformations.
		const modelViewMatrix = mat4.create();

		// We start with the viewer on this end, and ends with the science coords on the other end.
		// If you want to mess with the way the usual image looks to the user, work on this end.

		// how far to step back to, to see it best.  see also trnslate xLength, yLength
		let xLength = bkdrop.xPerCell * bkdrop.nXCells;  // overall dimensions in science space
		let yLength = bkdrop.yPerCell * bkdrop.nYCells;
		let zLength = bkdrop.zPerCell * bkdrop.nZCells;
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[0, 0, -0.9 * (xLength + yLength)]);

		// in cell units but user has rotated it these amounts.

		// rotate by latitude
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			-π_2 + latitude,   // tip north/south in radians
			[1, 0, 0]);       // around x axis
		// rotate by longitude
		mat4.rotate(modelViewMatrix,  // destination matrix
			modelViewMatrix,  // matrix to rotate
			-longitude,   // east-west rotate in radians
			[0, 0, 1]);       // rotate around z
		// cell units go 0...n which isn't symmetric
		// where to slide viewing eye to to, xy, to see it best
		mat4.translate(modelViewMatrix,		 // destination matrix
			modelViewMatrix,		 // matrix to translate
			[-xLength/2, -yLength/2, -zLength / 2]);
		// now using symmetricized xyz coordinates.
		// apply the xPerCell and yPerCell scaling
		mat4.scale(modelViewMatrix, modelViewMatrix,
			[bkdrop.xPerCell, bkdrop.yPerCell, bkdrop.zPerCell]);

		// ok on this end, we're talking science units.
		// put these together on the client so the gpu doesn't have to multiply every time
		let compositeMatrix = mat4.create();
		mat4.multiply(compositeMatrix, projectionMatrix, modelViewMatrix);
		Object.assign(this, {compositeMatrix, projectionMatrix, modelViewMatrix});
	}

	// make the matrices that position and rotate it all into view.
	// calls deriveMatrices() to actually calculate
	createMatrices(longitude, latitude) {
		let gl = this.gl;
		this.deriveMatrices(longitude, latitude);
		// Set the shader uniform(s) so glsl programs can get at them
		let uniformLocs = this.programInfo.uniformLocations;
		// one matrix that does it all
		gl.uniformMatrix4fv(uniformLocs.compositeMatrix, false, this.compositeMatrix);
		this.checkOK();

		// for axes' tic marks, find the corner of the graph bounds that's closest
		// to the user's eye.  In cell coords. We never actually do anything at this vertex,
		// but each coordinate is used for the other dimensions.  see code.
		this.closestCorner = this.findClosestCorner();

		// tell the shader about the closest corner
		gl.uniform4fv(uniformLocs.closestCorner, this.closestCorner);
		this.checkOK();

		// tell the axis tics machinery about both
		AxisTics.userRotated(this.closestCorner, this.compositeMatrix);
	}

	// called by Webgl3D when the size of the canvas changes; we have to know!
	adjustForResize(graphWidth, graphHeight) {
		this.graphWidth = graphWidth;
		this.graphHeight = graphHeight;

		// this is what we need (otherwise it's all distorted)
		this.gl.viewport(0, 0, graphWidth, graphHeight);
	}

	// trigger WebGL to execute the shaders and consume the big tables and draw it.
	// longitude and latitude are in radians.  Typically this takes about
	// .5 to 15 millisecond to execute, so it queues off stuff to the gpu async.
	drawOneFrame(longitude, latitude) {
		let gl = this.gl;
		this.longitude = longitude;
		this.latitude = latitude;

		// set some gl variables
		gl.clearColor(0.0, 0.0, 0.0, 1.0);	// Clear to black, fully opaque

		gl.clearDepth(1.0);				 // Clear depth buffer (16 bits, distance from viewer)
		gl.enable(gl.DEPTH_TEST);	 // Enable depth testing
		gl.depthFunc(gl.LEQUAL);		// Near things obscure far things

		gl.lineWidth(1.0);  // it's the only option anyway
		this.checkOK();
		// Clear the canvas before we start drawing on it.
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		this.checkOK();
		gl.useProgram(this.programInfo.program);
		this.createMatrices(longitude, latitude);

		// actual drawing
		this.painters.forEach(painter => painter.draw(gl));
	}

	// ******************************************************** misc

	// this is proprietary code to help create an ani gif.
	// It will become a global.  Just set config.aniGifFrames and reload.
	// remember to tweak the numbers in here ahead of time.
	// use makeAniGif.sh to merge the frames into an ani gif
	createVideoFrames() {
		debugger;

		// set the canvas to the size we need
		let wh = [300, 300];
		this.graphElement.setAttribute('width', wh[0]);
		this.graphElement.setAttribute('height', wh[1]);
		this.adjustForResize(wh[0], wh[1]);

		const N_FRAMES = 32;
		let angle = 0;
		let frameNum = 0;
		let delta = 2 * Math.PI / N_FRAMES;
		let interval = setInterval(() => {

			// cook up a sequence of positions (h, v) that look cool, in a circle sortof
			let long = 4.45 + .09 * Math.sin(angle);
			let lat = .35 + .09 * Math.cos(angle);
			this.drawOneFrame(long, lat);

			let h2 = document.createElement('h2');
			h2.appendChild(document.createTextNode(`frame ` + frameNum));
			h2.style.color = 'white';
			document.body.appendChild(h2);
			let frameDataUrl = this.graphElement.toDataURL();
			let img = document.createElement('IMG');
			img.src = frameDataUrl;
			document.body.appendChild(img);

			// kindof like a for() loop
			frameNum++;
			angle += delta;
			// end BEFORE the last frame cuz its identical to the first
			if (angle > 6.28) {
				clearInterval(interval);
				interval = null;

				// do this so I can get at them in the browser
				//document.getElementById('root').style.display = 'none';
				document.body.style.position = 'static';
				alert("generation done.  download them all.");
			}
		}, 1000);
	}

	// break up big and potentially circularly-pointing data structures
	dispose() {
		this.painters.forEach(painter => painter.dispose());
		this.painters = this.triangles = this.axes = this.axisTics = null;

		this.buffer.dispose(this.gl);
		this.gl.deleteProgram(this.shaderProgram);
		this.blanketAr = this.buffer = this.axisTics = this.graph = null;
		this.gl.getExtension('WEBGL_lose_context').loseContext();
		this.gl = null;

		this.graphElement.width = this.graphElement.height = 1;
		this.shaderProgram = this.programInfo = this.graphElement = null;
		blanketPlot.me = null;
	}
}
export default blanketPlot;
window.createVideoFrames = blanketPlot.createVideoFrames;
