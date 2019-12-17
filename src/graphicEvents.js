//
// graphic events -- intercept clicks and drags, and delegate out to each graph
//					also does window resizing events, animation and other stuff
//
/* eslint-disable eqeqeq, no-throw-literal  */


import $ from 'jquery';

import config from './config';
import App from './App';

// .20 is almost like none.  1.0 stops everything immediately
const FRICTION = .90;

// we average out the velocity of dragging from the last several mouseMove events.
// each time the new velocity is mixed, weighted this much, with previous velocities
// Should be between 0.01 and 0.99, probably lower than .4
// 0.1 is like, the average is 10% this time's velocity and 90% last time's average.
//              So there's a lot of momentum.
// 0.5 is like, the average is 50% this time's velocity and 50% last time's average.
//              The average fades by a factor of two each call.
// 0.9 is like, the average is 90% this time's velocity and 10% last time's average.
//              So there's almost no momentum and it's fluid.
// by the way, unless we're taking time into acct, we're not doing it right.
// the mixing should be gradual over time, and proportional to the time... 
const MIX_FRACTION = .25;

// there is one and only one click-and-drag active at any given time.
// THerefore it is OK for me to use a global to represent it.
// this is true when mouse is down on a graph, up if not.
// let this.dragging = false;

// this is true when there's some velocity on the sliding/rotation
// and it hasn't stopped yet.
//let this.coasting = false;

