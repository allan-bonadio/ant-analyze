/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
import {select} from 'd3-selection';

//import $ from 'jquery';

import './Svg2D.css';
import config from './config';
import graphicEvents from './graphicEvents';


// to make room for axes that may be cut off at the edges
export const axisMargin = 4;

// if mouse is too powerful, increase these.  Adjust to work so moving q pixels
// to the right moves the xmin and xmax q pixels to the left.
// So it looks like you're sliding the solid background around with your finger.
//Try it on different screen/svg sizes.  yes you have to adjust these by hand.
const HORIZ_EVENTS_FACTOR = -40;
const VERT_EVENTS_FACTOR = 1.25;

// there is one of these total, it displays differences depending on its
// requestedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;

		// without the 2d/3d suffix
		this.name = this.props.name + 'Graph';

		let sceneState = this.claimSceneState(this.props.requestedIndex);

		// the inner size of the svg el - changes on window resize
		// or iPhone rotate events (you sure about that?)
		this.state = {
			// this is static - our graphEvents isn't even instantiated yet

			...sceneState,

			// The first draw, the y min/max comes from reRange().  After that,
			// it's state that the user can change by dragging
			yMin: -1,
			yMax: 1,
		};
		this.resetMargins(this.props.graphWidth, this.props.graphHeight);
		this.createScales();
		// that's what needs to be created if the 2d is hidden.

		if (this.scene.graphics == '2D') {
			this.xScale.domain([this.state.xMin, this.state.xMax]);

			// of course a calc is needed, but also set up the 'last' variables
			this.ensureCalcPoints();
			Object.assign(this.state, this.reRangeYAxis());
			// all set up for the first render
		}

		this.mouseWheelEvt = this.mouseWheelEvt.bind(this);
		this.shoveFunc = this.shoveFunc.bind(this);
		this.drawFunc = this.drawFunc.bind(this);
	}

	componentDidMount() {
		// these are needed for graph sliding & other touch events - touches outside the SVG

		// we don't need a draw function because shoveFunc changes the state
		// which will end up redrawing
		this.events = new graphicEvents(this, this.graphElement, this.drawFunc, this.shoveFunc);

	}

	// graphicEvents calls us after the drag position changed to set the readout
	// extra is for debugging mostly
	setReadout(horizPosition, vertPosition, extra) {

		// alternate arrow chars: ' ➨➙ ➛➜ ➠➔→ '
		this.props.setReadout(this.state.xMin.toFixed(2) +' ➜ '+
				this.state.xMax.toFixed(2) +' '+ (extra || ''));
	}

	// look up this scene and set us up for it.
	// DOESN'T set the state, instead returns the changes needed to the state,
	// including xMin/Max.  The scene and funcs are attached immediately.
	claimSceneState(sceneIndex) {
		this.scene = config.scenes[sceneIndex];
		this.funcs = this.scene.funcs;

		return {xMin: this.scene.xMin, xMax: this.scene.xMax};
	}

	// change to given scene.  If it's 3d, then not much to do as we'll be hidden.
	// calculate all that stuff.
	newScene(sceneIndex) {
		let scene = config.scenes[sceneIndex];
		this.scene = scene;  // even if it's not for us

		if (scene.graphics == '2D') {
			this.xScale.domain([scene.xMin, scene.xMax]);

			// set this up for this scene.  xMin...xMax go into state
			let stateAdditions = this.claimSceneState(sceneIndex);
			this.setState(stateAdditions);

			// but we won't see those for a while.  But we can calc.
			this.ensureCalcPoints(stateAdditions);

			// now we have the mins/maxes and can set the Y ranges.
			// Which also involve state changes.
			this.setState(this.reRangeYAxis());

			// which graphicEvents do I want to use?  my own of course.
			graphicEvents.use(this.events);
		}
	}

	// get ready, 'soon' we'll be rendering this new scene.
	// NOT the first time this component has rendered a scene.
	static prepForNewScene(sceneIndex) {
		Svg2D.me.newScene(sceneIndex);

		// um... stop scrolling pleeze
		Svg2D.me.events.stopAnimating();
	}

	// create the pixel data based on the function.  (always)
	// state passed in is the state you should use instead of this.state
	calcPoints(state) {
		let vertexSeries = [];  // no series
		for (let f = 0; f < this.funcs.length; f++) {
			let func = this.funcs[f];

			// x units per k increment.  min, max, n can change upon every redraw.
			const xPerK = (state.xMax - state.xMin) / (func.nPoints - 1);
			if (isNaN(xPerK)) debugger;

			vertexSeries[f] = new Array(func.nPoints);  // add on a new series
			for (let k = 0; k < func.nPoints; k++) {
				let x = k * xPerK + state.xMin;  // range 0...nPoints maps to xmin...xmax
				if (isNaN(x)) debugger;
				let y = func.func(x);

				// the limit as x approaches... this only works for pinhole singularities
				if (isNaN(y))
					y = (func.func(x + 1e-10) + func.func(x - 1e-10)) / 2;

				vertexSeries[f][k] = {x, y};
			}
		}
		this.vertexSeries = vertexSeries;
	}

	// it'll maybe call this.calcPoints()
	// if it needs to, and remembers stuff for next time
	ensureCalcPoints(stateAdditions = {}) {
		let s = {...this.state, ...stateAdditions};

		this.calcPoints(s);

		// save these so we can tell if calc needs to be redone
		this.lastCalcIndex = this.props.requestedIndex;
		this.lastCalcXMin = s.xMin;
		this.lastCalcXMax = s.xMax;
	}

	// set the range of the scales, pixel coordinates.  Do this after resetMargins()
	// domains still need to be set!
	setScaleRanges() {
		this.xScale.range([this.marginLeft, this.marginRight]);
		this.yScale.range([this.marginBottom, this.marginTop]);
	}

	// make the X and Y scalers, but their domains (science units) aren't set.
	createScales() {
		this.xScale = scaleLinear();
		this.yScale = scaleLinear();
		this.setScaleRanges();
	}

	// Sample the calculated function, and choose y min & max, and set the state so
	// that'll be how it's drawn.  Only when you need to set the default range.
	// Don't call it on every render or else user won't be able to drag up or down!
	// It doesn't set the state directly; it just hands back a state-change object.
	// You have to either setState() or merge it into the state or whatever.
	reRangeYAxis() {
		// find the unified extent of all of the y values of all the functions
		let mini = Infinity, maxi = -Infinity, mi, mx;
		for (let f = 0; f < this.vertexSeries.length; f++) {
			[mi, mx] = extent(this.vertexSeries[f], d => d.y);
			mini = Math.min(mi, mini);
			maxi = Math.max(mx, maxi);
		}

		// domain here refers to the y scaler, which takes the science y
		// values and converts to pix coords.
		this.yScale.domain([mini, maxi]);
		if (isNaN(this.yScale.domain()[0])) debugger;

		return {yMin: mini, yMax: maxi};
	}

	// render the axes, return an array [xAxis, yAxis] of React elements.
	// Need xScale and yScale.
	renderAxes() {
		if (!this.props.show)
			return [];

		// axis generation - choose which side so tic labels don't go off edge
		let xAxis, yAxis;
		let s = this.state;
		if  (s.yMin + s.yMax > 0)
			xAxis = axisTop(this.xScale).ticks(7).tickPadding(9);
		else
			xAxis = axisBottom(this.xScale).ticks(7);

		if (s.xMin + s.xMax > 0)
			yAxis = axisRight(this.yScale).ticks(5).tickPadding(15);
		else
			yAxis = axisLeft(this.yScale).ticks(5);

		// the axes need to still be on the chart.  We'd like zero-zero but figure out the best.
		let xAxisY = Math.max(s.yMin, Math.min(s.yMax, 0));
		let yAxisX = Math.max(s.xMin, Math.min(s.xMax, 0));

		// wait! if some of the tick labels would overlap an axis, get rid of them
		xAxis.tickFormat(x => Math.abs(x - yAxisX) < 0.1 ? ' ' : x);
		yAxis.tickFormat(y => Math.abs(y - xAxisY) < 0.1 ? ' ' : y);

		return [
			<g className='xAxis' key='xAxis' ref={node => select(node).call(xAxis)}
					style={{transform: 'translateY('+ this.yScale(xAxisY) +'px)'}} /> ,
			<g className='yAxis' key='yAxis' ref={node => select(node).call(yAxis)}
					style={{transform: 'translateX('+ this.xScale(yAxisX) +'px)'}} />
		];
	}

	// draw it.  the state must be set up (see constructor).  These might have changed:
	// x/y max/min  graphWidth/Height so everything recalculated here.
	render() {
		let style = {display: 'none'};

		let props = this.props;
		let linePaths = [];
		if (props.show) {
			style = {};

			// Create a line paths for each series in our data.

			// lineSeries is a mapper that takes an entire series and churns
			// out the SVG coordinate string for the d attribute.
			// .x() and .y() set accessors into the items.
			const lineSeries = line()
				.x(d => this.xScale(d.x))
				.y(d => this.yScale(d.y));

			// linePaths is an array of <path elements, each to be drawn.
			// ready for sticking into an svg.
			linePaths = this.vertexSeries.map((series, ix) =>
					<path className='series' d={lineSeries(series)} key={ix}
						stroke={this.funcs[ix].color} />);
		}

		let viewBox = `0 0 ${props.graphWidth} ${props.graphHeight}`;

		// react doesnt recognize touch events (doesn't list) - needed for gestures
		// so use jQuery in DidMount
		// I think we have to set width and height directly here; css doesn't do it
		return (
			<svg className='svg-chart'
						viewBox={viewBox}
						width={props.graphWidth} height={props.graphHeight}
						preserveAspectRatio='none'
						onMouseDown={this.events ? this.events.mouseDownEvt : ()=>{}}
						onWheel={this.mouseWheelEvt}
						ref={svg => this.graphElement = svg}
						style={style} >

				{this.renderAxes()}
				<g className='line-paths'>
						{linePaths}
				</g>
			</svg>
		);
	}

	// called by ge when window gets resized, hence graph area is resized
	resetMargins(graphWidth, graphHeight) {
		// where data drawn; slightly inside the full graph
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = graphWidth - axisMargin;
		this.marginBottom = graphHeight - axisMargin;
	}

	// called by ge when window gets resized, hence graph area is resized
	adjustForResize(graphWidth, graphHeight) {
		this.resetMargins(graphWidth, graphHeight);

		this.setScaleRanges();

		if (this.props.show) {
			this.setState(this.reRangeYAxis());

		}
	}

	/* ******************************************************* drag move around */
	// call this every time you want to slide the graph over (translate),
	// as a result of some kind of mouse/touch move
	// the abs are the full horiz/vert coordinate; rel are change from last time
	shoveFunc(hAbs, vAbs, hRel, vRel) {
		if (! this.props.show)
			return;

		hRel = hRel * HORIZ_EVENTS_FACTOR;
		vRel = vRel * VERT_EVENTS_FACTOR;

		// only these are in the state; all else are dependent
		const s = this.state;
		const newRanges = {
			xMin: s.xMin + hRel, xMax: s.xMax + hRel,
			yMin: s.yMin + vRel, yMax: s.yMax + vRel,
		};
		this.setState(newRanges);

		this.xScale.domain([newRanges.xMin, newRanges.xMax]);
		this.yScale.domain([newRanges.yMin, newRanges.yMax]);
	}

	// called by graphicEvents when we've scrolled, but not yet redrawn.
	// called after shoveFunc called.
	drawFunc(horizPosition, vertPosition) {
		this.ensureCalcPoints();
	}

	// gets called from ge if user does a spreading gesture left & right
	spreadHoriz(delta, lastDelta, touchMidPoint) {
		let midi = this.xScale.invert(touchMidPoint[0]);
		let factor = lastDelta[0] / delta[0];
		////console.log("horiz, factor=", factor, lastDelta, delta);
		let xMin = (this.state.xMin - midi) * factor +  midi;
		let xMax = (this.state.xMax - midi) * factor +  midi;
		this.setState({xMin , xMax});

		////console.log("xmin/max:", xMin, xMax);
		this.xScale.domain([xMin, xMax]);
	}

	// gets called from ge if user does a spreading gesture up & down
	spreadVert(delta, lastDelta, touchMidPoint) {
		let midi = this.yScale.invert(touchMidPoint[1]);
		let factor = lastDelta[1] /  delta[1];
		////console.log("vertical, factor=", factor, lastDelta, delta);
		let s = this.state;
		let yMin = (s.yMin - midi) * factor +  midi;
		let yMax = (s.yMax - midi) * factor +  midi;
		this.setState({yMin, yMax});

		////console.log("ymin/max:", this.yMin, this.yMax);
		this.yScale.domain([yMin, yMax]);
	}


	mouseWheelEvt(ev) {
		console.log("mouseWheelEvt x y z", ev);
		////console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
		//this.mouseUpEvt(ev);
		// ??? this gives error message
		// react-dom.development.js:4944 [Intervention] Unable to preventDefault inside passive event listener due to target being treated as passive. See https://www.chromestatus.com/features/6662647093133312
		//ev.preventDefault();
	}

	// break up big and potentially circularly-pointing data structures
	dispose() {
		this.funcs = this.vertexSeries = null;
		if (this.events)
			this.events.dispose();
		this.events = null;
		Svg2D.me = null;
	}
}

export default Svg2D;

