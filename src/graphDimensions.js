//
// graphDimensions -- decide htem and handle window resize
//
/* eslint-disable eqeqeq, no-throw-literal  */

import graphicEvents from './graphicEvents.js';

// given the window obj (that prob just resized), figure out margins and graphWidth/Height,
// return object to merge into state.  This is called by the App component.
// it's static cuz it gets called before graphEvents is created.
export function graphDimensions(win) {
	let flexDirection = 'row', hamburgerButtonShowing = false;
	// size of the screen (or phony size passed in by testing -
	// just prepare a phony event and call resizeEvt())
	let graphWidth = +win.innerWidth;
	let graphHeight = +win.innerHeight;

	const fontSize = 12;

	// we'll deduct the size of the blurb box, depending
	let blurbWidth = 23 * fontSize;
	let blurbHeight = 14 * fontSize;

	// *** KEEP THIS IN SYNC WITH SIMILAR EXPRESSIONS IN App.css and BlurbBox.css ***
	if (graphWidth < 700 || graphHeight < 500) {
		// small screen - hide blurb until a click on the hamburger menu
		hamburgerButtonShowing = true;
		// and the whole screen is devoted to the graph
	}
	else {
		hamburgerButtonShowing = false;
		if (graphWidth > graphHeight) {
			// landscape orientation - place blurb to right side
			// if (blurbBox$.length)
			// 	blurbWidth = blurbBox$[0].offsetWidth;
			graphWidth -= blurbWidth + 4;
			flexDirection = 'row';
		}
		else {
			// portrait orientation - place blurb below
			// if (blurbBox$.length)
			// 	blurbHeight = blurbBox$[0].offsetHeight;
			graphHeight -= blurbHeight + 4;
			flexDirection = 'column';
		}
	}

	// do not confuse!
	// hamburgerButtonShowing = screen is small, so show hamburger button in
	//          northeast corner so user can see blurb
	// hamburgerMenuShowing = user has clicked button so blurb/menu showing.
	return {graphWidth, graphHeight, flexDirection, fontSize,
		hamburgerButtonShowing, hamburgerMenuShowing: false};
}

export default graphDimensions;

