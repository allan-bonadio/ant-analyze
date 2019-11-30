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
const HORIZ_EVENTS_FACTOR = -.025;
const VERT_EVENTS_FACTOR = .9;

// there is one of these total, it displays differences depending on its 
// requestedIndex prop passed in (see react lifecycle getDerivedStateFromProps())
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;
		
		// for testing, pass in innerWidth and innerHeight props
		let innerWidth = props.innerWidth || window.innerWidth;
		let innerHeight = props.innerHeight || window.innerHeight;
		
		// the inner size of the svg el - changes on window resize or iPhone rotate events
		this.state = {
			graphWidth: innerWidth - 4,
			graphHeight: innerHeight - 200,
			
			renderedIndex: -1,  // rendered, not selected.  be patient.
			xMin: -1,  // just defaults
			xMax: 1,  // will quickly be overwritten
		};
		this.specialForResize(this.state.graphWidth, this.state.graphHeight);
		
		// just defaults for first render or for props.show false
		this.yMin = -1;
		this.yMax = 1;

		this.needsScalerRecalc = true;
		
		// no clamp or cyclic
		
		// tedious
		[
			'mouseWheelEvt', 
			'shoveFunc', 'drawAtPos',
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
	}
	
	componentDidMount() {
		// these are needed for graph sliding & other touch events - touches outside the SVG
		
		// we don't need a draw function because shoveFunc changes the state
		// which will end up redrawing
		this.events = new graphicEvents(this, this.graphElement, this.drawAtPos, this.shoveFunc);
				
		////$(window).on('resize', this.resizeEvt);
		
		// do this to re-render after the blurb box is sized properly
		this.setState(graphicEvents.decideGraphDimensions(window));
	}
	
	// graphicEvents calls us after the drag position changed to set the readout
	// extra is for debugging mostly
	setReadout(horizPosition, vertPosition, extra) {

		// alternate arrow chars: ' ➨➙ ➛➜ ➠➔→ '
		this.props.setReadout(this.state.xMin.toFixed(2) +' ➜ '+ 
				this.state.xMax.toFixed(2) +' '+ (extra || ''));
	}

	// called before the start of a render, this checks for a new index/scene, and changes stuff
	// that's needed for this render
	static getDerivedStateFromProps(props, state2b) {
		if (!props.show)
			return state2b;
		graphicEvents.use(Svg2D.me.events);
		
		// only if user changed scene
		let index = props.requestedIndex;
		if (index == state2b.renderedIndex)
			return null;
		
		let scene = config.scenes[index];
		Svg2D.me.scene = scene;
		Svg2D.me.funcs = scene.funcs;

		// there's been a change in scene.  Reset the bounds & start over
		state2b = {...state2b, 
			xMin: scene.xMin, xMax: scene.xMax, 
			renderedIndex: index,
		};
		
		// now this will render with new scene
		return state2b;
	}
	
	
	// create the pixel data based on the function.  (always)
	calcPoints() {
		let s = this.state;
		let pixelsAr = [];  // no series
		for (let f = 0; f < this.funcs.length; f++) {
			let func = this.funcs[f];
			
			// x units per k increment.  min, max, n can change upon every redraw.
			const xPerK = (s.xMax - s.xMin) / (func.nPoints - 1);
			if (isNaN(xPerK)) debugger;

			pixelsAr[f] = [];  // add on a new series
			for (let k = 0; k < func.nPoints; k++) {
				let x = k * xPerK + s.xMin;  // range 0...nPoints maps to xmin...xmax
				if (isNaN(x)) debugger;
				let y = func.func(x);
				if (isNaN(y))
					y = func.func(x + 1e-10);  // the limit as x approaches...
				pixelsAr[f][k] = {x, y};
			}
		}
		this.pixelsAr = pixelsAr;
		
		if (s.renderedIndex != this.lastCalcIndex)
			this.needsScalerRecalc = true;

	}
	
	// it'll maybe call xxx.calcPoints()
	// if it needs to, and remembers stuff for next time
	ensureCalcPoints() {
		let s = this.state;
	
		// note how the y values are undefined for 2d but 
		// undefined==undefined so it works
		if (s.renderedIndex === this.lastCalcIndex && 
					s.xMin == this.lastCalcXMin && s.xMax == this.lastCalcXMax &&
					s.yMin == this.lastCalcYMin && s.yMax == this.lastCalcYMax)
			return;  // it'll be the same
	
		this.calcPoints();
	
		// save these so we can tell if calc needs to be redone
		this.lastCalcIndex = s.renderedIndex;
		this.lastCalcXMin = s.xMin;
		this.lastCalcXMax = s.xMax;
		this.lastCalcYMin = s.yMin;
		this.lastCalcYMax = s.yMax;
	}

	// derive the X scaler given the points calculated in calcPoints()
	// called initially and for mouse drags (translations)
	deriveIndependentScales() {
		if (! this.pixelsAr)
			throw "No Pixels Array in deriveIndependentScales()";

		this.xScale = scaleLinear()
			.range([this.marginLeft, this.marginRight]);

		// use any series; the x values are all the same
		// we don't really need to do this?  I thought I was going to omit NaN y values...
		this.xScale.domain(extent(this.pixelsAr[0], d => d.x))
	}
	
	// derive Y scaler given the points calculated in calcPoints()
	// called initially and upon scene changes
	// don't call it on every render or else user won't be able to drag up or down!
	deriveDependentScales() {
		if (! this.pixelsAr)
			throw "No Pixels Array in deriveDependentScales()";

		this.yScale = scaleLinear()
			.range([this.marginBottom, this.marginTop]);

		// find the unified extent of all of the y values
		let mini = Infinity, maxi = -Infinity, mi, mx;
		for (let f = 0; f < this.pixelsAr.length; f++) {
			[mi, mx] = extent(this.pixelsAr[f], d => d.y);
			mini = Math.min(mi, mini);
			maxi = Math.max(mx, maxi);
		}
		this.yScale.domain([mini, maxi]);

		// the y range is calculated from values in the state, therefore not part of the state
		this.yMin = mini;
		this.yMax = maxi;
		
		if (isNaN(this.yScale.domain()[0])) debugger;
	}
	
	// render the axes, return an array [xAxis, yAxis].  Need xScale and yScale.
	renderAxes() {
		if (!this.props.show)
			return [];
			
		// axis generation - choose which side so tic labels don't go off edge
		let xAxis, yAxis;
		let s = this.state;
		if  (this.yMin + this.yMax > 0)
			xAxis = axisTop(this.xScale).ticks(7).tickPadding(9);
		else
			xAxis = axisBottom(this.xScale).ticks(7);

		if (s.xMin + s.xMax > 0)
			yAxis = axisRight(this.yScale).ticks(5).tickPadding(15);
		else
			yAxis = axisLeft(this.yScale).ticks(5);
		
		// the axes need to still be on the chart.  We'd like zero-zero but figure out the best.
		let xAxisY = Math.max(this.yMin, Math.min(this.yMax, 0));
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

		let state = this.state;
		let linePaths = [];
		if (this.props.show) {
			style = {};
			
			this.ensureCalcPoints();
			this.deriveIndependentScales();
			if (this.needsScalerRecalc) {
				this.deriveDependentScales();
				this.needsScalerRecalc = false;
			}
			//console.log("Render: ", state, this.xScale.domain(), this.yScale.domain());////
		
			// Create a line path for each series in our data.
			const lineSeries = line()
				.x(d => this.xScale(d.x))
				.y(d => this.yScale(d.y));
			linePaths = this.pixelsAr.map((ar, ix) => 
					<path className='series' d={lineSeries(ar)} key={ix} 
						stroke={this.funcs[ix].color} />);
		}

		let viewBox = `0 0 ${state.graphWidth} ${state.graphHeight}`;
		
		// react doesnt recognize touch events - needed for gestures - so use jQuery in DidMount
		return (
			<svg className='svg-chart'  
						viewBox={viewBox}
						width={state.graphWidth} height={state.graphHeight}
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

	/* ******************************************************* resize window & svg */
	// given the window obj, figure out margins and graphWidth/Height, return object to merge into state
// 	decideSvgDimensions(win) {
// 		// size of the screen (or phony size passed in by testing)
// 		let graphWidth = +(this.props.innerWidth || window.innerWidth);
// 		let graphHeight = +(this.props.innerHeight || window.innerHeight);
// 		
// 		// deduct the height of the blurb box, or if not created yet, just approximate
// 		let blurbHeight = 200, blurbWidth = 400, blurbBox$ = $('.blurb-box')
// 		if (graphWidth > graphHeight) {
// 			if (blurbBox$.length)
// 				blurbWidth = blurbBox$[0].offsetWidth;
// 			graphWidth -= blurbWidth + 4;
// 		}
// 		else {
// 			if (blurbBox$.length)
// 				blurbHeight = blurbBox$[0].offsetHeight;
// 			graphHeight -= blurbHeight + 4;
// 		}
// 
// 		// where data drawn; slightly inside the full svg
// 		this.marginLeft = this.marginTop = axisMargin;
// 		this.marginRight = graphWidth - axisMargin;
// 		this.marginBottom = graphHeight - axisMargin;
// 		this.needsScalerRecalc = true;
// 		
// 		return {graphWidth, graphHeight};
// 	}
// 	
// 	resizeEvt(ev) {
// 		// size of the SVG changes in render() but tell it what
// 		this.setState(this.decideSvgDimensions(ev.target));
// 
// 		console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight, 
// 						this.marginBottom);
// 		console.log(this);
// 		console.log(this.yScale);
// 		console.log(this.yScale.range);
// 		console.log(this.yScale.range());
// 	}
	
	specialForResize(graphWidth, graphHeight) {
		// where data drawn; slightly inside the full graph
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = graphWidth - axisMargin;
		this.marginBottom = graphHeight - axisMargin;
		this.needsScalerRecalc = true;
		
	}
	
	/* ******************************************************* drag move around */
	// call this every time you want to slide the graph over (translate), 
	// as a result of some kind of mouse/touch move
	// the abs are the full horiz/vert coordinate; rel are change from last time
	shoveFunc(hAbs, vAbs, hRel, vRel) {
		if (! this.props.show)
			return;

		hRel = hRel / HORIZ_EVENTS_FACTOR;
		vRel = vRel / VERT_EVENTS_FACTOR;
		
		// only these are in the state; all else are dependent
		const old = this.state;
		const newXRange = {xMin: old.xMin + hRel, xMax: old.xMax + hRel};
		this.setState(newXRange);
		
		this.yMin = this.yMin + vRel;
		this.yMax = this.yMax + vRel;
		
		this.xScale.domain([newXRange.xMin, newXRange.xMax]);
		this.yScale.domain([this.yMin, this.yMax]);
	}
	
	drawAtPos(horizPosition, vertPosition) {
	
	}
	
	// sometimes momentum goes crazy like switching between scenes
	//// fix this!
	static haltMomentum() {
		if (Svg2D.me)
			Svg2D.me.offsetX = Svg2D.me.offsetY = 0;
	}

	mouseWheelEvt(ev) {
		console.log("mouseWheelEvt x y z", ev);
		////console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
		//this.mouseUpEvt(ev);
		// ??? this gives error message
		// react-dom.development.js:4944 [Intervention] Unable to preventDefault inside passive event listener due to target being treated as passive. See https://www.chromestatus.com/features/6662647093133312
		//ev.preventDefault();
	}

	/* ******************************************************* touch & gesture events */
	// touch events are like mouse events, eg touchStart ~= mouseDown.  
	// But the start/end are delivered for events for each finger, and you can have several of them.  
	// Each ev object also has a list of touches, one for each finger that's currently down.
	// Also, you don't have to intercept Move and End events for the window or body;
	// they guarantee the touch events are delivered to the touchStart element.

	// convert the 0th touch in this event to a pseudo-event good enough for the mouse funcs
	// only call this in a one-touch situation
	touchToEvent(ev) {
		let t = ev.touches[0];
		t.preventDefault = ev.preventDefault;  // make it look like an event
		return t;
	}
	
// 	touchStartEvt(ev) {
// 		console.log("touch StartEvt", ev.pageX, ev.pageY, ev.touches);
// 
// 		// when you set touch event handlers, mouse events stop coming.  
// 		// So fake it unless there's 2 or more touches
// 		if (ev.touches.length == 1)
// 			this.mouseDownEvt(this.touchToEvent(ev));
// 		else
// 			this.touchStartHandler(ev)
// 	}
// 	
// 	touchMoveEvt(ev) {
// 		console.log("touchMoveEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1)
// 			this.mouseMoveEvt(this.touchToEvent(ev));
// 		else
// 			this.touchMoveHandler(ev)
// 	}
// 	
// 	touchEndEvt(ev) {
// 		console.log("touchEndEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1)
// 			this.mouseUpEvt(this.touchToEvent(ev));
// 		else
// 			this.touchEndHandler(ev)
// 	}
// 	
// 	touchCancelEvt(ev) {
// 		console.log("touchCancelEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1) 
// 			this.mouseUpEvt(this.touchToEvent(ev));
// 		else
// 			this.touchCancelHandler(ev)
// 	}
// 	
// 	touchForceChange(ev) {
// 		////console.log("touchForceChange", ev.pageX, ev.pageY, ev.touches);
// 	}
	
	/* ******************************************************* 2+ finger gestures */

	// given array of touches, give me delta X and delta Y, over all fingers, top to bottom and L to R
	// retutn array of two vectors: delta and midpoint
	calcTouchFingers(touches) {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		
		// this should only happen on touch end events.  but i think they happen other times too.
		if (touches.length <= 0)
		 	return null;
		
		for (let t = 0; t < touches.length; t++) {
			// these are all in pixel units
			let touch = touches[t];
			minX = Math.min(minX, touch.clientX);
			minY= Math.min(minY, touch.clientY);
			maxX = Math.max(maxX, touch.clientX);
			maxY= Math.max(maxY, touch.clientY);
		};
		
		return [[maxX - minX, maxY - minY], 
				[this.xScale.invert((maxX + minX)/2), this.yScale.invert((maxY + minY)/2)]];
	}
	
// 	touchStartHandler(ev) {
// 		// pull the plug on normal drag, which has been started
// 		this.dragging = false;
// 		this.setState(this.downMinMax);
// 
// 		[this.lastDelta, this.touchMidPoint] = this.calcTouchFingers(ev.touches);
// 
// 		this.spread = Math.abs(this.lastDelta[0]) > Math.abs(this.lastDelta[1]) ? 'x' : 'y';
// 
// 		ev.preventDefault();
// 	}
// 	
// 	touchMoveHandler(ev) {
// 		// eslint-disable-next-line
// 		let delta, mid, factor, xMin, xMax, yMin, yMax;
// 		let s = this.state;
// 		let midi = this.touchMidPoint;
// 		
// 		delta = this.calcTouchFingers(ev.touches)[0];
// 		// is it a vertical or horizontal gesture?
// 		if (this.spread == 'x') {
// 			// horizontal - stretch the x axis
// 			factor = this.lastDelta[0] / delta[0];
// 			////console.log("horiz, factor=", factor, this.lastDelta, delta);
// 			xMin = (s.xMin - midi[0]) * factor +  midi[0];
// 			xMax = (s.xMax - midi[0]) * factor +  midi[0];
// 			this.setState({xMin , xMax});
// 			////console.log("xmin/max:", xMin, xMax);
// 			this.xScale.domain([xMin, xMax]);
// 		}
// 		else {
// 			// vertical - stretch the y axis
// 			factor =this.lastDelta[1] /  delta[1];
// 			////console.log("vertical, factor=", factor, this.lastDelta, delta);
// 			this.yMin = (this.yMin - midi[1]) * factor +  midi[1];
// 			this.yMax = (this.yMax - midi[1]) * factor +  midi[1];
// 			// must trigger rerendering even though state didn't change
// 			this.setState({xMax: this.state.xMax + 1e-10});
// 			////console.log("ymin/max:", this.yMin, this.yMax);
// 			this.yScale.domain([this.yMin, this.yMax]);
// 		}
// 		this.lastDelta = delta;
// 		
// ////if (factor < .8 || factor > 1.2) debugger;
// 		////console.log("tmh dom and range", this.xScale.domain(), this.xScale.range());
// 
// 		ev.preventDefault();
// 	}
// 	
// 	touchEndHandler(ev) {
// 		this.spread = false;
// 		ev.preventDefault();
// 	}
// 	
// 	touchCancelHandler(ev) {
// 		this.spread = false;
// 		ev.preventDefault();
// 	}
	
	gestureStartHandler(ev) {
		console.log("gestureStartHandler");
	}
	gestureChangeHandler(ev) {
		console.log("gestureChangeHandler");
	}
	gestureEndHandler(ev) {
		console.log("gestureEndHandler");
	}
}

export default Svg2D;

