import 'raf/polyfill';
import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
// import {line} from 'd3-shape';
// import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
// import {select} from 'd3-selection';

//import $ from 'jquery';

import './Webgl3D.css';
import config from './config';
import blanketPlot from './blanketPlot';

import {generateBlanket, ensureCalcPoints} from './genComplex';
//import {mat4} from './gl-matrix';

// in the olden days, we gave the user buttons to make the mesh more dense or loose
// use low numbers (2...6) for debugging.  Try for 25x25 for production;
// over 2000x2000 risks running out of memory; 8000x8000 does run out
const nXCells = 6;
const nYCells = nXCells;


// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Webgl3D extends Component {
	constructor(props) {
		super(props);
		Webgl3D.me = this;
		
////		// for testing, pass in innerWidth and innerHeight props
////		let innerWidth = props.innerWidth || window.innerWidth;
////		let innerHeight = props.innerHeight || window.innerHeight;
		
		// the inner size of the webgl el - changes on window resize or iPhone rotate events
		
		
		let scene = this.scene = config.scenes[props.selectedIndex];
		this.state = {
////			...this.decideWebglDimensions(window),
////			webglWidth: innerWidth - 4,
////			webglHeight: innerHeight - 200,
			
			selectedIndex: props.selectedIndex || -1,
			
			// user can change domain (someday) so this defaults to the scene
			xMin: scene.xMin,
			xMax: scene.xMax,
			yMin: scene.yMin,
			yMax: scene.yMax,

			nXCells: nXCells,
			nYCells: nYCells,
		};

		// tedious
// 		[
// 			'mouseDownEvt', 'mouseMoveEvt', 'mouseUpEvt', 
// 			'mouseWheelEvt', 'resizeEvt',
// 			'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 
// 			'touchCancelEvt', 'touchForceChange',
		//].forEach(funcName => this[funcName] = this[funcName].bind(this));
	}
	
	componentDidMount() {
		// now that the canvas is created, we can grab it for 3d
		this.restartWebgl();
	}
	
	// do this when the blanket data changes, or the canvas dimensions
	restartWebgl() {
		// generate the actual data.  done in calcPoints()
		//this.blanket = generateBlanket(nXCells, nYCells);
		
		// set up the webgl canvas over again
		this.plot = new blanketPlot(
			document.getElementById('blanket-plot'),
			this.state.nXCells, this.state.nYCells);

		// stick data into plot
		this.plot.attachData(this.blanket);

		// draw first and every after
		this.plot.startInteraction();	
	}

// 		these are needed for graph sliding & other touch events - touches outside the SVG
// 		$(document.body)
// 				.mousemove(this.mouseMoveEvt)
// 				.mouseup(this.mouseUpEvt)
// 				.mouseleave(this.mouseUpEvt)
// 				
// 		$('webgl')
// 				.on('touchstart', this.touchStartEvt)
// 				.on('touchmove', this.touchMoveEvt)
// 				.on('touchend', this.touchEndEvt)
// 				.on('touchcancel', this.touchCancelEvt);
// 
// 		$('div.step-widget')
// 				.on('touchstart', ev => ev.stopPropagation())
// 				.on('touchmove', ev => ev.stopPropagation())
// 				.on('touchend', ev => ev.stopPropagation())
// 				.on('touchcancel', ev => ev.stopPropagation());
// 
// 		$(window).on('resize', this.resizeEvt);
// 		
		// do this to re-render after the blurb box is sized properly
