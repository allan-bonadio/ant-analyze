import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisTop, axisBottom, axisLeft, axisRight} from 'd3-axis';
import {select} from 'd3-selection';

import $ from 'jquery';

import './Svg2D.css';

// to make room for axes that may be cut off at the edges
const axisMargin = 10;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		Svg2D.me = this;
		////this.index = props.index;
		
		// size of the whole svg element.  Does not change.
		this.height = this.props.height;
		this.width = this.props.width;
		
		// where data drawn
		this.marginLeft = this.marginTop = axisMargin;
		this.marginRight = this.width - axisMargin;
		this.marginBottom = this.height - axisMargin;
		
		// this constructor sets it up blank; you have to call setScene() to fire it up
		this.state = {};
		
		// these are needed for graph sliding
		$(document.body)
				.mousemove(Svg2D.mouseMove)
				.mouseup(Svg2D.mouseUp)
				.mouseleave(Svg2D.mouseUp);

		
		//this.setScene(props.index, props.scene);
		
////		this.state = Svg2D.startingStateForScene(props.scene);
////		this.calcPoints();  // calculate points given the x domain
////		this.autoScale();  //  default ymin/max based on xmin/max
////		////this.setScene(props.scene, state => );
////		
////		// and we can set the default y domain
////		const yd = this.yScale.domain();
////		this.state.yMin = yd[0];
////		this.state.yMax = yd[1];
	}
	
	// given a (maybe new) scene, return a pre-autoscale state for it
	static startingStateForScene(scene) {
		const s = scene;
		
		// initial state: the xMin...yMax stuff.  
		// caller must  autorange once: must use default xmin/max for that.
		return {
			xMin: s.xMin,
			xMax: s.xMax,
			nPoints: s.nPoints,
			func: s.func,
		};
	}
	
	
	// given the current scene, the new scene and index, and 'this'
	// return what we want the state to be to draw it
	stateForScene(index, scene) {
			//scene = this.props.scene;
		let state = this.state;

		////config.scenes[this.props.index];
		if (index != this.index) {
			// there's been a change in scene.  Reset the bounds & start over
			state = Svg2D.startingStateForScene(scene);

			this.calcPoints(state);  // calculate points given the x domain
			this.autoScale(state);  //  default to ymin/max based on xmin/max
			
			// i know it's verboten to set state in the render method but i gotta
			// this is the first I heard of a new scene... not sure how to handle this
			setTimeout(() => {
				this.setState(state);
			}, 0);

		}
		else
			state = {...state};
		this.index = index;
		
		return state;
}
	
	
	// set a new scene and autorange and sortof reset the whole thing
	setScene(index, scene) {
		//scene = this.props.scene;
		let state = this.state;

		////config.scenes[this.props.index];
		if (index != this.index) {
			// there's been a change in scene.  Reset the bounds & start over
			state = Svg2D.startingStateForScene(scene);

			this.calcPoints(state);  // calculate points given the x domain
			this.autoScale();  //  default to ymin/max based on xmin/max
		}
		else
			state = {...state};
		this.index = index;

////		// if this is called from the constructor, state is undefined.  Must be filled directly.
////		// if called later, it is filled in.  so must do setState()
////		setStateCallback(state);
		

		// now that we've calculated it all, order up a render
		this.setState(state);
	}
	
	// create the pixel data based on the function.  s
	calcPoints(state) {
		let s = state;

		// x units per k increment.  min, max, n can change upon every redraw.
		const xPerK = (s.xMax - s.xMin) / (s.nPoints - 1);
		if (isNaN(xPerK)) debugger;
		
		let pixelsAr = [];
		for (let k = 0; k < s.nPoints; k++) {
			let x = k * xPerK + s.xMin;  // range 0...nPoints maps to xmin...xmax
			if (isNaN(x)) debugger;
			let y = s.func(x);
			if (isNaN(y))debugger;
			pixelsAr[k] = {x: x, y: y};
		}
		this.pixelsAr = pixelsAr;
	}
	
	// derive scalers given the points calculated in calcPoints()
	// called initially and maybe for Resets
	autoScale(state) {
		this.xScale = scaleLinear()
			.domain(extent(this.pixelsAr, d => d.x))
			.range([this.marginLeft, this.marginRight]);

		let yDom = extent(this.pixelsAr, d => d.y);
		state.yMin = yDom[0];
		state.yMax = yDom[1];
	
		this.yScale = scaleLinear()
			.domain(yDom)
			.range([this.marginBottom, this.marginTop]);
		
		if (isNaN(this.yScale.domain()[0])) debugger;
	}
	
	// draw it.  the state must be set up (see constructor)
	render() {
		// don't immediately use the react state; we have to update it on the fly
		let state = this.stateForScene(this.props.index, this.props.scene) 
		this.calcPoints(state);
		
		// Create a line path of for our data.
		const lineSeries = line()
			.x(d => this.xScale(d.x))
			.y(d => this.yScale(d.y));
		const linePath = lineSeries(this.pixelsAr);

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
		
		return (
			<svg className='svg-chart' width={this.width} height={this.height} 
						onMouseDown={Svg2D.mouseDown} >
				<g className='xAxis' ref={node => select(node).call(xAxis)}
						style={{transform: 'translateY('+ this.yScale(xAxisY) +'px)'}} />
				<g className='yAxis' ref={node => select(node).call(yAxis)}
						style={{transform: 'translateX('+ this.xScale(yAxisX) +'px)'}} />
				<g className='line-path'>
					<path d={linePath} />
				</g>
			</svg>
		);
	}

	/* ******************************************************* drag move around */
	static mouseDown(ev) {
		const _this = Svg2D.me;
////		console.log("moiuse down", ev);
		
		_this.dragging = true;
		
		// yeah, i'm missing an offset for the svg versus the page; it'll be ok
		_this.downX = _this.xScale.invert(ev.pageX);
		_this.downY = _this.yScale.invert(ev.pageY);
		_this.offsetX = _this.offsetY = 0;

		ev.preventDefault();
		ev.stopPropagation();
	}
	
	shoveByOffset() {
		const old = this.state;
		const newBounds = {xMin: old.xMin + this.offsetX, xMax: old.xMax + this.offsetX,
							yMin: old.yMin + this.offsetY, yMax: old.yMax + this.offsetY};
		if (isNaN(newBounds.yMax)) debugger;////
		this.setState(newBounds);
		
		this.xScale.domain([newBounds.xMin, newBounds.xMax]);
		this.yScale.domain([newBounds.yMin, newBounds.yMax]);
	}

	static mouseMove(ev) {
		const _this = Svg2D.me;
		if (! _this.dragging)
			return;
////		console.log("moiuse move", ev);
		
//debugger;////
		// where is the mouse now, in data coordinates
		const hereX = _this.xScale.invert(ev.pageX);
		const hereY = _this.yScale.invert(ev.pageY);
		
		// save these; we'll use them for momentum
		_this.offsetX = _this.downX - hereX;
		_this.offsetY = _this.downY - hereY;
		
		// so shove over the scales so 'here' becomes the mouse down position again
		_this.shoveByOffset();
		
		ev.preventDefault();
		ev.stopPropagation();
	}

	static mouseUp(ev) {
		const _this = Svg2D.me;
////		console.log("moiuse up", ev);
		if (! _this.dragging)
			return;
		_this.dragging = false;
		
		// momentum?
		if (Math.abs(_this.offsetX) + Math.abs(_this.offsetY) > 0.1) {
			_this.heartbeat = setInterval(() => {
				_this.shoveByOffset();

				// decaying exponentially
				_this.offsetX *= .95;
				_this.offsetY *= .95;
				
				// but stop when it gets too slow, or it gets annoying
				if (Math.abs(_this.offsetX) + Math.abs(_this.offsetY) < 0.01)
					clearInterval(_this.heartbeat);
			}, 50);
		}

		ev.preventDefault();
		ev.stopPropagation();
	}
}

export default Svg2D;

