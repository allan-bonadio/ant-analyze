import React, { Component } from 'react';

import {extent} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {axisBottom, axisLeft} from 'd3-axis';
import {select} from 'd3-selection';

// x units per k increment
let xPerK;

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class SvgChart extends Component {
	constructor(props) {
		super(props);
		this.index = props.index;
		
	}
	
	render() {
		// nPoints can change upon every redraw
		xPerK = (this.props.scene.xMax - this.props.scene.xMin) / (this.props.scene.nPoints - 1);

		// create th data based on the function
		let dataAr = [];
		for (let k = 0; k < this.props.scene.nPoints; k++) {
			let x = k * xPerK + this.props.scene.xMin;  // range 0...nPoints maps to xmin...xmax
			dataAr[k] = {x: x, y: this.props.scene.func(x)};
		}
		
		const xScale = scaleLinear()
			.domain(extent(dataAr, d => d.x))
			.range([0, this.props.width]);

		const yScale = scaleLinear()
			.domain(extent(dataAr, d => d.y))
			.range([this.props.height, 0]);

		const xAxis = axisBottom()
			.scale(xScale)
			.ticks(7);
		const yAxis = axisLeft()
			.scale(yScale)
			.ticks(5);

		const lineSeries = line()
			.x(d => xScale(d.x))
			.y(d => yScale(d.y));

		// Create a line path of for our data.
		const linePath = lineSeries(dataAr);

		return (
			<svg className='svg-chart' width={this.props.width} height={this.props.height} >
			<g className="xAxis" ref={node => select(node).call(xAxis)}
					style={{transform: `translateY(${yScale(0)}px)`}} />
			<g className="yAxis" ref={node => select(node).call(yAxis)}
					style={{transform: `translateX(${xScale(0)}px)`}} />
			<g className="line-path">
				<path d={linePath} />
			</g>
			</svg>
		);
	}


}

export default SvgChart;