// should be one of these for every instance of Svg2D or Webgl3D
// construct one in your graph constructor like this:
// 	  this.events = new graphicEvents(this, canvas, ()=>{}, ()=>{});
// In your render method, do this (or similar)
//    <canvas ... ref={canvas => this.graphElement = canvas}></canvas>
class graphicEvents {
	// call this with 
	// graph = the component you want to attach this to, Svg2D or a WebGL3D
	// graphElement = dom node for canvas or svg
	// we'll call shoveFn as long as user is doing stuff
	// and drawFn until things stop moving.
	constructor(graph, sensitiveElement, drawFn, shoveFn) {
		// keep in touch
		this.graph = graph;
		this.graphElement = graph.graphElement;
		this.sensitiveElement = sensitiveElement;
		
		this.drawFunc = drawFn;
		this.shoveFunc = shoveFn;
		
		graphicEvents.allGraphs.push(graph);

		// this is a mode.  I don't think it's a good idea.  The graph should be what's selected!!!
		//graphicEvents.using = this;  // our original Svg2D or Webgl3D instance
		
		// these are the variables that represent translation motion from click/drag
		this.horizPosition = 0;  // left - right
		this.vertPosition = 0;  // top - bottom
		this.horizVelocity = 0;
		this.vertVelocity = 0;
		
		// tedious
		[
			'animateOneFrame', 
			'mouseDownEvt', 'mouseMoveEvt', 'mouseUpEvt', 'mouseLeaveEvt',
			//'mouseWheelEvt', 
			'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 'touchCancelEvt', 
			//'gestureStartHandler', 'gestureChangeHandler', 'gestureEndHandler',
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
		
		// attach event handlers only AFTER they're bound
		this.attachEventHandlers();

		// when it starts up, give it a tiny kick to show people they can rotate it
		if (config.production && this.graph.scene.graphics == '3D') {
			this.horizPosition = .7;  // about 45°
			this.vertPosition = .5;  // maybe 30°
			this.horizVelocity = .1;
			setTimeout(() => this.startAnimating(0), 1);
		}

	}

	// which instance of graphicEvents do you want to start using now?
	// pass it in here and all of this's settings are saved till next time
	static use(grEv) {
		graphicEvents.using = grEv;
	}


	/* ************************************************************ mouse events */
	
	// call this exactly once upon startup
	// to set event handlers for the body etc.  We don't remove these so I want
	// to avoid like doing this once per frame or something.
	static setOuterHandlers() {
		// once you click down on the graph surface, you can drag out all over the window.
		$(document.body)
			.mousemove(graphicEvents.oMouseMoveEvt)
			.mouseup(graphicEvents.oMouseUpEvt)
			.mouseleave(graphicEvents.oMouseLeaveEvt);

		// but that doesn't apply to touch events ... ??
		// touch events outside put a clamp on it
		$('div.outer-wrapper')
				.on('touchmove', ev => ev.stopPropagation())
				.on('touchend', ev => ev.stopPropagation())
				.on('touchcancel', ev => ev.stopPropagation());

		// note the handler is static
		window.addEventListener('resize', graphicEvents.resizeEvt);
	}
	
	static oMouseMoveEvt(ev) {
		if (! graphicEvents.using)
			return;
		return graphicEvents.using.mouseMoveEvt(ev);
	}
	
	static oMouseUpEvt(ev) {
		if (! graphicEvents.using)
			return;
		return graphicEvents.using.mouseUpEvt(ev);
	}
	
	static oMouseLeaveEvt(ev) {
		if (! graphicEvents.using)
			return;
		return graphicEvents.using.mouseLeaveEvt(ev);
	}
	
	// in case arithmetic fumbles, we can get NaNs that spread everywhere.
	confirmSanity() {
		if (!isNaN(this.horizPosition + this.vertPosition + 
				this.horizVelocity + this.vertVelocity))
			return;
		debugger;
		// after debugging, those NaNs won't go away by themselves
		this.horizPosition = this.vertPosition = 
		this.horizVelocity = this.vertVelocity = 0
	}

	// sets event handlers on the canvas or svg dom element
	// called by componentDidMount().  Note at this point the canvas should be there
	attachEventHandlers() {
		// touch events on the graphicElement are effective
		$(this.sensitiveElement)
				.on('mousedown', this.mouseDownEvt)
				
				// these will catch them actually on the drawing surface
				.on('mousemove', this.mouseMoveEvt)
				.on('mouseup', this.mouseUpEvt)
				.on('mouseleave', this.mouseLeaveEvt)
				
				.on('touchstart', this.touchStartEvt)
				// don't these need to be on the window, too, like the other handlers?
				// no, touch events get funneled into the original element
				.on('touchmove', this.touchMoveEvt)
				.on('touchend', this.touchEndEvt)
				.on('touchcancel', this.touchCancelEvt)
	}
	
	// this handles incremental moves from mouse/touch/gesture events.
	// Eventually calls some shove functions on the graph
	mouseShove(ev) {
		// console.log('mouseShove x=%s, y=%s, timeStamp=%s', ev.pageX, ev.pageY, 
		// 	ev.timeStamp);

		this.confirmSanity();

		if (this.dragging && this.prevTimeStamp !== undefined) {
			// timeStamp is NOT equal to Date.now() but is equal to event timeStamps
			// prob measured from page reload.  or maybe this: performance.now()
			let dt = ev.timeStamp - this.prevTimeStamp;
			
			// our dragging coords are fractions of the drawing surface element width/height
			let dx = (ev.pageX - this.prevX) / this.graphElement.clientWidth;
			let dy = (ev.pageY - this.prevY) / this.graphElement.clientHeight;
			
			// if dt is zero or very small, the velocity skyrockets.  prevent.
			// This is milliseconds, remember.
			if (dt > .1 && Math.abs(dx) + Math.abs(dy) > 0) {
				// adjust these numbers according to how much coasting velocity 
				// you get for a given shove
				let hv = 400 * dx / dt;
				let vv = 400 * dy / dt;
				
				// make a weighted average between this velocity and the velocity 
				// average from last time.
				this.horizVelocity = 
					this.horizVelocity * (1 - MIX_FRACTION) + 
					hv * MIX_FRACTION;
				this.vertVelocity = 
					this.vertVelocity * (1 - MIX_FRACTION) + 
					vv * MIX_FRACTION;
			}

			this.horizPosition += dx;
			this.vertPosition += dy;
			// console.log('shoveFunc hPos=%s, dh=%s , dh/dt=%s :::: vPos=%s, dv=%s, dv/dt=%s', 
			// 			this.horizPosition.toFixed(5), dx.toFixed(5), 
			// 			this.horizVelocity.toFixed(5),
			// 			this.vertPosition.toFixed(5), dy.toFixed(5), 
			// 			this.vertVelocity.toFixed(5));
			this.shoveFunc(this.horizPosition, this.vertPosition, dx, dy);
			
			this.confirmSanity();
			this.constrain();
		}
		this.prevX = ev.pageX;
		this.prevY = ev.pageY;
		this.prevTimeStamp = ev.timeStamp;
		
		// let extra = ' '+ 
		// 	(this.coasting ? 'coasting ' : '') + (this.dragging ? 'dragging ' : '');
		this.graph.setReadout(this.horizPosition, this.vertPosition);
		this.drawFunc();
	}
	
	
	// handler for mouse down on graph surface
	mouseDownEvt(ev) {
// 		console.log("ge mouseDownEvt", ev.pageX, ev.pageY, ev.timeStamp, this.dragging);////
		
		// now that we've clicked down, it's creepy if it keeps drifting under your finger
		this.stopAnimating();
		
		// just set the prev values; dragging is false
		this.dragging = false;
		this.mouseShove(ev);  // will only record positions and timestamps
		this.dragging = true;
		
		ev.preventDefault();
		ev.stopPropagation();
		
		// save these if a gesture is happening; must undo 
		// whatever single finger stuff it did       huh?!@?
		//let s = this.graph.state;
		//this.downMinMax = {xMin: s.xMin, xMax: s.xMax, yMin: this.yMin, yMax: this.yMax};
	}
	
	mouseMoveEvt(ev) {
 		//console.log("ge mouseMoveEvt", ev.pageX, ev.pageY, ev.timeStamp, this.dragging);////
		if (! this.dragging)
			return;
		
		let timeDelta = window.performance.now() - this.mostRecentMoveTime;
		if (timeDelta > 100)
			console.log('graphicEvents.mouseMoveEvt, too slow ms:', timeDelta);
		this.mostRecentMoveTime = window.performance.now();

		// if no left mouse buttons are being pressed... it's over
		// this happens when you never get the mousedown cuz of debugger, menu, etc
		if (0 == (ev.buttons & 1)) {
			this.mouseUpEvt(ev);
			return;
		}
		this.mouseShove(ev);

		ev.preventDefault();
		ev.stopPropagation();
	}

	mouseUpEvt(ev) {
		//console.log("ge mouseUpEvt", ev.pageX, ev.pageY, ev.timeStamp, this.dragging);////
		if (! this.dragging)
			return;
		//this.mouseShove(ev);
		this.dragging = false;
		
		// start animating, if it was fast enough
		this.startAnimating(ev.timeStamp);
		
		ev.preventDefault();
		ev.stopPropagation();
	}
	
	mouseLeaveEvt(ev) {
		this.mouseUpEvt(ev);
	}
	
	
	/* ******************************************************* touch & gesture events */
	// touch events are like mouse events, eg touchStart ~= mouseDown.  
	// But the start/end are delivered for events for each finger, and you can have several of them.  
	// Each ev object also has a list of touches, one for each finger that's currently down.
	// Also, you don't have to intercept Move and End events for the window or body;
	// they guarantee the touch events are delivered to the touchStart element.

	// convert the 0th touch in this event to a pseudo-event good enough for the mouse funcs
	// only call this in a one-touch situation
	touchToEvent(ev) {
		let t = ev.touches[0];
		t.preventDefault = ev.preventDefault;  // make it look like an event
		t.stopPropagation = ev.stopPropagation;
		t.buttons = 1;  // simulate the left mouse button down
		
		// why don't ios safari touch evts have timeStamp?
		t.timeStamp = t.timeStamp || performance.now();
		return t;
	}

	// one fingertip touches
	touchStartEvt(ev) {
		console.log("touch StartEvt", ev.touches[0].pageX, ev.touches[0].pageY, ev.touches);

		// when you set touch event handlers, mouse events stop coming.  
		// So fake it unless there's 2 or more touches
		if (ev.touches.length == 1)
			this.mouseDownEvt(this.touchToEvent(ev));
		else
			this.touchStartHandler(ev)
	}
	
	// one (or more?) touches has moved
	touchMoveEvt(ev) {
		console.log("touchMoveEvt", ev.touches[0].pageX, ev.touches[0].pageY, ev.touches);
		if (ev.touches.length == 1)
			this.mouseMoveEvt(this.touchToEvent(ev));
		else
			this.touchMoveHandler(ev)
	}
	
	// one fingertip releases
	touchEndEvt(ev) {
		console.log("touchEndEvt", ev.touches);
		if (ev.touches.length == 1)
			this.mouseUpEvt(this.touchToEvent(ev));
		else
			this.touchEndHandler(ev)
	}
	
	// this is rare stuff like the program quits out from under your fingers
	touchCancelEvt(ev) {
		console.log("touchCancelEvt", ev.touches);
		if (ev.touches.length == 1) 
			this.mouseUpEvt(this.touchToEvent(ev));
		else
			this.touchCancelHandler(ev)
	}
	
	
	/* **************************************** 2+ finger gestures */
	// this section is concerned with 2 (or more?) touches.  In the case of one touch,
	// the touch*Evt() handlers decides between mouse-like or one of these.
	
	// given array of touches, give me delta X and delta Y, over all fingers, 
	// top to bottom and L to R
	// Also the midpoint of all of them if isTouchStart is true
	calcTouchFingers(touches, isTouchStart) {
		// this should only happen on touch end events.  but i think they happen 
		// other times too.
		if (touches.length <= 0)
		 	return null;
		
		// all of this is screen pixel coordinates on the svg/canvas surface
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (let t = 0; t < touches.length; t++) {
			// these are all in pixel units
			let touch = touches[t];
			minX = Math.min(minX, touch.clientX);
			minY= Math.min(minY, touch.clientY);
			maxX = Math.max(maxX, touch.clientX);
			maxY= Math.max(maxY, touch.clientY);
		};
		
		this.lastDelta = this.delta;
		this.delta = [maxX - minX, maxY - minY];
		if (isTouchStart) {
			this.touchMidPoint = [
				(maxX + minX)/2, 
				(maxY + minY)/2,
				// this.xScale.invert((maxX + minX)/2), 
				// this.yScale.invert((maxY + minY)/2),
			];
		}
	}
	
	// called upon the second touch of a fingertip (at same time)
	touchStartHandler(ev) {
		// pull the plug on normal drag, which has been started
		this.dragging = false;
		//this.setState(this.downMinMax);

		// so the spread direction is decided when the second touch starts;
		// whether it's about the same X or about the same Y as the first touch
		this.calcTouchFingers(ev.touches, true);
		this.spread = (Math.abs(this.delta[0]) > Math.abs(this.delta[1]))
				? 'horiz' : 'vert';

		ev.preventDefault();
	}
	
	touchMoveHandler(ev) {
		// eslint-disable-next-line
		let delta, mid, factor, xMin, xMax, yMin, yMax;
// 		let s = this.state;
// 		let midi = this.touchMidPoint;
		
		this.calcTouchFingers(ev.touches);
		//delta = this.calcTouchFingers(ev.touches)[0];
		// is it a vertical or horizontal gesture?
		if (this.spread == 'horiz') {
			// horizontal - stretch the x axis in 2d
			this.graph.spreadHoriz(this.delta, this.lastDelta, this.touchMidPoint);
			
// 			factor = this.lastDelta[0] / delta[0];
// 			////console.log("horiz, factor=", factor, this.lastDelta, delta);
// 			xMin = (s.xMin - midi[0]) * factor +  midi[0];
// 			xMax = (s.xMax - midi[0]) * factor +  midi[0];
// 			this.setState({xMin , xMax});
// 			////console.log("xmin/max:", xMin, xMax);
// 			this.xScale.domain([xMin, xMax]);
		}
		else {
			// vertical - stretch the y axis in 2d
			this.graph.spreadVert(this.delta, this.lastDelta, this.touchMidPoint);
			
// 			factor =this.lastDelta[1] /  delta[1];
// 			////console.log("vertical, factor=", factor, this.lastDelta, delta);
// 			this.yMin = (this.yMin - midi[1]) * factor +  midi[1];
// 			this.yMax = (this.yMax - midi[1]) * factor +  midi[1];
// 			// must trigger rerendering even though state didn't change
// 			this.setState({xMax: this.state.xMax + 1e-10});
// 			////console.log("ymin/max:", this.yMin, this.yMax);
// 			this.yScale.domain([this.yMin, this.yMax]);
		}
		
////if (factor < .8 || factor > 1.2) debugger;
		////console.log("tmh dom and range", this.xScale.domain(), this.xScale.range());

		ev.preventDefault();
	}
	
	// but this just means ANY touch ended; other one stays and does a mouseup
	touchEndHandler(ev) {
		this.spread = false;
		ev.preventDefault();
	}
	
	touchCancelHandler(ev) {
		this.spread = false;
		ev.preventDefault();
	}

	
	/* ************************************************************ gesture events */
	
	gestureStartHandler(ev) {
		console.log("gestureStartHandler");
	}
	gestureChangeHandler(ev) {
		console.log("gestureChangeHandler");
	}
	gestureEndHandler(ev) {
		console.log("gestureEndHandler");
	}
	
	
	
	/* ***************************************************** resize / tilt events */
	
	// given the window obj (that prob just resized), figure out margins and graphWidth/Height, 
	// return object to merge into state.  This is called by the App component.
	static decideGraphDimensions(win) {
		// size of the screen (or phony size passed in by testing - 
		// just prepare a phony event and call resizeEvt())
		let graphWidth = +win.innerWidth;
		let graphHeight = +win.innerHeight;
		let flexDirection;
		
		// deduct the height of the blurb box, or if not created yet, just approximate
		let blurbHeight = 280, blurbWidth = 350;
		////let blurbBox$ = $('.blurb-box'), flexDirection;
		if (graphWidth > graphHeight) {
			// landscape orientation - place blurb to right side
// 			if (blurbBox$.length)
// 				blurbWidth = blurbBox$[0].offsetWidth;
			graphWidth -= blurbWidth + 4;
			flexDirection = 'row';
		}
		else {
			// portrait orientation - place blurb below
// 			if (blurbBox$.length)
// 				blurbHeight = blurbBox$[0].offsetHeight;
			graphHeight -= blurbHeight + 4;
			flexDirection = 'column';
		}

		return {graphWidth, graphHeight, flexDirection};
	}
	
	// this is set on the window as a resize handler.  Once and only once.
	// Before any instances are created.  
	static resizeEvt(ev) {
		let graphSize = graphicEvents.decideGraphDimensions(ev.target);
		
		// now kick App and all the graphs cuz they all have to deal with it
		// setState will cause render to give the graphElement the new h/w
		App.adjustForResize(graphSize);
		graphicEvents.allGraphs.forEach(graph => {
			graph.adjustForResize(graphSize.graphWidth, graphSize.graphHeight);	
			graph.setState(graphSize);
		});

		console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight,
			graphSize);
	}
	
