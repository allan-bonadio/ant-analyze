
//
// Axis Tics - small tic marks in a blanket plot, and an overlay component in HTML.
//
/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React from 'react';

import {mat4} from 'gl-matrix';

import Webgl3D from './Webgl3D';

// these two work together, sharing the painter's preCalc info that's precalcualted once
// after the z limits are decided

/* ************************************************************** the Component */
// React component for the tic text itself.  Just text, no tic lines.
// webgl doesn't really have text; you have to make your own pixel buffer and 
// draw the text in it and then hand that to webgl.  Forget it.
// Instead, drawthe text in HTML with absolutely positioned text nodes.
export class AxisTics extends React.Component {
	constructor(props) {
		super(props);
		AxisTics.me = this;
		
		this.state = {};
	}
	
	render() {
		if (! axisTicsPainter.me)
			return '';  // too early
			
		let preCalc = axisTicsPainter.me.preCalc;
		let textLabels = preCalc.map((axis, dim) => {
			return axis.map(tic => {
				let style = {
					left: (tic.xyz[0]*100+300).toFixed(1) + 'px', 
					top: (tic.xyz[1]*100+300).toFixed(1) + 'px',
				};
				return <tic-lab style={style} key={tic.key} >
					{tic.text}
				</tic-lab>;
			});
		});

		return <aside>
					{textLabels}
				</aside>;
	}

}


/* ************************************************************** the painter */


// class tic {
// 	// this tic should be drawn at x, y within the canvas and the AxisTics element
// 	// text is what it'll say.  key is a unique id for React that describes the tic:
// 	// like x2_00 for '2.00' along the x axis
// 	constructor(x, y, text, key) {
// 		this.x = x;
// 	}
// 	
// }

// Painter for the actual tic marks along some of the axes, 
// meanwhile generating their text labels which display in html
export class axisTicsPainter {

	constructor(plot, graph) {
		this.plot = plot;
		this.graph = graph;
		this.name = 'axisTics';
		axisTicsPainter.me = this;

		// this is supposed to be worst case - we allocate this many
		// but only use the ones up to nVertices  (two vertices per tic)
		this.maxVertices = 50;  // not entirely sure about this
	}
	
	
	/* ****************************** fill the preCalc lists */

	// generate one tic at xyz for the dimension axis ('x', 'y' or 'z') with utf8 text
	// this will be used by the component to generate each <tic-lab> element for HTML
	// and to generate the vertices for WebGL
	generateOneTic(xyz, text, dimension, justification) {
		// the React key is a sanitized version of the text.
		let key = text;  //.replace(/\W*(.*)\W*/, '\1');  // trim off the ends
		key = key.replace(/\W/g, '_');  // all punct becomes underbars incl decimal pt
		key = dimension + key;  // prefixed with whatever dimension 
		// so x2_00 won't be confused with y2_00
		
		return {
			xyz: [...xyz],
			text,
			dimension,
			justification,
			key,
		};
	}

	// generate the tics for any one axis: x, y or z
	generateOneAxis(g, dimension, mini, maxi) {
		let dimLetter = 'xyz'[dimension];
		let axisScale = this.graph[dimLetter +'Scale'];
		let labelValues = axisScale.ticks(3);
		console.log("||| axisScale.ticks:", labelValues);
		
		// this is sortof the template for the points we run through
		let location = [g.xMin, g.yMin, g.zMin];
		
		// we plug in the ticValue in the right dimension and that's a tic
		return labelValues.map(ticValue => {
			location[dimension] = ticValue;
			return this.generateOneTic(location, ticValue.toFixed(2), dimension, 'right');
		})
	}

	// figure out how many of each kind of tic, where they are and what's their label
	generateAllTics() {
		console.log("||| axisScale.ticks x, y and z");
		
		let g = Webgl3D.me;
		this.preCalc = [];
		for (let d = 0; d < 3; d++)
			this.preCalc[d] = this.generateOneAxis(g, d, g.xMin, g.xMax);
	}

	/* ****************************** the painter */

	// this generates the line segments for the little tic marks for webgl.
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;
		
		// each one starts on the axis line but then goes off perpendicular 
		// to the next dimension alphabetically
		let preCalc = axisTicsPainter.me.preCalc;
		let textLabels = preCalc.forEach((axis, dim) => {
			let nextDim = (dim + 1) % 3;
			return axis.forEach(tic => {
				// add two vertices: start from axis tic location, 
				// and extend a little into next dimension
				buffer.addVertex(tic.xyz, [1, 1, 1, .5]);  // same color as axis lines
				let sidewaysPos = {...tic.xyz};
				sidewaysPos[nextDim] += .1;
				buffer.addVertex(sidewaysPos, [1, 1, 1, .5]);  // same color as axis lines
			});
		});

		this.nVertices = this.buffer.nVertices - this.startVertex;
		console.log("&&& finished tics, used %d of %d vertices", this.nVertices, this.maxVertices)
	}

	draw(gl) {
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

}

