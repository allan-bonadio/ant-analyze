import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisBottom, axisLeft} from 'd3-axis';
import {select} from 'd3-selection';

// to make room for axes that may be cut off at the end
const axisMargin = 10;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class Svg2D extends Component {
	constructor(props) {
		super(props);
		this.index = props.index;
		
		// size of the whole svg element
		this.height = this.props.height;
		this.width = this.props.width;
		
		// which graph to show is set only in constructor
		// no it isnt this.scene = this.props.scene;
	}
	
	render() {
		// 
		this.props.scene;
		
		// x units per k increment.  min, max, n can change upon every redraw.
		const xPerK = (this.props.scene.xMax - this.scene.xMin) / (this.scene.nPoints - 1);

		// create th data based on the function
		let dataAr = [];
		for (let k = 0; k < this.scene.nPoints; k++) {
			let x = k * xPerK + this.scene.xMin;  // range 0...nPoints maps to xmin...xmax
			dataAr[k] = {x: x, y: this.scene.func(x)};
		}
		
		const xScale = scaleLinear()
			.domain(extent(dataAr, d => d.x))
			.range([0, this.width]);

		const yScale = scaleLinear()
			.domain(extent(dataAr, d => d.y))
			.range([this.height, 0]);

		// Create a line path of for our data.
		const lineSeries = line()
			.x(d => xScale(d.x))
			.y(d => yScale(d.y));
		const linePath = lineSeries(dataAr);

		// axis generation
		const xAxis = axisBottom(xScale).ticks(7);
		const yAxis = axisLeft(yScale).ticks(5);

		return (
			<svg className='svg-chart' width={this.width} height={this.height} >
				<g className='xAxis' ref={node => select(node).call(xAxis)}
						style={{transform: `translateY(${yScale(0)}px)`}} />
				<g className='yAxis' ref={node => select(node).call(yAxis)}
						style={{transform: `translateX(${xScale(0)}px)`}} />
				<g className='line-path'>
					<path d={linePath} />
				</g>
			</svg>
		);
	}


}

export default Svg2D;

