/* eslint-disable eqeqeq, no-throw-literal  */

import {scaleLinear} from 'd3-scale';

//const TARGET_CELLS = 100;
const TARGET_CELLS = 6000;
//const TARGET_CELLS = config.production ? 6000 : 100;


// sortof, the implementation of the scene, for 3d.
// mostly for coordinates and conversions
class backdrop {
	constructor(scene) {
		this.sheets = scene.sheets;
		this.xMin = scene.xMin;
		this.xMax = scene.xMax;
		this.yMin = scene.yMin;
		this.yMax = scene.yMax;
		//this.zMin = scene.zMin;
		//this.zMax = scene.zMax;

		// shape the cell block according to the mins/maxes,
		// so the product (len*wid) ends up being approx TARGET_CELLS,
		// but still in approximate proportion of x vs y
		// note the number of vertices in both directions is +1 more than cells
		this.nYCells = Math.sqrt(TARGET_CELLS *
			(scene.yMax - scene.yMin) / (scene.xMax - scene.xMin));
		this.nYCells = Math.round(this.nYCells);
		this.nXCells = Math.round(TARGET_CELLS / this.nYCells);
		this.nZCells = 1;

		this.xPerCell = (scene.xMax - scene.xMin) / this.nXCells;
		this.yPerCell = (scene.yMax - scene.yMin) / this.nYCells;

		this.createXYScales();
	}

	// derive the X and Y scaler given the dimensions of the graph in science and cell coords.
	// they convert from science coords to cell coords, use scale.invert for opposite
	// call before calculating data as it needs these!
	createXYScales() {
		this.xScale = scaleLinear().range([0, this.nXCells])
									.domain([this.xMin, this.xMax]);
		this.yScale = scaleLinear().range([0, this.nYCells])
									.domain([this.yMin, this.yMax]);
	}

	createZScale() {
		this.zScale = scaleLinear().range([0, this.nZCells])
									.domain([this.zMin, this.zMax]);
	}

	// scale this 3-vector science coords, by our xyz scalers, into cell coords
	// return a 4-vector - [3] often ignored
	scaleXYZ1(xyz) {
		return [this.xScale(xyz[0]), this.yScale(xyz[1]), this.zScale(xyz[2]), 1];
	}

}

export default backdrop;
