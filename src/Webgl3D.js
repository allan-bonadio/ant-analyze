/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React, { Component } from 'react';

import {scaleLinear} from 'd3-scale';

//import $ from 'jquery';

import './Webgl3D.css';
import config from './config';
import blanketPlot from './blanketPlot';
import graphicEvents from './graphicEvents';

import {generateBlanket} from './genComplex';

// don't try to type these names, just copy paste
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π

//import {mat4} from 'gl-matrix';

// better.  choose n cells in x and y direction to make total xy cells
// nice if this is a perfect square
//const TARGET_CELLS = 1600;
//const TARGET_CELLS = 16;  // for testing
const TARGET_CELLS = 144;  // for testing

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
		
		// for testing, pass in innerWidth and innerHeight props
		let innerWidth = props.innerWidth || window.innerWidth;
		let innerHeight = props.innerHeight || window.innerHeight;
		
		// without the 2d/3d suffix
		this.name = this.props.name || 'Graph';
		
		

		// these affect the way mouse drags work.  Horiz repeats over 2π
		this.horizCyclic = twoπ * HORIZ_EVENTS_FACTOR;  // 0....2π
		
		// constrain latt to -90°...90°, stop it if it hits end
		this.vertClamp = [-π_2 * VERT_EVENTS_FACTOR, π_2 * VERT_EVENTS_FACTOR];

		this.state = {
			// these are part of the state as they directly affect the canvas
			graphWidth: innerWidth - 4,
			graphHeight: innerHeight - 200,
			
		};
		
		// you might think these are part of the state, 
		// but the state only applies to the canvas, not what's drawn in it 
		// (which doesn't happen at render time);
		this.setupIndex = -1;
		
		this.xMin = this.yMin = -1;
		this.xMax = this.yMax = 1;

		this.nXCells = this.nYCells = 1;
	}
	
	componentDidMount() {
		this.events = new graphicEvents(this, 
			()=>{
				// this actually does the webgl drawing
				this.drawOneFrame();
			}, 
			()=>{
				// maybe we don't need shove cuz the h/v positions 
				// are passed in in drawOneFrame()
			}
		);
		
		// now that the canvas is created, we can grab it for 3d
		this.setScene(this.props.requestedIndex);
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
		this.nYCells = Math.sqrt(TARGET_CELLS * 
			(scene.yMax - scene.yMin) / (scene.xMax - scene.xMin));
		this.nYCells = Math.round(this.nYCells);
		this.nXCells = Math.round(TARGET_CELLS / this.nYCells);
		//console.log("Webgl3D: So I get XCELLS=%s, YCELLS=%s", this.nXCells, this.nYCells);
		// note the number of vertices in both directions is +1 more than cells

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
				nXCells: this.nXCells, nYCells: this.nYCells,
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

	static getDerivedStateFromError() {
		console.error('getDerivedStateFromError:', arguments);
	}
	
	componentDidCatch() {
		console.error('componentDidCatch:', arguments);
	}
	
	// create the pixel data based on the function.
	calcPoints() {
		this.blanket = generateBlanket(
			this.scene.funcs[0].func, 
			this.nXCells, this.nYCells,
			this.xScale.invert, this.yScale.invert, this.zScale
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
	
	// draw the canvas that'll show it.  
	// if this.plot is there, the state, data, and scalers must be set up.
	// These might have changed:
	// x/y max/min  graphWidth/Height
	// note render is NOT called when the 3d drawing is needed; 
	// that's done in drawOneFrame()
	render() {
		// if 2d is on, forget it.  
		// If no blanket, must be first render; not even any data yet.
		let style = this.props.show ? {} : {display: 'none'};
		let state = this.state;

		
		// react doesnt recognize touch events - needed for gestures
		// so use jQuery in graphicEvents
		return (
			<div className='webgl-chart' style={style} >
				<canvas id={this.name + '3D'} 
					width={state.graphWidth} height={state.graphHeight}
					onMouseDown={this.events ? this.events.mouseDownEvt : ()=>{}}
					ref={canvas => this.graphElement = canvas}>
					This displays a 3-D image of the surface.
				</canvas>
			</div>
		);
	}
	
	drawOneFrame() {
		// if not supposed to be shown, or not mature, can it
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
		this.props.setReadout(r2d(horizPosition / HORIZ_EVENTS_FACTOR).toFixed() +'°Long  '+
				r2d(vertPosition/VERT_EVENTS_FACTOR).toFixed() +'°Lat '+ (extra || ''));
	}

	/* ******************************************************* resize window & webgl */
	
	specialForResize(graphWidth, graphHeight) {
		// um, maybe nothing needs to be done
		// no lets try this
		// redo the gl thing to see if it makes a difference
// 		let canvas = document.getElementById(this.name + '3D');
// 		this.plot.gl = canvas.getContext('webgl') || 
// 					canvas.getContext('experimental-webgl');




	}
	

}

export default Webgl3D;