////		this.setState(this.decideWebglDimensions(window));
// 	}
	
	// called before the start of a render, this checks for a new index/scene, and changes stuff
	// that's needed for this render
	static getDerivedStateFromProps(props, state) {
		let index = props.selectedIndex;
		// only if user changed scene
		if (index == state.selectedIndex)
			return null;
		
		let scene = this.scene;
		Webgl3D.me.funcs = scene.funcs;

		// there's been a change in scene.  Reset the bounds & start over
		state = {...state, 
			xMin: scene.xMin, xMax: scene.xMax, 
			yMin: scene.yMin, yMax: scene.yMax, 
			selectedIndex: index,};
		return state;
	}
	
	
	// create the pixel data based on the function.
	calcPoints() {
		this.blanket = generateBlanket(
			this.scene.funcs[0].func, 
			this.state.nXCells, 
			this.state.nYCells
		);
	}
	
	// derive the X and Y scaler given the dimensions of the graph.
	// derive Z scaler from points calculated in calcPoints()
	// called initially and for mouse drags (translations)
	deriveScalers() {
		if (! this.blanket)
			throw "No Blanket Array in deriveScalers()";

		let s = this.state;
		this.xScale = scaleLinear().range([0, s.nXCells]);
		this.xScale.domain(s.xMin, s.xMax);
		this.yScale = scaleLinear().range([0, s.nYCells]);
		this.yScale.domain(s.yMin, s.yMax);

		// find the unified extent of all of the z values on all rows
		// At this point there should be no z values that are objects
		let b = this.blanket;
		let mini = Infinity, maxi = -Infinity, mi, mx;
		for (let f = 0; f < b.length; f++) {
			[mi, mx] = extent(b[f], d => d.z);
			console.log(`mi=${mi} mx=${mx} from d.z=`, b[f].map(d => d.z));
			if (isNaN(mi) || isNaN(mx)) debugger;

			mini = Math.min(mi, mini);
			maxi = Math.max(mx, maxi);
		}
		
		// that's min and max in data coords.  convert to cell coords.
		this.nZCells = s.nXCells / (s.xMax - s.xMin);
		
		// this isn't that important; there are no 'cells' vertically, 
		// but z values converted to cell coords for webgl
		this.zScale = scaleLinear().range([0, this.nZCells]);
		this.zScale.domain([mini, maxi]);

		// the z range is calculated from values in the buffer, 
		// therefore not part of the state
		this.zMin = mini;
		this.zMax = maxi;
		
		let dom = this.zScale.domain();
		if (isNaN(dom[0]) || isNaN(dom[1])) debugger;
	}
	
// 	render the axes, return an array [xAxis, yAxis].  Need xScale and yScale.
// 	renderAxes() {
// 		axis generation - choose which side so tic labels don't go off edge
// 		let xAxis, yAxis;
// 		let s = this.state;
// 		if  (this.yMin + this.yMax > 0)
// 			xAxis = axisTop(this.xScale).ticks(7).tickPadding(9);
// 		else
// 			xAxis = axisBottom(this.xScale).ticks(7);
// 
// 		if (s.xMin + s.xMax > 0)
// 			yAxis = axisRight(this.yScale).ticks(5).tickPadding(15);
// 		else
// 			yAxis = axisLeft(this.yScale).ticks(5);
// 		
// 		the axes need to still be on the chart.  We'd like zero-zero but figure out the best.
// 		let xAxisY = Math.max(this.yMin, Math.min(this.yMax, 0));
// 		let yAxisX = Math.max(s.xMin, Math.min(s.xMax, 0));
// 		
// 		wait! if some of the tick labels would overlap an axis, get rid of them
// 		xAxis.tickFormat(x => Math.abs(x - yAxisX) < 0.1 ? ' ' : x);
// 		yAxis.tickFormat(y => Math.abs(y - xAxisY) < 0.1 ? ' ' : y);
// 		
// 		return [
// 			<g className='xAxis' key='xAxis' ref={node => select(node).call(xAxis)}
// 					style={{transform: 'translateY('+ this.yScale(xAxisY) +'px)'}} /> ,
// 			<g className='yAxis' key='yAxis' ref={node => select(node).call(yAxis)}
// 					style={{transform: 'translateX('+ this.xScale(yAxisX) +'px)'}} />
// 		];
// 	}
	
	// draw the canvas that'll show it.  the state must be set up (see constructor).  
	// These might have changed:
	// x/y max/min  webglWidth/Height  
	render() {
		// don't immediately use the react state; we have to update it on the fly
		let state = this.state;
		
		ensureCalcPoints(this);
		
		
		this.deriveScalers();

// 		// Create a line path for each series in our data.
// 		const lineSeries = line()
// 			.x(d => this.xScale(d.x))
// 			.y(d => this.yScale(d.y));
// 		let linePaths = this.pixelsAr.map((ar, ix) => 
// 				<path className='series' d={lineSeries(ar)} key={ix} stroke={this.funcs[ix].color} />);
// 
// 		let viewBox = `0 0 ${state.webglWidth} ${state.webglHeight}`;
		
		// react doesnt recognize touch events - needed for gestures - so use jQuery in DidMount
		return (
			<div>
				<div id='attitude-readout'>
					0 0
				</div>
				<canvas id='blanket-plot' width='700' height='500' ></canvas>
			</div>
		);
	}
	
	componentDidUpdate() {
	


	}

	/* ******************************************************* resize window & webgl */
	// given the window obj, figure out margins and webglWidth/Height, return object to merge into state