	/* ************************************************************ animation */
	// coasting after user has released the mouse/touch
	
	// constrain the vertPos and horPos if desired (really just the 3d)
	// watch out you don't measure velocity after this!  you may get some wraparound!
	constrain() {
		let vertClamp = this.graph.vertClamp
		if (vertClamp) {
			if (this.vertPosition < vertClamp[0]) {
				this.vertPosition = vertClamp[0];
				this.vertVelocity = -this.vertVelocity / 2;  // bang!
			}
			if (this.vertPosition > vertClamp[1]) {
				this.vertPosition = vertClamp[1];
				this.vertVelocity = -this.vertVelocity / 2;  // bounce!
			}
		}

		let horizCyclic = this.graph.horizCyclic;
		if (horizCyclic) {
			// just modulus.  pos will always be [0...horizCyclic)
			let h = this.horizPosition / horizCyclic;
			this.horizPosition = (h - Math.floor(h)) * horizCyclic;
		}
	}
	
	// start animating/coasting given a timeStamp from a recent event
	startAnimating(timeStamp) {
		if (! this.graph.show)
			return;
			
		this.coasting = true;
		this.then = timeStamp * .001;  // seconds
		this.aniId = requestAnimationFrame(this.animateOneFrame);
	}
	
	stopAnimating() {
		if (! this.graph.show)
			return;
			
		cancelAnimationFrame(this.aniId);  // aborts upcoming one
		
		this.horizVelocity = this.vertVelocity = 0;
		this.coasting = false;
	}

