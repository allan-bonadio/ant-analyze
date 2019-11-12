import 'raf/polyfill';
import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
import {select} from 'd3-selection';

import $ from 'jquery';

import './Svg2D.css';
import config from './config';
import {ensureCalcPoints} from './genComplex';


// to make room for axes that may be cut off at the edges
export const axisMargin = 4;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;
		
////		// for testing, pass in innerWidth and innerHeight props
////		let innerWidth = props.innerWidth || window.innerWidth;
////		let innerHeight = props.innerHeight || window.innerHeight;
		
		// the inner size of the svg el - changes on window resize or iPhone rotate events
		this.state = {
			...this.decideSvgDimensions(window),
////			svgWidth: innerWidth - 4,
////			svgHeight: innerHeight - 200,
			
			renderedIndex: -1,
			xMin: -1,  // just defaults
			xMax: 1,  // will quickly be overwritten
		};

		this.needsYScaler = true;
		
		// tedious
		[
			'mouseDownEvt', 'mouseMoveEvt', 'mouseUpEvt', 
			'mouseWheelEvt', 'resizeEvt',
			'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 'touchCancelEvt', 'touchForceChange',
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
	}
	
	componentDidMount() {
		// these are needed for graph sliding & other touch events - touches outside the SVG
		$(document.body)
				.mousemove(this.mouseMoveEvt)
				.mouseup(this.mouseUpEvt)
				.mouseleave(this.mouseUpEvt)
				
		$('svg')
				.on('touchstart', this.touchStartEvt)
				.on('touchmove', this.touchMoveEvt)
				.on('touchend', this.touchEndEvt)
				.on('touchcancel', this.touchCancelEvt);

		$('div.step-widget')
				.on('touchstart', ev => ev.stopPropagation())
				.on('touchmove', ev => ev.stopPropagation())
				.on('touchend', ev => ev.stopPropagation())
				.on('touchcancel', ev => ev.stopPropagation());

		$(window).on('resize', this.resizeEvt);
		
		// do this to re-render after the blurb box is sized properly
		this.setState(this.decideSvgDimensions(window));
	}
	
	// called before the start of a render, this checks for a new index/scene, and changes stuff
	// that's needed for this render
	static getDerivedStateFromProps(props, state) {
		let index = props.selectedIndex;
		// only if user changed scene
		if (index == state.renderedIndex)
			return null;
		
		let scene = config.scenes[index];
		Svg2D.me.funcs = scene.funcs;

		// there's been a change in scene.  Reset the bounds & start over
		state = {...state, xMin: scene.xMin, xMax: scene.xMax, renderedIndex: index,};
		return state;
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
				if (isNaN(y))debugger;
				pixelsAr[f][k] = {x, y};
			}
		}
		this.pixelsAr = pixelsAr;
		
		if (s.renderedIndex != this.lastTimeRenderedIndex)
			this.needsYScaler = true;

	}
	
	// derive the X scaler given the points calculated in calcPoints()
	// called initially and for mouse drags (translations)
	deriveXScaler() {
		if (! this.pixelsAr)
			throw "No Pixels Array in deriveXScaler()";

		this.xScale = scaleLinear()
			.range([this.marginLeft, this.marginRight]);

		// use any series; the x values are all the same
		this.xScale.domain(extent(this.pixelsAr[0], d => d.x))
	}
	
	// derive Y scaler given the points calculated in calcPoints()
	// called initially and upon scene changes
	// don't call it on every render or else user won't be able to drag up or down!
	deriveYScaler() {
		if (! this.pixelsAr)
			throw "No Pixels Array in deriveXScaler()";

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
	// x/y max/min  svgWidth/Height  
	render() {
		// don't immediately use the react state; we have to update it on the fly
		let state = this.state;
		ensureCalcPoints(this);
		this.deriveXScaler();
		if (this.needsYScaler) {
			this.deriveYScaler();
			this.needsYScaler = false;
		}
		//console.log("Render: ", state, this.xScale.domain(), this.yScale.domain());////
		
		// Create a line path for each series in our data.
		const lineSeries = line()
			.x(d => this.xScale(d.x))
			.y(d => this.yScale(d.y));
		let linePaths = this.pixelsAr.map((ar, ix) => 
				<path className='series' d={lineSeries(ar)} key={ix} stroke={this.funcs[ix].color} />);

		let viewBox = `0 0 ${state.svgWidth} ${state.svgHeight}`;
		
		// react doesnt recognize touch events - needed for gestures - so use jQuery in DidMount
		return (
			<svg className='svg-chart'  
						viewBox={viewBox}
						width={state.svgWidth} height={state.svgHeight}
						preserveAspectRatio='none'
						onMouseDown={this.mouseDownEvt}
						onWheel={this.mouseWheelEvt} >

				{this.renderAxes()}
				<g className='line-paths'>
						{linePaths}
				</g>
			</svg>
		);
	}

	/* ******************************************************* resize window & svg */
	// given the window obj, figure out margins and svgWidth/Height, return object to merge into state
	decideSvgDimensions(win) {
		// size of the screen (or phony size passed in by testing)
		let svgWidth = +(this.props.innerWidth || window.innerWidth);
		let svgHeight = +(this.props.innerHeight || window.innerHeight);
		
		// deduct the height of the blurb box, or if not created yet, just approximate
		let blurbHeight = 200, blurbWidth = 400, blurbBox$ = $('.blurb-box')
		if (svgWidth > svgHeight) {
			if (blurbBox$.length)
				blurbWidth = blurbBox$[0].offsetWidth;
			svgWidth -= blurbWidth + 4;
		}
		else {
			if (blurbBox$.length)
				blurbHeight = blurbBox$[0].offsetHeight;
			svgHeight -= blurbHeight + 4;
		}

		// where data drawn; slightly inside the full svg
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = svgWidth - axisMargin;
		this.marginBottom = svgHeight - axisMargin;
		this.needsYScaler = true;
		
		return {svgWidth, svgHeight};
	}
	
	resizeEvt(ev) {
		// size of the SVG changes in render() but tell it what
		this.setState(this.decideSvgDimensions(ev.target));

		console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight, 
						this.marginBottom, this.yScale.range());
	}
	
	/* ******************************************************* drag move around */
	// call this every time you want to slide the graph over, as a result of some kind of mouse move
	// size and direction of move passed in by this.offsetX/Y
	shoveByOffset() {
		const old = this.state;
		const newXRange = {xMin: old.xMin + this.offsetX, xMax: old.xMax + this.offsetX};
		this.setState(newXRange);
		this.yMin = this.yMin + this.offsetY;
		this.yMax = this.yMax + this.offsetY;
		
		this.xScale.domain([newXRange.xMin, newXRange.xMax]);
		this.yScale.domain([this.yMin, this.yMax]);
	}

	// handler for mouse down on graph surface
	mouseDownEvt(ev) {
		////console.log("mouseDownEvt", ev.pageX, ev.pageY);////
		
		this.dragging = true;
		
		// yeah, i'm missing an offset for the svg versus the page; it'll be ok
		this.downX = this.xScale.invert(ev.pageX);
		this.downY = this.yScale.invert(ev.pageY);
		this.offsetX = this.offsetY = 0;
		ev.preventDefault();
		
		// save these if a gesture is happening; must undo whatever single finger stuff it did
		let s = this.state;
		this.downMinMax = {xMin: s.xMin, xMax: s.xMax, yMin: this.yMin, yMax: this.yMax};
	}
	
	mouseMoveEvt(ev) {
		if (! this.dragging)
			return;
		////console.log("mouseMoveEvt", ev.pageX, ev.pageY);////
		
		//debugger;////
		// where is the mouse now, in data coordinates
		const hereX = this.xScale.invert(ev.pageX);
		const hereY = this.yScale.invert(ev.pageY);
		
		// save these; we'll use them for momentum
		this.offsetX = this.downX - hereX;
		this.offsetY = this.downY - hereY;
		
		// so shove over the scales so 'here' becomes the mouse down position again
		this.shoveByOffset();
		
		ev.preventDefault();
		
////		let s = this.state;////
////		console.log("mme dom and range", this.xScale.domain(), this.xScale.range());
	}

	mouseUpEvt(ev) {
		if (! this.dragging)
			return;
		this.dragging = false;
		////console.log("mouseUpEvt", ev.pageX, ev.pageY);////
		
		// momentum?
		if (Math.abs(this.offsetX) + Math.abs(this.offsetY) > 0.1) {
			this.heartbeat = setInterval(() => {
				this.shoveByOffset();

				// decaying exponentially
				this.offsetX *= .95;
				this.offsetY *= .95;
				
				// but stop when it gets too slow, or it gets annoying
				if (Math.abs(this.offsetX) + Math.abs(this.offsetY) < 0.01)
					clearInterval(this.heartbeat);
			}, 50);
		}

		ev.preventDefault();
	}
	
	// sometimes momentum goes crazy like switching between scenes
	static haltMomentum() {
		this.me.offsetX = this.me.offsetY = 0;
	}

	mouseWheelEvt(ev) {
		////console.log("mouseWheelEvt x y z", ev);
		////console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
		//this.mouseUpEvt(ev);
		ev.preventDefault();
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
	
	touchStartEvt(ev) {
		////console.log("touch StartEvt", ev.pageX, ev.pageY, ev.touches);

		// when you set touch event handlers, mouse events stop coming.  
		// So fake it unless there's 2 or more touches
		if (ev.touches.length == 1)
			this.mouseDownEvt(this.touchToEvent(ev));
		else
			this.touchStartHandler(ev)
	}
	
	touchMoveEvt(ev) {
		////console.log("touchMoveEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseMoveEvt(this.touchToEvent(ev));
		else
			this.touchMoveHandler(ev)
	}
	
	touchEndEvt(ev) {
		////console.log("touchEndEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseUpEvt(this.touchToEvent(ev));
		else
			this.touchEndHandler(ev)
	}
	
	touchCancelEvt(ev) {
		////console.log("touchCancelEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1) 
			this.mouseUpEvt(this.touchToEvent(ev));
		else
			this.touchCancelHandler(ev)
	}
	
	touchForceChange(ev) {
		////console.log("touchForceChange", ev.pageX, ev.pageY, ev.touches);
	}
	
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
	
	touchStartHandler(ev) {
		// pull the plug on normal drag, which has been started
		this.dragging = false;
		this.setState(this.downMinMax);

		[this.lastDelta, this.touchMidPoint] = this.calcTouchFingers(ev.touches);

		this.spread = Math.abs(this.lastDelta[0]) > Math.abs(this.lastDelta[1]) ? 'x' : 'y';

		ev.preventDefault();
	}
	
	touchMoveHandler(ev) {
		// eslint-disable-next-line
		let delta, mid, factor, xMin, xMax, yMin, yMax;
		let s = this.state;
		let midi = this.touchMidPoint;
		
		delta = this.calcTouchFingers(ev.touches)[0];
		// is it a vertical or horizontal gesture?
		if (this.spread == 'x') {
			// horizontal - stretch the x axis
			factor = this.lastDelta[0] / delta[0];
			////console.log("horiz, factor=", factor, this.lastDelta, delta);
			xMin = (s.xMin - midi[0]) * factor +  midi[0];
			xMax = (s.xMax - midi[0]) * factor +  midi[0];
			this.setState({xMin , xMax});
			////console.log("xmin/max:", xMin, xMax);
			this.xScale.domain([xMin, xMax]);
		}
		else {
			// vertical - stretch the y axis
			factor =this.lastDelta[1] /  delta[1];
			////console.log("vertical, factor=", factor, this.lastDelta, delta);
			this.yMin = (this.yMin - midi[1]) * factor +  midi[1];
			this.yMax = (this.yMax - midi[1]) * factor +  midi[1];
			// must trigger rerendering even though state didn't change
			this.setState({xMax: this.state.xMax + 1e-10});
			////console.log("ymin/max:", this.yMin, this.yMax);
			this.yScale.domain([this.yMin, this.yMax]);
		}
		this.lastDelta = delta;
		
////if (factor < .8 || factor > 1.2) debugger;
		////console.log("tmh dom and range", this.xScale.domain(), this.xScale.range());

		ev.preventDefault();
	}
	
	touchEndHandler(ev) {
		this.spread = false;
		ev.preventDefault();
	}
	
	touchCancelHandler(ev) {
		this.spread = false;
		ev.preventDefault();
	}
}

export default Svg2D;

