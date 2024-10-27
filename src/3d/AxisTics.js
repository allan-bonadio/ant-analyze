
//
// Axis Tics - small tic marks in a blanket plot, and an overlay component in HTML.
//
/* eslint-disable eqeqeq, no-throw-literal  */

import React from 'react';
import {vec4} from 'gl-matrix';
import Webgl3D from '../Webgl3D.js';
import {config} from '../config.js';
const AXIS_TIC_COLOR = [1, 1, 1, 1];

// how many pix to move a label upward to look right
const HI_LABEL = 6;

// these two classes, AxisTics and axisTicPainter work together, sharing the
// painter's axisLabels info that's precalcualted once after the z limits are
// decided

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
		// too early anyway this.bkdrop = props.bkdrop;


		// this state changes as user rotates.
		// Each time, we have to re-render (reposition) all the tic labels.
		this.state = {
			// changes irregularly as user rotates.  This is the cell coords,
			// of the point on the right rectangular prism appearing on the screen,
			// closest to the user's eye.  EG
			// the x axis tic locations has different values for x,
			// but the y and z come from the closestCorner.
			// the z axis has different values for z, but the closest corner for x and y
			closestCorner: [0,0,0],

			// changes continuously as user rotates.  By being replaced.
			// Same matrix the v shader uses to map cell coords to clip coordinates
			compositeMatrix: new Array(16),
		};
	}

	// called on each twitch, to trigger rerender
	static userRotated(closestCorner, compositeMatrix) {
		this.me.setState({closestCorner, compositeMatrix});
		////console.log(`AxisTics.userRotated(${closestCorner}, ${compositeMatrix})`)
	}

	// calculate the location and stuff for this tic, and return React tree for it.
	// Just the text, and the coords of the text;  the line is in webgl.
	makeTicLab(tic, cMatrix, closestCorner) {
		//let graph = Webgl3D.me;
		const bkdrop = this.bkdrop;
		// convert sci coords to cell coords
		let cellBase = bkdrop.scaleXYZ1(tic.xyz);
		let cellTip = bkdrop.scaleXYZ1(tic.tip);

		// alter per closestCorner, which is also in cell coords
		// and for which the minimum is always zero
		////console.log(`makeTicLab(closestCorner = [${closestCorner.join(' , ')}]) `+
		////		`cellBase/Tip=`, cellBase, cellTip);////
		if (tic.dimension != 0) {
			cellBase[0] += closestCorner[0];
			cellTip[0] += closestCorner[0];
		}
		if (tic.dimension != 1) {
			cellBase[1] += closestCorner[1];
			cellTip[1] += closestCorner[1];
		}
		if (tic.dimension != 2) {
			cellBase[2] += closestCorner[2];
			cellTip[2] += closestCorner[2];
		}

		// convert to clip coords, -1...1 on all dimensions
		// just like the vertex shader does
		//console.log("cellBase, cellTip cMatrix", cellBase, cellTip, cMatrix)
		let clipBase = [], clipTip = [];
		vec4.transformMat4(clipBase, cellBase, cMatrix);
		vec4.transformMat4(clipTip, cellTip, cMatrix);

		// now we can tell if we need left or right justification
		//let justification = (clipBase[0] < clipTip[0]) ? 'left' : 'right';
		// form the style obj for this one.  Note the label goes on left or
		// right depending on whether tic line goes left or right.
		// And if we use right alignment instead of left,
		// must measure from other end of canvas!
		// these are clip coords corresponding to locations on the screen/canvas,
		// so just -1...1 for x and y.  the z slot is i think always 1.

		const canvasDims = this.props.style;

		let canvasX;
		let canvasY = (1 - clipTip[1] / clipTip[3])
			* canvasDims.height / 2 - HI_LABEL;
		let style = {top: (canvasY - HI_LABEL).toFixed(1) + 'px'};
		if (clipBase[0] < clipTip[0]) {
			// the tic line is pointing to the Right of us, convert to canvas coords
			// the x coord is -1...1 so remap that to 0...2 & divide by 2 later
			canvasX = (clipTip[0] / clipTip[3] + 1) * canvasDims.width / 2;
			style.left = canvasX +'px';
		}
		else {
			// the tic line is pointing to the Left of us, convert to canvas coords
			// remap the -1..1 x coord to 2...0, then divide the 2 out later
			canvasX = (1 - clipTip[0] / clipTip[3]) * canvasDims.width / 2;
			style.right = canvasX +'px';
		}

		return <tic-lab style={style} key={tic.key} >
			{tic.text}
		</tic-lab>;
	}

	render() {
		if (! axisTicsPainter.me || ! AxisTics.axisLabels || !this.bkdrop)
			return '';  // too early

		let plot = axisTicsPainter.me.plot
		//let canvas = Webgl3D.me.graphElement;
		let cMatrix = plot.compositeMatrix;
		let closestCorner = this.state.closestCorner;
		if (! cMatrix)
			return '';

		let textLabels = AxisTics.axisLabels.map((axis) => {
			return axis.map(tic => this.makeTicLab(tic, cMatrix, closestCorner));
		});
		return <aside style={this.props.style}> {textLabels} </aside>;
	}

	// when axis labels are all calculated, they get passed here.
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
	constructor(plot) {
		this.plot = plot;
		this.bkdrop = plot.bkdrop
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
	// the xyz & tip are in Science coordinates
	generateOneTic(xyz, text, dimension) {
		xyz = [...xyz];

		// the React key is a sanitized version of the text.  If it's text.
		let key = text;  //.replace(/\W*(.*)\W*/, '\1');  // trim off the ends
		if (typeof key == 'string') {
			// a numerical axis tic mark
			key = key.replace(/\W/g, '_');  // all punct becomes underbars incl decimal pt
			key = 'xyz'[dimension] + key;  // prefixed with whatever dimension
			// so x2_00 won't be confused with y2_00
			// (actually these are different lists but i'm paranoid)
		}
		else if (typeof key == 'object') {
			// must be the axis label.  The object is a react node.
			key = 'xyz'[dimension]  +'_Label';
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

	// generate one axis's worth of tics for any one axis: dimension=0,1,2  dimLetter=x, y or z
	generateOneAxis(dimension) {
		let dimLetter = 'xyz'[dimension];
		const mini = this.bkdrop[dimLetter +'Min'];
		const maxi = this.bkdrop[dimLetter +'Max'];
		let axisScale = this.bkdrop[dimLetter +'Scale'];


		// gimme several science values for axis dimension that are good for tics
		let labelValues = axisScale.ticks(5);
		//console.log("||| axisScale.ticks:", labelValues);

		// what kind of increment?  see distance between the first two
		// so we can decide number of decimal places
		let delta = labelValues[1] - labelValues[0], decimalPlaces = 0;
		delta = Math.floor(Math.log10(delta));
		if (delta < 0)
			decimalPlaces = -delta;
		// future: expand this to multiple-of-three powers and add SI prefixes

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
			return this.generateOneTic(loc, ticValue.toFixed(decimalPlaces), dimension);
		});

		// add one more for labeling each axis, between the first two tics
		let labText = ['re', 'im', 'z'][dimension];
		let labLoc = [
			(firstLoc[0] + secondLoc[0]) / 2,
			(firstLoc[1] + secondLoc[1]) / 2,
			(firstLoc[2] + secondLoc[2]) / 2,
		];
		let labelTic = this.generateOneTic(labLoc,
			<i> {labText} </i>,
			dimension);
		labelTic.noLine = true;  // don't draw a tic line
		ticsThisAxis.push(labelTic);
		this.axisLabels[dimension] = ticsThisAxis;
	}

	// figure out how many of each kind of tic, where they are and what's their label
	// build this.axisLabels that lists them all
	generateAllTics() {
		//console.log("||| axisScale.ticks x, y and z");
//		let g = this.graph;

		// each dimension xyz has to choose among 4 different edge/corners where the
		// axis bar could have tics.  But that's handled elsewhere.
		// That code in the shader depends on this being all mins.
		const bkdrop = this.bkdrop;
		this.minimalCorner = [bkdrop.xMin, bkdrop.yMin, bkdrop.zMin];
		////console.log("minimalCorner-- ", this.minimalCorner);
		// each tic with label
		this.axisLabels = [];
		for (let dimension = 0; dimension < 3; dimension++) {
			let dimLetter = 'xyz'[dimension];
			//this.axisLabels[dimension] =
			this.generateOneAxis(dimension);
		}
		AxisTics.axisLabels = this.axisLabels;
		////this.dumpAllTics();
	}

	dumpAllTics() {
		for (let dimension = 0; dimension < 3; dimension++) {
			console.info("ticks along axis %d:", dimension, this.axisLabels[dimension]);
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
		let axisLabels = this.axisLabels;
		//let g = this.graph;
		const bkdrop = this.bkdrop;
		axisLabels.forEach((axis, dimension) => {
			// Each is 7 minus bitvalue of that color  x=1, y=2, z=4
			let mask4axis = [0b110, 0b101, 0b011][dimension];
			////console.log(`Axis ${dimension} mask ${mask4axis}`, axis);////

			return axis.forEach(tic => {
				if (tic.noLine)
					return;  // axis label like x y z has no tic line

				// append two vertices: start from axis tic location,
				// converting to cell coords
				let pos = bkdrop.scaleXYZ1(tic.xyz);
				pos[3] = mask4axis;
				////console.log(`    "${tic.text.padStart(8)}" at ${pos[0].toFixed(3)} `+
				////	`${pos[1].toFixed(3)} ${pos[2].toFixed(3)}`);////
				buffer.addVertex(pos, AXIS_TIC_COLOR);  // same color as axis lines
				// and the tip
				let tpos = bkdrop.scaleXYZ1(tic.tip);
				tpos[3] = mask4axis;
				////console.log(`           tip at ${tpos[0].toFixed(3)} `+
				////	`${tpos[1].toFixed(3)} ${tpos[2].toFixed(3)}`);////
				buffer.addVertex(tpos, AXIS_TIC_COLOR);  // same color as axis lines
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
	draw(gl) {
		// the axis bars look aliased and gunky so get rid of them
		if (config.aniGifFrames)
			return;
		gl.drawArrays(
			//gl.POINTS, // diagnostic
			gl.LINES,  // the correct one
			this.startVertex, this.nVertices);
		this.plot.checkOK();
//		gl.drawArrays(gl.LINES, this.startVertex, this.nVertices);
//		this.plot.checkOK();
	}

	// break up big and potentially circularly-pointing data structures
	dispose() {
		this.plot = this.buffer = this.axisLabels = AxisTics.axisLabels = this.bkdrop = null;
		AxisTics.me = axisTicsPainter.me = null;
	}
}