	// is called for each redraw of the graphics while coasting.
	// requestAnimationFrame calls it as long as animation or coasting is happening.
	animateOneFrame(now) {
		now *= 0.001;  // convert to seconds
		
		// maybe if we're going backwards in time, we can just blow off this time around
		if (now < this.then)
			return;

		this.confirmSanity();

		// the first time, then is undefined so punt
		let deltaTime = this.then ? (now - this.then) : .1;
		this.then = now;
		if (isNaN(deltaTime))
			throw new Error("animateOneFrame: bad delta time "+ deltaTime);
		

		// the first time around, now is zero and the delta time can be enormous
		// or during debugging deltaTime can also be way big
		// so just snuff out all that stuff and don't act upon it
		if (Math.abs(deltaTime) < 1e4 && now > 0) {
// 		if (deltaTime > 0 && Math.abs(deltaTime) < 1e4 && now > 0) {
			// at this point, a negative delta time is possible.  Maybe whenI drag and 
			// let go.  maybe other times, unclear.  I don't think I should draw going 
			// backwards, though
 			if (deltaTime > 0) {
				this.graph.setReadout(this.horizPosition, this.vertPosition);
				this.drawFunc(this.horizPosition, this.vertPosition);
 			}
			
			// Update for the next draw
			let dh = this.horizVelocity * deltaTime;
			this.horizPosition = this.horizPosition + dh;
			let dv = this.vertVelocity * deltaTime;
			this.vertPosition = this.vertPosition + dv;
			this.shoveFunc(this.horizPosition, this.vertPosition, dh, dv);

			// and some friction please.  All time in units of seconds.
			// this is why a big deltaTime is a problem
			let factor = (1 - FRICTION) ** deltaTime;
			this.horizVelocity *= factor;
			this.vertVelocity *= factor;
		
			this.constrain();
			

			if (Math.abs(this.horizVelocity) + Math.abs(this.vertVelocity) < .001) {
				// static friction kicks in where it grinds to a halt
				this.stopAnimating();
				console.log("         stop coasting");
			}

			if (this.coasting)
				this.aniId = requestAnimationFrame(this.animateOneFrame);
			
			this.confirmSanity();
		}
	}
}

export default graphicEvents;

// this will collect all graphs on the page so resizing the window can squish them
graphicEvents.allGraphs = [];

// this is the one time it's called
graphicEvents.setOuterHandlers();

