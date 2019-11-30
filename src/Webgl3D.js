/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React, { Component } from 'react';

import {scaleLinear} from 'd3-scale';

//import $ from 'jquery';

import './Webgl3D.css';
import config from './config';
import blanketPlot from './3d/blanketPlot';
import graphicEvents from './graphicEvents';

import {generateBlanket} from './3d/genComplex';
import {AxisTics, axisTicsPainter} from './3d/AxisTics';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

// choose n cells in x and y direction to make total x*y cells
// So, to make approx a 10x10 bed of cells, try 100.
// typically this is a perfect square, but actually doesn't have to be; just a target.
const TARGET_CELLS = config.production ? 1600 : 144;

// if mouse is too powerful, increase these.  Adjust to work so moving q pixels 
// to the right rotates the graph in a way that feels intuitive.
// This is a judgement call.
const HORIZ_EVENTS_FACTOR = -.3;
const VERT_EVENTS_FACTOR = .8;

// there is one of these total, it displays differences depending on its requestedIndex prop passed in
class Webgl3D extends Component {
	constructor(props) {
		super(props);
		Webgl3D.me = this;
		
		// without the 2d/3d suffix
		this.name = this.props.name || 'Graph';

		// these affect the way mouse drags work.  Horiz repeats over 2π
		this.horizCyclic = twoπ * HORIZ_EVENTS_FACTOR;  // 0....2π
		
		// constrain lat to -90°...90°, stop it if it hits end.  (Make sure [0] < [1]!)
		let vc = this.vertClamp = [-π_2 * VERT_EVENTS_FACTOR, π_2 * VERT_EVENTS_FACTOR];
		if (vc[0] > vc[1])
			[vc[0], vc[1]] = [vc[1], vc[0]]
			
			
		this.state = {
			// these are part of the state as they directly affect the canvas
			
			// size of canvas
			// for testing, pass in innerWidth and innerHeight props
			...graphicEvents.decideGraphDimensions(props.innerWidth? props : window),
		};
		
		// you might think these are part of the state, 
		// but the state only applies to the canvas, not what's drawn in it 
		// (which doesn't happen at render time).  It's an uncontrolled component.
		this.setupIndex = -1;
		
		// some defaults to get us going
		this.xMin = this.yMin = -1;
		this.xMax = this.yMax = 1;
		this.nXCells = this.nYCells = this.nZCells = 1;
		
		this.drawOneFrame = this.drawOneFrame.bind(this);
		this.shove3D = this.shove3D.bind(this);
	}
	
	componentDidMount() {
		this.events = new graphicEvents(this, this.sensitiveElement, 
				this.drawOneFrame, this.shove3D);
		
		// now that the canvas is created, we can grab it for 3d
		this.setScene(this.props.requestedIndex);
	}
	
	shove3D() {
		axisTicsPainter.rotateAllTics();
	}
	
	setScene(sceneIndex) {
		if (! this.props.show)
			return;
		
		let scene = this.scene = config.scenes[sceneIndex];

		this.funcs = scene.funcs;
		graphicEvents.use(this.events);

		// Reshape the cell block according to the mins/maxes, 
		// so the product ends up being approx TARGET_CELLS, 
		// but still in approximate proportion of x vs y
		// note the number of vertices in both directions is +1 more than cells
		this.nYCells = Math.sqrt(TARGET_CELLS * 
			(scene.yMax - scene.yMin) / (scene.xMax - scene.xMin));
		this.nYCells = Math.round(this.nYCells);
		this.nXCells = Math.round(TARGET_CELLS / this.nYCells);
		this.nZCells = 1;

		this.setupIndex = sceneIndex;
		this.xMin = scene.xMin;
		this.xMax = scene.xMax;
		this.yMin = scene.yMin;
		this.yMax = scene.yMax;

		this.restartWebgl();
		
		this.setState({setupIndex: sceneIndex});
	}
	
	// do this when the blanket data changes, or the canvas dimensions, 
	// or the x/y mins/maxes change
	restartWebgl() {
		// set up the webgl canvas
		let scene = this.scene;
		this.plot = new blanketPlot(
			document.getElementById(this.name + '3D'), 
			{
				nXCells: this.nXCells, 
				nYCells: this.nYCells, 
				nZCells: this.nZCells,
				xPerCell: (scene.xMax - scene.xMin) / this.nXCells, 
				yPerCell: (scene.yMax - scene.yMin) / this.nYCells,
			}
		);

		this.deriveIndependentScales();
		this.calcPoints(this);

		// stick data into plot, and find its zScale
		this.plot.attachData(this.blanket);

		// first render does not call componentDidUpdate()!
		this.drawOneFrame();
	}

