import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
import {select} from 'd3-selection';

import $ from 'jquery';

import './Svg2D.css';

// the inner size of the svg el
const svgWidth = 800;
const svgHeight = 600;

// to make room for axes that may be cut off at the edges
const axisMargin = 10;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;
		////this.index = props.index;
		
		// where data drawn; slightly inside the full svg
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = svgWidth - axisMargin;
		this.marginBottom = svgHeight - axisMargin;
		
		// this constructor sets it up blank; you have to call setScene() to fire it up
		this.state = {};
		
		// too tedious
		[
			'mouseDown', 'mouseMove', 'mouseUp', 'wheel',
			'touchStart', 'touchMove', 'touchEnd', 'touchCancel', 'touchForceChange',
			'gestureStart', 'gestureChange', 'gestureEnd', 
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
	}
	
	componentDidMount() {
		// these are needed for graph sliding & other touch events
		$(document.body)
				.mousemove(this.mouseMove)
				.mouseup(this.mouseUp)
				.mouseleave(this.mouseUp);
		
		// somehow reacct isn't ready for these as attributes on elements
		$('svg').on('gesturestart', this.gestureStart);
		$('svg').on('gesturechange', this.gestureChange);
		$('svg').on('gestureend', this.gestureEnd);
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
		
		if (isNaN(this.yScale.domain()[0])) debugger;
	}
	
	// draw it.  the state must be set up (see constructor)
	render() {
		// don't immediately use the react state; we have to update it on the fly
		let state = this.state;
		Svg2D.calcPoints(state);
		
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
			<svg className='svg-chart' viewBox={`0 0 ${svgWidth} ${svgHeight}`} xx='`'
						onMouseDown={this.mouseDown}
						onWheel={this.wheel}
			
						onTouchStart={this.touchStart}  
						onTouchMove={this.touchMove}
						onTouchEnd={this.touchEnd}
						onTouchCancel={this.touchCancel}
////						onTouchForceChange={this.touchForceChange}

// ReactDOM doesn't recognize these three handlers.
////					onGestureStart={this.gestureStart}
////					onGestureChange={this.gestureChange}
////					onGestureEnd={this.gestureEnd}
						
						width={svgWidth} height={svgHeight} >
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

	// handler for mouse down on graph surface
	mouseDown(ev) {
		
		this.dragging = true;
		
		// yeah, i'm missing an offset for the svg versus the page; it'll be ok
		this.downX = this.xScale.invert(ev.pageX);
		this.downY = this.yScale.invert(ev.pageY);
		this.offsetX = this.offsetY = 0;

		if (ev.preventDefault) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}
	
	// call this every time you want to slide the graph over, as a result of some kind of 
	shoveByOffset() {
		const old = this.state;
		const newBounds = {xMin: old.xMin + this.offsetX, xMax: old.xMax + this.offsetX,
							yMin: old.yMin + this.offsetY, yMax: old.yMax + this.offsetY};
		if (isNaN(newBounds.yMax)) debugger;////
		this.setState(newBounds);
		
		this.xScale.domain([newBounds.xMin, newBounds.xMax]);
		this.yScale.domain([newBounds.yMin, newBounds.yMax]);
	}

	mouseMove(ev) {
		if (! this.dragging)
			return;
		
		//debugger;////
		// where is the mouse now, in data coordinates
		const hereX = this.xScale.invert(ev.pageX);
		const hereY = this.yScale.invert(ev.pageY);
		
		// save these; we'll use them for momentum
		this.offsetX = this.downX - hereX;
		this.offsetY = this.downY - hereY;
		
		// so shove over the scales so 'here' becomes the mouse down position again
		this.shoveByOffset();
		
		if (ev.preventDefault) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}

	mouseUp(ev) {
		if (! this.dragging)
			return;
		this.dragging = false;
		
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

		if (ev && ev.preventDefault) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}

	wheel(ev) {
		ev.preventDefault();
		console.log("wheel x y z", ev);
		console.log( ev.deltaX, ev.deltaY, ev.deltaZ);
		//this.mouseUp(ev);
	}

	/* ******************************************************* touch & gesture events */
	// nowhere near done
	
	/* add all of this to the svg element
onTouchStart={this.touchStart}  
.on('touchMove', this.touchMove)
.on('touchEnd', this.touchEnd)
.on('touchCancel', this.touchCancel);
*/
	touchStart(ev) {
		console.log("touch Start", ev.targetTouches, ev.touches);
		this.mouseDown(ev.touches[0]);
	}
	
	touchMove(ev) {
		console.log("touchMove", ev.targetTouches, ev.touches);
		this.mouseMove(ev.touches[0]);
	}
	
	touchEnd(ev) {
		console.log("touchEnd", ev.targetTouches, ev.touches);
		this.mouseUp(ev.touches[0]);
	}
	
	touchCancel(ev) {
		console.log("touchCancel", ev.targetTouches, ev.touches);
		this.mouseUp(ev.touches[0]);
	}
	
	touchForceChange(ev) {
		console.log("touchForceChange", ev.targetTouches, ev.touches);
		this.mouseUp(ev.touches[0]);
	}
	
	gestureStart(ev) {
		console.log("touchForceChange", ev.targetTouches, ev.touches);
		////this.mouseUp(ev);
	}
	
	gestureChange(ev) {
		console.log("gestureChange", ev.targetTouches, ev.touches);
		////this.mouseUp(ev);
	}
	
	gestureEnd(ev) {
		console.log("gestureEnd", ev.targetTouches, ev.touches);
		////this.mouseUp(ev);
	}
	
}

export default Svg2D;