// 	decideWebglDimensions(win) {
// 		// size of the screen (or phony size passed in by testing)
// 		let webglWidth = +(this.props.innerWidth || window.innerWidth);
// 		let webglHeight = +(this.props.innerHeight || window.innerHeight);
// 		
// 		// deduct the height of the blurb box, or if not created yet, just approximate
// 		let blurbHeight = 200, blurbWidth = 400, blurbBox$ = $('.blurb-box')
// 		if (webglWidth > webglHeight) {
// 			if (blurbBox$.length)
// 				blurbWidth = blurbBox$[0].offsetWidth;
// 			webglWidth -= blurbWidth + 4;
// 		}
// 		else {
// 			if (blurbBox$.length)
// 				blurbHeight = blurbBox$[0].offsetHeight;
// 			webglHeight -= blurbHeight + 4;
// 		}
// 
// 		// where data drawn; slightly inside the full webgl
// 		this.marginLeft = this.marginTop = axisMargin;
// 		this.marginRight = webglWidth - axisMargin;
// 		this.marginBottom = webglHeight - axisMargin;
// 		this.needsYScaler = true;
// 		
// 		return {webglWidth, webglHeight};
// 	}
// 	
// 	resizeEvt(ev) {
// 		// size of the SVG changes in render() but tell it what
// 		this.setState(this.decideWebglDimensions(ev.target));
// 
// 		console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight, 
// 						this.marginBottom, this.yScale.range());
// 	}
// 	
// 	/* ******************************************************* drag move around */
// 	// call this every time you want to slide the graph over, as a result of some kind of mouse move
// 	// size and direction of move passed in by this.offsetX/Y
// 	shoveByOffset() {
// 		const old = this.state;
// 		const newXRange = {xMin: old.xMin + this.offsetX, xMax: old.xMax + this.offsetX};
// 		this.setState(newXRange);
// 		this.yMin = this.yMin + this.offsetY;
// 		this.yMax = this.yMax + this.offsetY;
// 		
// 		this.xScale.domain([newXRange.xMin, newXRange.xMax]);
// 		this.yScale.domain([this.yMin, this.yMax]);
// 	}
// 
// 	// handler for mouse down on graph surface
// 	mouseDownEvt(ev) {
// 		////console.log("mouseDownEvt", ev.pageX, ev.pageY);////
// 		
// 		this.dragging = true;
// 		
// 		// yeah, i'm missing an offset for the webgl versus the page; it'll be ok
// 		this.downX = this.xScale.invert(ev.pageX);
// 		this.downY = this.yScale.invert(ev.pageY);
// 		this.offsetX = this.offsetY = 0;
// 		ev.preventDefault();
// 		
// 		// save these if a gesture is happening; must undo whatever single finger stuff it did
// 		let s = this.state;
// 		this.downMinMax = {xMin: s.xMin, xMax: s.xMax, yMin: this.yMin, yMax: this.yMax};
// 	}
// 	
// 	mouseMoveEvt(ev) {
// 		if (! this.dragging)
// 			return;
// 		////console.log("mouseMoveEvt", ev.pageX, ev.pageY);////
// 		
// 		//debugger;////
// 		// where is the mouse now, in data coordinates
// 		const hereX = this.xScale.invert(ev.pageX);
// 		const hereY = this.yScale.invert(ev.pageY);
// 		
// 		// save these; we'll use them for momentum
// 		this.offsetX = this.downX - hereX;
// 		this.offsetY = this.downY - hereY;
// 		
// 		// so shove over the scales so 'here' becomes the mouse down position again
// 		this.shoveByOffset();
// 		
// 		ev.preventDefault();
// 		
// ////		let s = this.state;////
// ////		console.log("mme dom and range", this.xScale.domain(), this.xScale.range());
// 	}
// 
// 	mouseUpEvt(ev) {
// 		if (! this.dragging)
// 			return;
// 		this.dragging = false;
// 		////console.log("mouseUpEvt", ev.pageX, ev.pageY);////
// 		
// 		// momentum?
// 		if (Math.abs(this.offsetX) + Math.abs(this.offsetY) > 0.1) {
// 			this.heartbeat = setInterval(() => {
// 				this.shoveByOffset();
// 
// 				// decaying exponentially
// 				this.offsetX *= .95;
// 				this.offsetY *= .95;
// 				
// 				// but stop when it gets too slow, or it gets annoying
// 				if (Math.abs(this.offsetX) + Math.abs(this.offsetY) < 0.01)
// 					clearInterval(this.heartbeat);
// 			}, 50);
// 		}
// 
// 		ev.preventDefault();
// 	}
// 	
// 	// sometimes momentum goes crazy like switching between scenes
// 	static haltMomentum() {
// 		this.me.offsetX = this.me.offsetY = 0;
// 	}
// 
// 	mouseWheelEvt(ev) {
// 		////console.log("mouseWheelEvt x y z", ev);
// 		////console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
// 		//this.mouseUpEvt(ev);
// 		ev.preventDefault();
// 	}
// 
// 	/* ******************************************************* touch & gesture events */
// 	// touch events are like mouse events, eg touchStart ~= mouseDown.  
// 	// But the start/end are delivered for events for each finger, and you can have several of them.  
// 	// Each ev object also has a list of touches, one for each finger that's currently down.
// 	// Also, you don't have to intercept Move and End events for the window or body;
// 	// they guarantee the touch events are delivered to the touchStart element.
// 
// 	// convert the 0th touch in this event to a pseudo-event good enough for the mouse funcs
// 	// only call this in a one-touch situation
// 	touchToEvent(ev) {
// 		let t = ev.touches[0];
// 		t.preventDefault = ev.preventDefault;  // make it look like an event
// 		return t;
// 	}
// 	
// 	touchStartEvt(ev) {
// 		////console.log("touch StartEvt", ev.pageX, ev.pageY, ev.touches);
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
// 		////console.log("touchMoveEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1)
// 			this.mouseMoveEvt(this.touchToEvent(ev));
// 		else
// 			this.touchMoveHandler(ev)
// 	}
// 	
// 	touchEndEvt(ev) {
// 		////console.log("touchEndEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1)
// 			this.mouseUpEvt(this.touchToEvent(ev));
// 		else
// 			this.touchEndHandler(ev)
// 	}
// 	
// 	touchCancelEvt(ev) {
// 		////console.log("touchCancelEvt", ev.pageX, ev.pageY, ev.touches);
// 		if (ev.touches.length == 1) 
// 			this.mouseUpEvt(this.touchToEvent(ev));
// 		else
// 			this.touchCancelHandler(ev)
// 	}
// 	
// 	touchForceChange(ev) {
// 		////console.log("touchForceChange", ev.pageX, ev.pageY, ev.touches);
// 	}
// 	
// 	/* ******************************************************* 2+ finger gestures */
// 
// 	// given array of touches, give me delta X and delta Y, over all fingers, top to bottom and L to R
// 	// retutn array of two vectors: delta and midpoint
// 	calcTouchFingers(touches) {
// 		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
// 		
// 		// this should only happen on touch end events.  but i think they happen other times too.
// 		if (touches.length <= 0)
// 		 	return null;
// 		
// 		for (let t = 0; t < touches.length; t++) {
// 			// these are all in pixel units
// 			let touch = touches[t];
// 			minX = Math.min(minX, touch.clientX);
// 			minY= Math.min(minY, touch.clientY);
// 			maxX = Math.max(maxX, touch.clientX);
// 			maxY= Math.max(maxY, touch.clientY);
// 		};
// 		
// 		return [[maxX - minX, maxY - minY], 
// 				[this.xScale.invert((maxX + minX)/2), this.yScale.invert((maxY + minY)/2)]];
// 	}
// 	
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
}

export default Webgl3D;






