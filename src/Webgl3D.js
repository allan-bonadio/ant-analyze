/* eslint-disable eqeqeq, no-throw-literal  */
import React, { Component } from 'react';

import './Webgl3D.css';
import {config} from './config.js';
import blanketPlot from './3d/blanketPlot.js';
import graphicEvents from './graphicEvents.js';
import backdrop from './3d/backdrop.js';
import generateBlanket from './3d/generateBlanket.js';
import {AxisTics} from './3d/AxisTics.js';

// don't try to type these names, just copy paste
// eslint-disable-next-line no-unused-vars
const π = Math.PI, π_2 = Math.PI/2, twoπ = Math.PI * 2;  // ②π
// choose n cells in x and y direction to make total x*y cells, approx.
// So, to make approx a 10x10 bed of cells, try 100.
// this actually doesn't have to be perfect square; just a target. min: 4

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
		if (vc[0] > vc[1]) [vc[0], vc[1]] = [vc[1], vc[0]];

		// no state!  all particulars are handed in via props.
		// the state only applies to the canvas, not what's drawn in it
		// (which doesn't happen at render time).  It's an uncontrolled component.
		// typically graphWidth, graphHeight, requestedIndex, .show - in props
		this.state = {
			scene: null,
		};

		this.shoveFunc = this.shoveFunc.bind(this);
		// these are on 'this', just added later
		// events - points to graphicEvents object
		// plot - points to blanketPlot object
		// blanketAr - raw science coords in n x m array
		// for each x y z:
		// xMin, xMax, nXCells
		// xScale -  convert science coords to cell coords
		// xPerCell - slope of scale

		// ok to call this in constructor cuz it just triggers WebGL
		this.drawOneFrame = this.drawOneFrame.bind(this);
	}

	componentDidMount() {
		// with the dom stuff in place, we can set up click and drag stuff
		this.newScene(this.props.requestedIndex);
		this.events = new graphicEvents(this, this.sensitiveElement,
				this.drawOneFrame, this.shoveFunc, this.props.goToScene);
		if (this.props.show) {
			// now that the canvas is created, we can grab it for 3d
			// do the other part of blanketAr initialization
			//done in render by ref this.plot.attachCanvas(this.graphElement);
			// webgl needs the canvas to exist in order to draw into it
			// we know it does now
			// ok so this is too erly no gl yet
			//this.drawOneFrame();
		}
	}

	// re-calibrate this to the scene passed in.
	// must have 'show' be true; ie scene.graphics == '3D'
	// calculates everything down to cell coordinates.
	newScene(sceneIndex) {
		// set this.scene, even if it's not for us
		let scene = this.scene = config.scenes[sceneIndex];

		if (this.scene.graphics != '3D')
			return;
		this.setState({scene});  // make sure some buffers are recreated
		let bkdrop = this.bkdrop = new backdrop(scene);

		// gotta calculate this whole thing over
		this.plot = new blanketPlot(this, this.bkdrop);

		// this generates a blanketAr, and evaluates the function over the cell block
		this.calcPoints(this);

		// stick data into plot, and find its zScale, and anything else you can do
		// without the canvas or gl existing
		this.plot.attachData(this.blanketAr);

		// use the right one.
		graphicEvents.use(this.events);
	}

	// get ready, 'soon' we'll be rendering this new scene.
	// calculate all that stuff.
	static prepForNewScene(sceneIndex) {
		let me = Webgl3D.me;
		me.newScene(sceneIndex);
		graphicEvents.use(me.events);
		// um... stop scrolling pleeze
		me.events.stopAnimating();
	}

	// create the data based on the function, in the shape of the cells, but science coords.
	calcPoints() {
		const bkdrop = this.bkdrop;
		this.blanketAr = generateBlanket(
			bkdrop.funcs[0].func,
			bkdrop.nXCells, bkdrop.nYCells,
			bkdrop.xScale.invert, bkdrop.yScale.invert
		);
	}

	// draw the canvas that'll show it.
	// if this.plot is there, the state, data, and scalers must be set up.
	// These might have changed:
	// x/y max/min  graphWidth/Height
	// note render is NOT called when the 3d drawing is needed;
	// that's done in drawOneFrame()
	render() {
		// if 3d isn't on, forget it.  Otherwise, enforce wid & height with iron fist.
		let props = this.props;
		let canvasStyle = {width: props.graphWidth, height: props.graphHeight}
		let wrapperStyle = {display: (this.props.show ? 'block' : 'none'),
				...canvasStyle};
		let plot = this.plot;
		// react doesnt recognize touch events - needed for gestures
		return (
			<div className='webgl-chart' style={wrapperStyle}
					ref={webglChart => this.sensitiveElement = webglChart}>
				<AxisTics style={canvasStyle} bkdrop={this.bkdrop} />
				<canvas id={this.name + '3D'}
					style={canvasStyle} width={props.graphWidth} height={props.graphHeight}
					onMouseDown={this.events ? this.events.mouseDownEvt : ()=>{}}
					ref={canvas => plot && canvas && plot.attachCanvas(canvas)} >
					This displays a 3-D image of the surface.
				</canvas>
			</div>
		);
	}

	// queue off a process to draw it thru webgl.  (Only if this is show ing)
	// everything must have been calculated before.
	// Called in compDidUpdate() and compDidMount(), no earlier
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
	}

	// graphicEvents calls us after the rotation position changed to set the readout
	// extra is for debugging mostly
	setReadout(horizPosition, vertPosition, extra) {
		let r2d = radians => radians * 180 / Math.PI;
		this.props.setReadout(r2d(horizPosition / HORIZ_EVENTS_FACTOR).toFixed() +'° long  '+
				r2d(vertPosition/VERT_EVENTS_FACTOR).toFixed() +'° lat '+ (extra || ''));
	}

	/* ******************************************************* mouse/touch evts */
	// called while user rotates graph.  abstract default; function changes 2d/3d
	shoveFunc() {
	}

	// gets called from ge if user does a spreading gesture left & right
	spreadHoriz(delta, lastDelta, touchMidPoint) {
		// 'soon'
	}

	// gets called from ge if user does a spreading gesture up & down
	spreadVert(delta, lastDelta, touchMidPoint) {
		// 'soon'
	}

	/* ******************************************************* resize window & webgl */
	adjustForResize(graphWidth, graphHeight) {
		if (! this.props.show)
			return;
		this.plot.adjustForResize(graphWidth, graphHeight);
	}

	// break up big and potentially circularly-pointing data structures
	dispose() {
		this.blanketAr = this.funcs = this.vertexSeries = null;
		this.events.dispose();
		this.events = null;
		this.plot.dispose();
		this.plot = null;
		Webgl3D.me = null;
	}
}
export default Webgl3D;