	static getDerivedStateFromError(errObj) {
		console.error('getDerivedStateFromError:', arguments);
		debugger;
	}
	
	componentDidCatch(errObj, info) {
		console.error('Webgl3D caught exception:', errObj.stack, info);
		debugger;
	}
	
	// create the data based on the function, in the shape of the cells, but science coords.
	calcPoints() {
		this.blanket = generateBlanket(
			this.scene.funcs[0].func, 
			this.nXCells, this.nYCells,
			this.xScale.invert, this.yScale.invert
		);
	}
	
	// derive the X and Y scaler given the dimensions of the graph.
	// they convert from dataspace coords to cell coords, use scale.invert for opposite
	// call before calculating data as it needs these!
	deriveIndependentScales() {
		this.xScale = scaleLinear().range([0, this.nXCells]);
		this.xScale.domain([this.xMin, this.xMax]);
		this.yScale = scaleLinear().range([0, this.nYCells]);
		this.yScale.domain([this.yMin, this.yMax]);
	}
	
	// scale this 3-vector by our xyz scalers, and return a 4-vector - [3] often ignored
	scaleXYZ(xyz) {
		return [this.xScale(xyz[0]), this.yScale(xyz[1]), this.zScale(xyz[2]), 1];
	}
	
	
	// draw the canvas that'll show it.  
	// if this.plot is there, the state, data, and scalers must be set up.
	// These might have changed:
	// x/y max/min  graphWidth/Height
	// note render is NOT called when the 3d drawing is needed; 
	// that's done in drawOneFrame()
	render() {
		// if 3d isn't on, forget it.  Otherwise, enforce wid & height with iron fist.
		let state = this.state;
		let canvasStyle = {width: state.graphWidth, height: state.graphHeight}
		let showStyle = {display: (this.props.show ? 'block' : 'none'),
				...canvasStyle};
		
		// react doesnt recognize touch events - needed for gestures
		// so use jQuery in graphicEvents instead of react events
		return (
			<div className='webgl-chart' style={showStyle}
					ref={webglChart => this.sensitiveElement = webglChart}>
				<AxisTics style={canvasStyle} />
				<canvas id={this.name + '3D'} 
					style={canvasStyle} width={state.graphWidth} height={state.graphHeight}
					onMouseDown={this.events ? this.events.mouseDownEvt : ()=>{}}
					ref={canvas => this.graphElement = canvas}>
					This displays a 3-D image of the surface.
				</canvas>
			</div>
		);
	}
	
	drawOneFrame() {
		// if not supposed to be shown, or not mature, drop it
		if (! this.props.show || ! this.events || ! this.plot)
			return;
			
		this.plot.drawOneFrame(this.events.horizPosition / HORIZ_EVENTS_FACTOR, 
			this.events.vertPosition / VERT_EVENTS_FACTOR);
	}
	
	componentDidUpdate(prevProps, prevState) {
		if (! this.props.show)
			return;
			
		// webgl needs the canvas to exist in order to draw into it
		// we know it does now
		this.drawOneFrame();
		
		if (prevProps.requestedIndex != this.state.setupIndex) {
			this.setScene(this.props.requestedIndex);  // this sets state and triggers render
		
		}
	}
	
	// graphicEvents calls us after the rotation position changed to set the readout
	// extra is for debugging mostly
	setReadout(horizPosition, vertPosition, extra) {
		let r2d = radians => radians * 180 / Math.PI;
		this.props.setReadout(r2d(horizPosition / HORIZ_EVENTS_FACTOR).toFixed() +'° long  '+
				r2d(vertPosition/VERT_EVENTS_FACTOR).toFixed() +'° lat '+ (extra || ''));
	}

	/* ******************************************************* resize window & webgl */
	
	specialForResize(graphWidth, graphHeight) {
		// this is what we need (otherwise it's all distorted)
		this.plot.gl.viewport(0, 0, graphWidth, graphHeight);
	}
}

export default Webgl3D;

