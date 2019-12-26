
//
// Axis Tics - small tic marks in a blanket plot, and an overlay component in HTML.
//
/* eslint-disable eqeqeq, no-throw-literal  */

import 'raf/polyfill';
import React from 'react';

import {vec4} from 'gl-matrix';

import Webgl3D from '../Webgl3D';
//import blanketPlot from './blanketPlot';

const AXIS_TIC_COLOR = [1, 1, 1, 1];

// these two work together, sharing the painter's axisLabels info that's precalcualted once
// after the z limits are decided

/* ************************************************************** the Component */
// React component for the tic text itself.  Just text, no tic lines.
// webgl doesn't really have text; you have to make your own pixel buffer and 
// draw the text in it and then hand that to webgl.  Forget it.
// Instead, draw the text in HTML with absolutely positioned text nodes.
// downside is that nothing draws in front of the text.
export class AxisTics extends React.Component {
	constructor(props) {
		super(props);
		AxisTics.me = this;
		
		// NOOO!!!  original state: zero labels for all three dimensions
//		this.state = {axisLabels:[[], [], []]};
		// these don't move, therefore not part of the state.
		// its' reset to good stuff when the axis tics are calculated.
		// no it's AxisTics.axisLabels       this.axisLabels = [[], [], []];
		
		// this state changes as user rotates.  
		// Each time, we have to re-render (reposition) all the tic labels.
		this.state = {
			// changes irregularly as user rotates.  This is the cell coords,
			// of the point on the right rectangular prism appearing on the screen,
			// closest to the user's eye.  EG the x axis has different values for x, 
			// but the y and z come from the closestCorner.
			closestCorner: [0,0,0],
			
			// changes continuously as user rotates.  By being replaced.
			// Same matrix the v shader uses to map cell coords to clip coordinates
			compositeMatrix: new Array(16),
		};
	}
	
	// called on each twitch, to trigger rerender
	static userRotated(closestCorner, compositeMatrix) {
		////debugger;////
		this.me.setState({closestCorner, compositeMatrix});
	}
	
	// generate the permanent info for the given tic mark and label
	generateOneTicLabel(tic) {
		let graph = Webgl3D.me;
		let canvas = graph.graphElement;
		let plot = axisTicsPainter.me.plot
		let cm = this.state.compositeMatrix;

		// convert sci coords to cell coords
		let cellBase = graph.scaleXYZ1(tic.xyz);
		let cellTip = graph.scaleXYZ1(tic.tip);
		////console.log('    tip', cellBase[0], cellBase[1], cellBase[2]);////

		// convert to clip coords, -1...1 on all dimensions
		// just like the vertex shader does
		//debugger;
		vec4.transformMat4(cellBase, cellBase, cm);
		vec4.transformMat4(cellTip, cellTip, cm);
		
		// now we can tell if we need left or right justification
		//let justification = (cellBase[0] < cellTip[0]) ? 'left' : 'right';
		
		// form the style obj for this one.  Note the label goes on left or 
		// right depending on whether tic line goes left or right.  
		// And if we use right alignment instead of left, 
		// must measure from other end of canvas!
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

// 				let clipCoords = vec4.create();
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
	}
	
	render() {
		if (! axisTicsPainter.me || ! AxisTics.axisLabels)
			return '';  // too early
		
		let plot = axisTicsPainter.me.plot
		let canvas = Webgl3D.me.graphElement;
		let cm = plot.compositeMatrix;
		if (! cm)
			return '';
		
		// https://webglfundamentals.org/webgl/lessons/webgl-text-html.html
		
		let textLabels = AxisTics.axisLabels.map((axis, dim) => {
			////console.log('Axis', dim);////
			return axis.map(tic => this.generateOneTicLabel(tic, cm, canvas));
		});

		return <aside style={this.props.style}> {textLabels} </aside>;
	}
	
	// when axis labels are all alculated, they get passed here.
	// Note we're resposible for the closestCorner stuff.
//	static setAxisLabels(axisLabels) {
//		// too early?  before first render?  no prob.  nothing else is drawing anyway
//		if (AxisTics.me)
//			AxisTics.me.setState({axisLabels});
//	}

}


/* ************************************************************** the painter */


