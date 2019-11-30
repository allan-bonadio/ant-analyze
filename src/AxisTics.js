
//
// Axis Tics - small tic marks in a blanket plot, and an overlay component in HTML.
//
/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React from 'react';

import {mat4, vec4} from 'gl-matrix';

import Webgl3D from './Webgl3D';
import blanketPlot from './blanketPlot';

// these two work together, sharing the painter's axisLabels info that's precalcualted once
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
		
		// original state: zero labels for all three dimensions
		this.state = {axisLabels:[[], [], []]};
	}
	
	render() {
		if (! axisTicsPainter.me)
			return '';  // too early
		
		let plot = axisTicsPainter.me.plot
		let cm = plot.compositeMatrix
		let canvas = plot.canvas;
		let clipCoords = vec4.create();
		let graph = Webgl3D.me;
		
		// https://webglfundamentals.org/webgl/lessons/webgl-text-html.html
		
		let textLabels = this.state.axisLabels.map((axis, dim) => {
			return axis.map(tic => {
				// convert sci coords to cell coords
				let cellBase = graph.scaleXYZ(tic.xyz);
				let cellTip = graph.scaleXYZ(tic.tip);

				// convert to clip coords, -1...1 on all dimensions
				vec4.transformMat4(cellBase, cellBase, cm);
				vec4.transformMat4(cellTip, cellTip, cm);
				
				// now we can tell if we need left or right justification
				//let justification = (cellBase[0] < cellTip[0]) ? 'left' : 'right';
				
				// convert to canvas coords.  -6 for half the height of the 12px text
// 				let canvasX = (cellTip[0] / cellTip[3] + 1) * canvas.clientWidth / 2,
// 					canvasY = (1 - cellTip[1] / cellTip[3]) * canvas.clientHeight / 2 - 6;
// 				let canvasX = (clipCoords[0] / clipCoords[3] + 1) * .5 * 
// 							canvas.clientWidth,
// 					canvasY = (clipCoords[1] / clipCoords[3] - 1) * .5 * 
// 							canvas.clientHeight;
// 				canvasX = canvas.clientWidth - canvasX;
// 				canvasY = canvas.clientHeight - canvasY;

				// form the style obj for this one.  Note the label goes on left or right depending on whether tic line goes left or right.  And if we use right alignment instead of left, must measure from other end of canvas!
				let canvasX,
					canvasY = (1 - cellTip[1] / cellTip[3]) * canvas.clientHeight / 2 - 6;
				let style = {top: (canvasY - 6).toFixed(1) + 'px'};
				if (cellBase[0] < cellTip[0]) {
					canvasX = (cellTip[0] / cellTip[3] + 1) * canvas.clientWidth / 2;
					style.left = canvasX +'px';
				}
				else {
					canvasX = (1 - cellTip[0] / cellTip[3]) * canvas.clientWidth / 2;
					style.right = canvasX +'px';
				}

// 				console.log("clipCoords, canvas x and y:", 
// 					cellTip[0].toFixed(2).padStart(6), 
// 					cellTip[1].toFixed(2).padStart(6), 
// 					cellTip[2].toFixed(2).padStart(6), 
// 					' - ', 
// 					canvasX.toFixed(2).padStart(6), 
// 					(graph.state.graphWidth - canvasX).toFixed(2).padStart(6), 
// 					canvasY.toFixed(2).padStart(6),
// 					tic.tip);

				return <tic-lab style={style} key={tic.key} >
					{tic.text}
				</tic-lab>;
			});
		});

		return <aside style={this.props.style}> {textLabels} </aside>;
	}
	
	// call this whenever the labels move around; that is, upon every manual rotation
	static setAxisLabels(axisLabels) {
		AxisTics.me.setState({axisLabels});
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
	
	
	/* ****************************** fill the axisLabels lists */
	// we use a cache of tic info called the axisLabels.  
	// It's an array x y z of lists of tics, each with coords in science space
	// we can't do cell coords yet cuz we haven't done scaling at this point.
	
	// this has to be regenerated upon every rotation; all the axis labels moved around.
	// as such, it can choose to attach labels and tics to different corner axis lines.
	// We choose so, to keep the tics in front (cuz we can't clip html)
	
	// find the corner of our space closest to the user.  In cell coords mostly.
	findClosestCorner(graph, plot) {
		if (! plot)
			return [graph.xMin, graph.yMin, graph.zMin];  // too early
		
		return [
			Math.sin(plot.longitude) < 0 ? graph.xMin : graph.xMax, 
			Math.cos(plot.longitude) < 0 ? graph.yMin : graph.yMax, 
			plot.latitude < 0 ? graph.zMin : graph.zMax
		];
	}

	// generate one tic at xyz for the dimension axis (0 1 or 2) with utf8 text
	// this will be used by the component to generate each <tic-lab> element for HTML
	// and to generate the vertices for WebGL
	// the xyz is in science coordinates
	generateOneTic(xyz, text, dimension) {
		// the React key is a sanitized version of the text.
		let key = text;  //.replace(/\W*(.*)\W*/, '\1');  // trim off the ends
		key = key.replace(/\W/g, '_');  // all punct becomes underbars incl decimal pt
		key = 'xyz'[dimension] + key;  // prefixed with whatever dimension 
		// so x2_00 won't be confused with y2_00
		
		// the end of the tic line, away from the axis.  Also needed for labels.
		let tip = [...xyz];
		tip[(dimension + 1) % 3] += .1

		return {
			xyz: [...xyz],
			tip,
			text,
			dimension,
			key,
		};
	}


	// generate one axis's worth of tics for any one axis: x, y or z
	generateOneAxis(g, dimension, mini, maxi) {
		let dim = 'xyz'[dimension];
		let axisScale = this.graph[dim +'Scale'];
		
		// gimme several science values for axis dimension that are good for tics
		let labelValues = axisScale.ticks(3);
		console.log("||| axisScale.ticks:", labelValues);
		
		// different values get plugged in to this below
		let loc = [...this.closestCorner];
		
		// we plug in the ticValue in the right dimension and that's a tic
		return labelValues.map(ticValue => {
			loc[dimension] = ticValue;
			return this.generateOneTic(loc, ticValue.toFixed(2), dimension);
		})
	}

	// figure out how many of each kind of tic, where they are and what's their label
	generateAllTics() {
		console.log("||| axisScale.ticks x, y and z");
		let g = this.graph;
		let plot = this.plot;

		// each dimension xyz has to choose among 4 different corners where the 
		// axis bar could have tics.  This chooses the best for all 3.
		this.closestCorner = this.findClosestCorner(g, plot);

		this.axisLabels = [];
		for (let dimension = 0; dimension < 3; dimension++) {
			let dim = 'xyz'[dimension];
			this.axisLabels[dimension] = this.generateOneAxis(g, dimension, 
				g[dim +'Min'], g[dim +'Max']);
		}

		// hit the tic text layer so it redraws in new positions
		AxisTics.setAxisLabels(this.axisLabels);
		this.dumpAllTics();
	}
	
	dumpAllTics() {
		for (let dimension = 0; dimension < 3; dimension++) {
			console.log("ticks along axis %d:", dimension, this.axisLabels[dimension]);
		}
	}
	
	static rotateAllTics() {
		axisTicsPainter.me.generateAllTics();
	}

	/* ****************************** the painter */

	// this generates the line segments for the little tic marks for webgl.
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = this.buffer.nVertices;
		
		// each one starts on the axis line but then goes off perpendicular 
		// to the next dimension alphabetically
		let axisLabels = axisTicsPainter.me.axisLabels;
		let g = this.graph;
		let textLabels = axisLabels.map((axis, dimension) => {
			let nextDimension = (dimension + 1) % 3;
			let nextScale = this.graph['xyz'[nextDimension] +'Scale'];
			return axis.forEach(tic => {
				// append two vertices: start from axis tic location, 
				// converting to cell coords
				let pos;
				////= [g.xScale(tic.xyz[0]), g.yScale(tic.xyz[1]), g.zScale(tic.xyz[2])];
				pos = g.scaleXYZ(tic.xyz);
				buffer.addVertex(pos, [1, 1, 1, 1]);  // same color as axis lines

				// and the tip
				pos = g.scaleXYZ(tic.tip);
				//[g.xScale(tic.tip[0]), g.yScale(tic.tip[1]), g.zScale(tic.tip[2])];
				buffer.addVertex(pos, [1, 1, 1, 1]);  // same color as axis lines
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

