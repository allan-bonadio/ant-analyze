import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
import {select} from 'd3-selection';

import $ from 'jquery';

import './Svg2D.css';


// to make room for axes that may be cut off at the edges
const axisMargin = 4;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;
		////this.index = props.index;
		
		// the inner size of the svg el - changes on window resize or iPhone rotate events
		this.state = {
			svgWidth: window.innerWidth - 4,
			svgHeight: window.innerHeight - 200,
		};

		// where data drawn; slightly inside the full svg
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = this.state.svgWidth - axisMargin;
		this.marginBottom = this.state.svgHeight - axisMargin;
		
		// this constructor sets it up blank; you have to call setScene() to fire it up
		
		// too tedious
		[
			'mouseDownEvt', 'mouseMoveEvt', 'mouseUpEvt', 'mouseWheelEvt',
			'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 'touchCancelEvt', 'touchForceChange',
			'gestureStartEvt', 'gestureChangeEvt', 'gestureEndEvt', 
		].forEach(funcName =>{
			////console.log(funcName);
			this[funcName] = this[funcName].bind(this)
			});
		
	}
	
	
	
	componentDidMount() {
		// these are needed for graph sliding & other touch events - touches outside the SVG
		$(document.body)
				.mousemove(this.mouseMoveEvt)
				.mouseup(this.mouseUpEvt)
				.mouseleave(this.mouseUpEvt)
				// these must be on body element to override ?
		$('svg')
				.on('touchstart', this.touchStartEvt)
				.on('touchmove', this.touchMoveEvt)
				.on('touchend', this.touchEndEvt)
				.on('touchcancel', this.touchCancelEvt);

		$('div.step-widget')
				.on('touchstart', ev => ev.stopPropagation)
				.on('touchmove', ev => ev.stopPropagation)
				.on('touchend', ev => ev.stopPropagation)
				.on('touchcancel', ev => ev.stopPropagation);

////		// somehow reacct isn't ready for these as attributes on elements
////		$('svg').on('gesturestart', this.gestureStartEvt)
////				.on('gesturechange', this.gestureChangeEvt);
////				.on('gestureend', this.gestureEndEvt);

		$(window).on('resize', ev => {
			
			// set these globals
			let svgWidth = ev.target.innerWidth - 4;
			let svgHeight = ev.target.innerHeight - $('.blurb-box')[0].offsetHeight;
			this.setState({svgWidth, svgHeight});

			this.marginRight = svgWidth - axisMargin;
			this.marginBottom = svgHeight - axisMargin;
			console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight, 
							this.marginBottom, this.yScale.range());

			// and adjust the svg
			$('svg').attr('width', svgWidth).attr('height', svgHeight)
					.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
			
			this.autoScale(this.state);
		});
	}
	
	// given a scene the user just switched to, return a default pre-autoscale state for it
	static startingStateForScene(scene) {
		const s = scene;
		
		// initial state: the xMin...yMax stuff.  
		// caller must  autorange once: must use default xmin/max for that.
		return {
			xMin: s.xMin,
			xMax: s.xMax,
			funcs: s.funcs,
		};
	}
	
	
	// called before a render, this checks for a new index/scene, and changes stuff
	// that's needed for this render
	static getDerivedStateFromProps(props, state) {
		let index = props.index;
		let scene = props.scene;

		// only if user changed scene
		if (index == state.prevIndex)
			return null;
		
		// there's been a change in scene.  Reset the bounds & start over
		state = Svg2D.startingStateForScene(scene);
		state.prevIndex = index;

		Svg2D.calcPoints(state);  // calculate points given the x domain
		Svg2D.me.autoScale(state);  //  default to ymin/max based on xmin/max
		return state;
	}
	
	
	// create the pixel data based on the function.  s
	static calcPoints(state) {
		let s = state;

		
		let pixelsAr = [];
		for (let f = 0; f < s.funcs.length; f++) {
			let func = s.funcs[f];
			
			// x units per k increment.  min, max, n can change upon every redraw.
			const xPerK = (s.xMax - s.xMin) / (func.nPoints - 1);
			if (isNaN(xPerK)) debugger;

			pixelsAr[f] = [];
			for (let k = 0; k < func.nPoints; k++) {
				let x = k * xPerK + s.xMin;  // range 0...nPoints maps to xmin...xmax
				if (isNaN(x)) debugger;
				let y = func.func(x);
				if (isNaN(y))debugger;
				pixelsAr[f][k] = {x: x, y: y};
			}
		}
		Svg2D.me.pixelsAr = pixelsAr;
	}
	
	// derive scalers given the points calculated in calcPoints()
	// called initially and maybe for Resets
	autoScale(state) {
		this.xScale = scaleLinear()
			.domain(extent(this.pixelsAr[0], d => d.x))
			.range([this.marginLeft, this.marginRight]);

		// find the unified extent of all of the y values
		let mini = Infinity, maxi = -Infinity, mi, mx ;
		for (let f = 0; f < this.pixelsAr.length; f++) {
			[mi, mx] = extent(this.pixelsAr[f], d => d.y);
			mini = Math.min(mi, mini);
			maxi = Math.max(mx, maxi);
		}
		state.yMin = mini;
		state.yMax = maxi;
		
////		let yDom = extent(this.pixelsAr, d => d.y);
////		state.yMin = yDom[0];
////		state.yMax = yDom[1];
	
		this.yScale = scaleLinear()
			.domain([mini, maxi])
			.range([this.marginBottom, this.marginTop]);
		console.log("autoScale: ", this.marginBottom, this.marginTop, this.yScale.range());////
		
		if (isNaN(this.yScale.domain()[0])) debugger;
	}
	
	// draw it.  the state must be set up (see constructor)
	render() {
		// don't immediately use the react state; we have to update it on the fly
		let state = this.state;
		Svg2D.calcPoints(state);
		console.log("Render: ", state, this.yScale.range());////
		
		// Create a line path for each series in our data.
		const lineSeries = line()
			.x(d => this.xScale(d.x))
			.y(d => this.yScale(d.y));
		let linePaths = this.pixelsAr.map((ar, ix) => 
				<path d={lineSeries(ar)} key={ix} stroke={state.funcs[ix].color} />);

		// axis generation - choose which side so tic labels don't go off edge
		let xAxis, yAxis;
		if  (state.yMin + state.yMax > 0)
			xAxis = axisTop(this.xScale).ticks(7).tickPadding(9);
		else
			xAxis = axisBottom(this.xScale).ticks(7);

		if (state.xMin + state.xMax > 0)
			yAxis = axisRight(this.yScale).ticks(5).tickPadding(15);
		else
			yAxis = axisLeft(this.yScale).ticks(5);
		
		// the axes need to still be on the chart.  We'd like zero-zero but figure out the best.
		let xAxisY = Math.max(state.yMin, Math.min(state.yMax, 0));
		let yAxisX = Math.max(state.xMin, Math.min(state.xMax, 0));
		
		// wait! if some of the tick labels would overlap an axis, get rid of them
		xAxis.tickFormat(x => Math.abs(x - yAxisX) < 0.1 ? '' : x);
		yAxis.tickFormat(y => Math.abs(y - xAxisY) < 0.1 ? '' : y);
		
		// note i'm including a harmless grave accent to fix bug in debugger
		return (
			<svg className='svg-chart' viewBox={`0 0 ${this.state.svgWidth} ${this.state.svgHeight}`} xx='`'
						onMouseDown={this.mouseDownEvt}
						onWheel={this.mouseWheelEvt}
			
					// react does recognize these touch events - needed for gestures
					// why don't these work anymore?  Need to be on the Body?
////					onTouchStartEvt={this.touchStartEvt}  
////					onTouchMoveEvt={this.touchMoveEvt}
////					onTouchEndEvt={this.touchEndEvt}
////					onTouchCancel={this.touchCancel}
////					onTouchForceChange={this.touchForceChange}

// ReactDOM doesn't recognize these three handlers.
////					onGestureStartEvt={this.gestureStartEvt}
////					onGestureChange={this.gestureChangeEvt}
////					onGestureEndEvt={this.gestureEndEvt}
						
						width={this.state.svgWidth} height={this.state.svgHeight} >
				<g className='xAxis' ref={node => select(node).call(xAxis)}
						style={{transform: 'translateY('+ this.yScale(xAxisY) +'px)'}} />
				<g className='yAxis' ref={node => select(node).call(yAxis)}
						style={{transform: 'translateX('+ this.xScale(yAxisX) +'px)'}} />
				<g className='line-paths'>
						{linePaths}
				</g>
			</svg>
		);
	}

	/* ******************************************************* drag move around */

	preventStop(ev) {
		if (!ev.preventDefault)
			return;
		ev.preventDefault();
		//ev.stopPropagation();
	}
	
	// call this every time you want to slide the graph over, as a result of some kind of mouse move
	shoveByOffset() {
		const old = this.state;
		const newBounds = {xMin: old.xMin + this.offsetX, xMax: old.xMax + this.offsetX,
							yMin: old.yMin + this.offsetY, yMax: old.yMax + this.offsetY};
		if (isNaN(newBounds.yMax)) debugger;////
		this.setState(newBounds);
		
		this.xScale.domain([newBounds.xMin, newBounds.xMax]);
		this.yScale.domain([newBounds.yMin, newBounds.yMax]);
	}

	// handler for mouse down on graph surface
	mouseDownEvt(ev) {
		console.log("mouseDownEvt", ev.pageX, ev.pageY);////
		
		this.dragging = true;
		
		// yeah, i'm missing an offset for the svg versus the page; it'll be ok
		this.downX = this.xScale.invert(ev.pageX);
		this.downY = this.yScale.invert(ev.pageY);
		this.offsetX = this.offsetY = 0;
		this.preventStop(ev);
	}
	
	mouseMoveEvt(ev) {
		if (! this.dragging)
			return;
		console.log("mouseMoveEvt", ev.pageX, ev.pageY);////
		
		//debugger;////
		// where is the mouse now, in data coordinates
		const hereX = this.xScale.invert(ev.pageX);
		const hereY = this.yScale.invert(ev.pageY);
		
		// save these; we'll use them for momentum
		this.offsetX = this.downX - hereX;
		this.offsetY = this.downY - hereY;
		
		// so shove over the scales so 'here' becomes the mouse down position again
		this.shoveByOffset();
		
		this.preventStop(ev);
	}

	mouseUpEvt(ev) {
		if (! this.dragging)
			return;
		this.dragging = false;
		console.log("mouseUpEvt", ev.pageX, ev.pageY);////
		
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

		this.preventStop(ev);
	}
	
	// sometimes momentum goes crazy like switching between scenes
	static haltMomentum() {
		this.me.offsetX = this.me.offsetY = 0;
	}

	mouseWheelEvt(ev) {
		console.log("mouseWheelEvt x y z", ev);
		console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
		//this.mouseUpEvt(ev);
		this.preventStop(ev);
	}

	/* ******************************************************* touch & gesture events */
	// nowhere near done
	
	touchStartEvt(ev) {
		console.log("touch StartEvt", ev.pageX, ev.pageY, ev.touches);
		// when you set touch event handlers, mouse events stop coming.  So fake it unless there's 2 or more touches
		if (ev.touches.length == 1)
			this.mouseDownEvt(ev.touches[0]);
		else
			this.touchStartHandler(ev)
	}
	
	touchMoveEvt(ev) {
		console.log("touchMoveEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseMoveEvt(ev.touches[0]);
		else
			this.touchMoveHandler(ev)
	}
	
	touchEndEvt(ev) {
		console.log("touchEndEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseUpEvt(ev.touches[0]);
		else
			this.touchEndHandler(ev)
	}
	
	touchCancelEvt(ev) {
		console.log("touchCancelEvt", ev.pageX, ev.pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseUpEvt(ev.touches[0]);
		else
			this.touchCancelHandler(ev)
	}
	
	touchForceChange(ev) {
		console.log("touchForceChange", ev.pageX, ev.pageY, ev.touches);
	}
	
	gestureStartEvt(ev) {
		console.log("gestureStartEvt", ev.originalEvent);
		////this.mouseUpEvt(ev);
	}
	
	gestureChangeEvt(ev) {
		console.log("gestureChangeEvt", ev.originalEvent);
		////this.mouseUpEvt(ev);
	}
	
	gestureEndEvt(ev) {
		console.log("gestureEndEvt", ev.originalEvent);
		////this.mouseUpEvt(ev);
	}
	
	/* ******************************************************* 2+ finger gestures */

	// given array of touches, give me delta X and delta Y, over all fingers, top to bottom and L to R
	// retutn array of two vectors: delta and midpoint
	calcTouchFingers(touches) {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (let t = 0; t < touches.length; t++) {
			let touch = touches[t];
			minX = Math.min(minX, touch.clientX);
			minY= Math.min(minY, touch.clientY);
			maxX = Math.max(maxX, touch.clientX);
			maxY= Math.max(maxY, touch.clientY);
		};
		return [[maxX - minX, maxY - minY], [(maxX + minX)/2, (maxY + minY)/2]];
	}
	
	touchStartHandler(ev) {
		[this.touchStartDelta, this.touchMidPoint] = this.calcTouchFingers(ev.touches);
		this.preventStop(ev);

	}
	touchMoveHandler(ev) {
		let delta, mid;
		[delta, mid] = this.calcTouchFingers(ev.touches);
		// is it a vertical or horizontal gesture?
		if (Math.abs(delta[0]) > Math.abs(delta[1])) {
			// horizontal - stretch the x axis
			console.log("horiz");
		}
		else {
			// vertical - stretch the y axis
			console.log("vertical");
		}
		
		
		this.preventStop(ev);
	}
	touchEndHandler(ev) {
		this.preventStop(ev);
	}
	touchCancelHandler(ev) {
		this.preventStop(ev);
	}
}

export default Svg2D;