// Painter for the actual tic marks along the correct axis bars, 
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
	



	// generate one tic at xyz for the dimension axis (0 1 or 2) with utf8 text
	// this will be used by the component to generate each <tic-lab> element for HTML
	// and to generate the vertices for WebGL
	// the xyz is in science coordinates
	generateOneTic(xyz, text, dimension) {
		// the React key is a sanitized version of the text.  If it's text.
		let key = text;  //.replace(/\W*(.*)\W*/, '\1');  // trim off the ends
		if (typeof key == 'string') {
			key = key.replace(/\W/g, '_');  // all punct becomes underbars incl decimal pt
			key = 'xyz'[dimension] + key;  // prefixed with whatever dimension 
			// so x2_00 won't be confused with y2_00
			// (actually these are different lists but i'm paranoid)
		}
		else if (typeof key == 'object') {
			// must be the axis label.  The object is a react node.
			key = 'xyz'[dimension] | 'Label';
		}
		
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
		let labelValues = axisScale.ticks(5);
		//console.log("||| axisScale.ticks:", labelValues);
		
		// different values get plugged in to this below.  Keep this in science 
		// coords so everybody else can use it
		let loc = [...this.minimalCorner];
		
		// we plug in the ticValue in the right dimension and that's a tic
		let firstLoc, secondLoc;
		let ticsThisAxis = labelValues.map(ticValue => {
			loc[dimension] = ticValue;
			
			// grab these for the label for the whole axis
			if (! firstLoc) firstLoc = [...loc];
			else if (! secondLoc) secondLoc = [...loc];
			
			return this.generateOneTic(loc, ticValue.toFixed(1), dimension);
		});
		
		// add one more for labeling each axis, between the first two tics
		let labLoc = [
			(firstLoc[0] + secondLoc[0]) / 2,
			(firstLoc[1] + secondLoc[1]) / 2,
			(firstLoc[2] + secondLoc[2]) / 2,
		];
		let labelTic = this.generateOneTic(labLoc, 
			<i> {'xyz'[dimension]} </i>, 
			dimension);
		labelTic.noLine = true;  // don't draw a tic line
		ticsThisAxis.push(labelTic);
		return ticsThisAxis;
	}

	// figure out how many of each kind of tic, where they are and what's their label
	// build this.axisLabels that lists them all
	generateAllTics() {
		//console.log("||| axisScale.ticks x, y and z");
		let g = this.graph;
		////let plot = this.plot;

		// each dimension xyz has to choose among 4 different edge/corners where the 
		// axis bar could have tics.  But that's handled elsewhere.
		// That code in the shader depends on this being all mins.
		this.minimalCorner = [g.xMin, g.yMin, g.zMin];

		// each tic with label
		this.axisLabels = [];
		for (let dimension = 0; dimension < 3; dimension++) {
			let dim = 'xyz'[dimension];
			this.axisLabels[dimension] = this.generateOneAxis(g, dimension, 
				g[dim +'Min'], g[dim +'Max']);
		}

		AxisTics.axisLabels = this.axisLabels;
		this.dumpAllTics();
	}
	
	dumpAllTics() {
		for (let dimension = 0; dimension < 3; dimension++) {
			console.log("ticks along axis %d:", dimension, this.axisLabels[dimension]);
		}
	}
	
	// the tics are the only things that actually change in 3d from one angle to 
	// another - everything else freezes and keeps its science & cell coordinates
//	static rotateAllTics() {
//		alert("not supposed to be doing rotateAllTics()")
//		if (axisTicsPainter.me)
//			axisTicsPainter.me.generateAllTics();
//	}

	/* ****************************** the painter */

	// this generates the line segments for the little tic marks for webgl.
	// note how it's called in two different ways: first time and afterwards, per-frame
	depositVertices(startVertex) {
		let buffer = this.buffer;
		
		// each one starts on the axis line but then goes off perpendicular 
		// x axis has tics that point in +y direction; y axis in +z direction, 
		// and z axis in +x direction
		let axisLabels = axisTicsPainter.me.axisLabels;
		let g = this.graph;
		axisLabels.forEach((axis, dimension) => {
			// Each is 7 minus bitvalue of that color  x=1, y=2, z=4
			let mask4axis = [0b110, 0b101, 0b011][dimension];
//mask4axis=0;
console.log(`Axis ${dimension} mask ${mask4axis}`);////
			
// 			let nextDimension = (dimension + 1) % 3;
// 			let nextScale = this.graph['xyz'[nextDimension] +'Scale'];
			return axis.forEach(tic => {
				if (tic.noLine)
					return;  // axis label like x y z
				
				// append two vertices: start from axis tic location, 
				// converting to cell coords
				let pos = g.scaleXYZ1(tic.xyz);
				pos[3] = mask4axis;
console.log(`    '${tic.text.padStart(8)}' at ${pos[0].toFixed(3)} ${pos[1].toFixed(3)} ${pos[2].toFixed(3)}`);////
				buffer.addVertex(pos, AXIS_TIC_COLOR);  // same color as axis lines

				// and the tip
				pos = g.scaleXYZ1(tic.tip);
				pos[3] = mask4axis;
console.log(`           tip at ${pos[0].toFixed(3)} ${pos[1].toFixed(3)} ${pos[2].toFixed(3)}`);////
				buffer.addVertex(pos, AXIS_TIC_COLOR);  // same color as axis lines
			});
		});

		// console.log("&&& finished tics, used %d of %d vertices", 
		// 		this.nVertices, this.maxVertices);
		return this.buffer.nVertices - startVertex
	}

	// normal first call in prep for any drawing
	layDownVertices() {
		let buffer = this.buffer = this.plot.buffer;
		this.startVertex = buffer.nVertices;
		this.nVertices = this.depositVertices(this.startVertex);
	}

	// replace the vertices in the buffer cuz the tic lines moved to a different axis bar
	// but then you have to attachBufferToGL() again.  Messy way to do this ////
//	repeatVertices() {
//		if (Math.random() > .999) console.warn("//// remove repeat vertices")
//		return;
//		
//		let presentNVertices = this.buffer.nVertices;
//		let presentPosOffset = this.buffer.posOffset;
//		let presentColOffset = this.buffer.colOffset;
//		
//		this.buffer.nVertices = this.startVertex;
//		this.buffer.posOffset = this.startVertex * 4;
//		this.buffer.colOffset = this.startVertex * 4;
//		let nVert = this.depositVertices(this.startVertex);
//		if (nVert != this.nVertices)
//			throw "nVert not equal nVertices";
//			
//		this.buffer.nVertices = presentNVertices;
//		this.buffer.posOffset = presentPosOffset;
//		this.buffer.colOffset = presentColOffset;
//		
//		//this.plot.attachCanvas(this.plot.graphElement);
//	}

	draw(gl) {
		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
		this.plot.checkOK();
	}

	dispose() {
		this.plot = this.buffer = this.axisLabels = AxisTics.axisLabels = this.graph = null;
		AxisTics.me = axisTicsPainter.me = null;
	}
}

