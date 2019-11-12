//
// gen complex -- generate complex arithmetic blanket plots
//

// um... and some other misc stuff

// 		let plot = new blanketPlot(
// 			document.getElementById('blanket-plot'),
// 			nXCells, nYCells);
// 
// 		plot.attachData(blanket);
// 
// 		plot.startInteraction();	
// 

// pass it either a svg2d or webgl3d object, and it'll maybe call nD.calcPoints()
// if it needs to, and remembers stuff for next time
export function ensureCalcPoints(graphComp) {
	let s = graphComp.state;
	
	// note how the y values are undefined for 2d but it works anyway
	if (s.renderedIndex === graphComp.lastTimeRenderedIndex && 
				s.xMin == graphComp.lastTimeXMin && s.xMax == graphComp.lastTimeXMax &&
				s.yMin == graphComp.lastTimeYMin && s.yMax == graphComp.lastTimeYMax)
		return;  // it'll be the same
	
	graphComp.calcPoints();
	
	// save these so we can tell if calc needs to be redone
	graphComp.lastTimeRenderedIndex = s.renderedIndex;
	graphComp.lastTimeXMin = s.xMin;
	graphComp.lastTimeXMax = s.xMax;
	graphComp.lastTimeYMin = s.yMin;
	graphComp.lastTimeYMax = s.yMax;
}


// generate the data, indexed by cell coordinates
export function generateBlanket(nXCells, nYCells) {
	let blanket = new Array(nYCells + 1);
	let blue = 0.5;

	for (let y = 0; y <= nYCells; y++) {
		let row = blanket[y] = new Array(nXCells + 1);
		let green = y / nYCells;
		for (let x = 0; x <= nXCells; x++) {
			// each vertex has a value.  
			// some sort of obj with whatever we might need for the rendering.
			row[x] = {
				x, y, 
				z: Math.random(),
				red: x / nXCells, green, blue, alpha: 1,
				//red: Math.random(), green: Math.random(), blue: Math.random(),
			};
		}
	}
	return blanket;
}


