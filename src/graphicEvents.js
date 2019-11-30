//
// graphic events -- intercept clicks and drags, and delegate out to each graph
//
/* eslint-disable eqeqeq, no-throw-literal  */


import $ from 'jquery';

import config from './config';

// .20 is almost like none.  1.0 stops everything immediately
const FRICTION = .90;

// we average out the velocity of dragging from the last several mouseMove events.
// each time the new velocity is mixed, weighted this much, with previous velocities
const MIX_FRACTION = .25;

// there is one and only one click-and-drag active at any given time.
// THerefore it is OK for me to use a global to represent it.
// this is true when mouse is down on a graph, up if not.
let nowDragging = false;

// this is true when there's some velocity on the sliding/rotation
// and it hasn't stopped yet.
let nowCoasting = false;

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
		graphicEvents.using = this;  // our original Svg2DE or Webgl3D instance
		
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
			//'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 'touchCancelEvt', 'touchForceChange',
			//'gestureStartHandler', 'gestureChangeHandler', 'gestureEndHandler',
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
		
		// attach event handlers only AFTER they're bound
		this.attachEventHandlers();

		if (config.production) {
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
				.on('mousemove', this.mouseMoveEvt)
				.on('mouseup', this.mouseUpEvt)
				.on('mouseleave', this.mouseLeaveEvt)
				
				.on('touchstart', this.touchStartEvt)
				// don't these need to be on the window, too, like the other handlers?
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

		if (nowDragging && this.prevTimeStamp !== undefined) {
			// timeStamp is NOT equal to Date.now() but is equal to event timeStamps
			// prob measured from page reload
			let dt = ev.timeStamp - this.prevTimeStamp;
			
			// our dragging coords are fractions of the drawing surface element width/height
			let dx = (ev.pageX - this.prevX) / this.graphElement.clientWidth;
			let dy = (ev.pageY - this.prevY) / this.graphElement.clientHeight;
			
			// if dt is zero or very small, the velocity skyrockets.  prevent.
			// This is milliseconds, remember.
			if (dt > .1 && Math.abs(dx) + Math.abs(dy) > 0) {
				// adjust these according to how much coasting velocity 
				// you get for a given shove
				let hv = 400 * dx / dt;
				let vv = 400 * dy / dt;
				
				this.horizVelocity = this.horizVelocity * (1 - MIX_FRACTION) +
							hv * MIX_FRACTION;
				this.vertVelocity = this.vertVelocity * (1 - MIX_FRACTION) +
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
		// 	(nowCoasting ? 'coasting ' : '') + (nowDragging ? 'dragging ' : '');
		this.graph.setReadout(this.horizPosition, this.vertPosition);
		this.drawFunc();
	}
	
	
	// handler for mouse down on graph surface
	mouseDownEvt(ev) {
// 		console.log("ge mouseDownEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		
		// now that we've clicked down, it's creepy if it keeps drifting under your finger
		this.stopAnimating();
		
		// just set the prev values; dragging is false
		nowDragging = false;
		this.mouseShove(ev);  // will only record positions and timestamps
		nowDragging = true;
		
		ev.preventDefault();
		ev.stopPropagation();
		
		// save these if a gesture is happening; must undo 
		// whatever single finger stuff it did       huh?!@?
		let s = this.graph.state;
		this.downMinMax = {xMin: s.xMin, xMax: s.xMax, yMin: this.yMin, yMax: this.yMax};
	}
	
	mouseMoveEvt(ev) {
// 		console.log("ge mouseMoveEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		if (! nowDragging)
			return;
		
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
		//console.log("ge mouseUpEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		if (! nowDragging)
			return;
		//this.mouseShove(ev);
		nowDragging = false;
		
		// start animating, if it was fast enough
		this.startAnimating(ev.timeStamp);
		

		ev.preventDefault();
		ev.stopPropagation();
	}
	
	mouseLeaveEvt(ev) {
		this.mouseUpEvt(ev);
	}
	
	/* ************************************************************ touch events */
	
	
	
	/* ************************************************************ gesture events */
	
	
	
	
	
	/* ************************************************************ resize / tilt events */
	
	// given the window obj that just resized, figure out margins and graphWidth/Height, 
	// return object to merge into state
	static decideGraphDimensions(win) {
		// size of the screen (or phony size passed in by testing - 
		// just prepare a phony event and call resizeEvt())
		let graphWidth = +win.innerWidth;
		let graphHeight = +win.innerHeight;
		
		// deduct the height of the blurb box, or if not created yet, just approximate
		let blurbHeight = 200;
		let blurbWidth = 400;
		let blurbBox$ = $('.blurb-box');
		if (graphWidth > graphHeight) {
			if (blurbBox$.length)
				blurbWidth = blurbBox$[0].offsetWidth;
			graphWidth -= blurbWidth + 4;
		}
		else {
			if (blurbBox$.length)
				blurbHeight = blurbBox$[0].offsetHeight;
			graphHeight -= blurbHeight + 4;
		}

		
		return {graphWidth, graphHeight};
	}
	
	// this is set on the window as a resize handler.  Once and only once.
	// Before any instances are created.  
	static resizeEvt(ev) {
		let graphSize = graphicEvents.decideGraphDimensions(ev.target);
		
		// now kick all the graphs cuz they all have to deal with it
		// setState will cause render to give the graphElement the new h/w
		graphicEvents.allGraphs.forEach(graph => {
			graph.specialForResize(graphSize.graphWidth, graphSize.graphHeight);	
			graph.setState(graphSize);
		});

		console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight,
			graphSize);
	}
	
	/* ************************************************************ animation */
	
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
		nowCoasting = true;
		this.then = timeStamp * .001;  // seconds
		requestAnimationFrame(this.animateOneFrame);
	}
	
	stopAnimating() {
		this.horizVelocity = this.vertVelocity = 0;
		nowCoasting = false;
	}

	// is called for each redraw of the graphics while coasting.
	// requestAnimationFrame calls it as long as animation or coasting is happening.
	animateOneFrame(now) {
		now *= 0.001;  // convert to seconds

		this.confirmSanity();

		// the first time, then is undefined so punt
		let deltaTime = this.then ? (now - this.then) : .1;
		this.then = now;
		if (isNaN(deltaTime))
			throw new Error("animateOneFrame: bad delta time "+ deltaTime);

		// the first time around, now is zero and the delta time can be enormous
		// or during debugging deltaTime can also be way big
		// so just snuff out all that stuff and don't act upon it
		if (deltaTime > 0 && Math.abs(deltaTime) < 1e4 && now > 0) {
			this.graph.setReadout(this.horizPosition, this.vertPosition);
			this.drawFunc(this.horizPosition, this.vertPosition);
			
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
				console.log("         animateOneFrame() stops coasting");
			}

			// turn off nowCoasting to just render one frame
			if (nowCoasting)
				requestAnimationFrame(this.animateOneFrame);
			
			this.confirmSanity();
		}
	}
}

export default graphicEvents;

// this will collect all graphs on the page so resizing the window can squish them
graphicEvents.allGraphs = [];

// this is the one time it's called
graphicEvents.setOuterHandlers();

