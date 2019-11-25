//
// graphic events -- intercept clicks and drags, and delegate out to each graph
//
/* eslint-disable eqeqeq, no-throw-literal  */


import $ from 'jquery';

// .20 is almost like none.  1.0 stops everything immediately
const FRICTION = .50;

let nowDragging = false;

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
	constructor(graph, drawFn, shoveFn) {
		// keep in touch
		this.graph = graph;
		this.graphElement = graph.graphElement;
		this.drawFunc = drawFn;
		this.shoveFunc = shoveFn;

		// this is a mode.  I don't think it's a good idea.  The graph should be what's selected!!!
		graphicEvents.using = this;  // our original Svg2DE or Webgl3D instance
		
		// these are the variables that represent translation motion from click/drag
		this.horizPosition = 0;  // left - right
		this.vertPosition = 0;  // top - bottom
		this.horizVelocity = 0;
		this.vertVelocity = 0;

		this.then = Date.now();
		this.animateOneFrame = this.animateOneFrame.bind(this);


		// tedious
		[
			'mouseDownEvt', 'mouseMoveEvt', 'mouseUpEvt', 
			//'mouseWheelEvt', 'resizeEvt',
			//'touchStartEvt', 'touchMoveEvt', 'touchEndEvt', 'touchCancelEvt', 'touchForceChange',
			//'gestureStartHandler', 'gestureChangeHandler', 'gestureEndHandler',
		].forEach(funcName => this[funcName] = this[funcName].bind(this));
		
		// attach event handlers only AFTER they're bound
		this.attachEventHandlers();
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
			.mouseleave(graphicEvents.oMouseLeaveEvt)

		// but that doesn't apply to touch events ... ??
		$('div.outer-wrapper')
				.on('touchmove', ev => ev.stopPropagation())
				.on('touchend', ev => ev.stopPropagation())
				.on('touchcancel', ev => ev.stopPropagation());
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
	
	
	// sets event handlers on the canvas or svg dom element
	// called by componentDidMount().  Note at this point the canvas should be there
	attachEventHandlers() {
		// touch events on the graphicElement are effective
		$(this.graphElement)
				.on('mousedown', this.mouseDownEvt)
				.on('mousemove', this.mouseMoveEvt)
				.on('mouseUp', this.mouseUpEvt)
				.on('mouseLeave', this.mouseLeaveEvt)
				
				.on('touchstart', this.touchStartEvt)
				// don't these need to be on the window, too, like the other handlers?
				.on('touchmove', this.touchMoveEvt)
				.on('touchend', this.touchEndEvt)
				.on('touchcancel', this.touchCancelEvt);

		// touch events outside put a clamp on it
	}
	
	mouseShove(ev) {
	// 	console.log('event: %O', ev);
// 		console.log('mouseShove x=%s, y=%s, timeStamp=%s', ev.pageX, ev.pageY, 
// 			ev.timeStamp);

		if (nowDragging && this.prevTimeStamp !== undefined) {
			// timeStamp is NOT equal to Date.now(); prob measured from pg reload
			let dt = ev.timeStamp - this.prevTimeStamp;
			
			// our dragging coords are fractions of the drawing surface element width/height
			let dx = (ev.pageX - this.prevX) / this.graphElement.clientWidth;
			let dy = (ev.pageY - this.prevY) / this.graphElement.clientHeight;
			
			// if dt is zero or very small, the velocity skyrockets.  prevent.
			// This is milliseconds, remember.
			if (dt > .1) {
				this.horizVelocity = - 6 * dx / dt;
				this.vertVelocity = 6 * dy / dt;
			}
			
			this.horizPosition += dx;
			this.vertPosition += dy;
// 			console.log('shoveFunc hPos=%s, vPos=%s, dh=%s dv=%s', 
// 						this.horizPosition, this.vertPosition, dx, dy);
			this.shoveFunc(this.horizPosition, this.vertPosition, dx, dy);
			
			// in case arithmetic fumbles.  Doesn't seem to happen anymore.
			if (isNaN(this.horizPosition + this.vertPosition + 
							this.horizVelocity + this.vertVelocity))
				debugger;
			this.constrain();
		}
		this.prevX = ev.pageX;
		this.prevY = ev.pageY;
		this.prevTimeStamp = ev.timeStamp;
		
		this.drawFunc();
	}
	
	
	// handler for mouse down on graph surface
	mouseDownEvt(ev) {
// 		console.log("ge mouseDownEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		
		// just set the prev values; dragging is false
		nowDragging = false;
		this.mouseShove(ev);
		nowDragging = true;
		
		// yeah, i'm missing an offset for the svg versus the page; it'll be ok
		this.downX = ev.pageX;
		this.downY = ev.pageY;
		ev.preventDefault();
		ev.stopPropagation();
		
		// save these if a gesture is happening; must undo whatever single finger stuff it did
		// huh?!@?
		let s = this.graph.state;
		this.downMinMax = {xMin: s.xMin, xMax: s.xMax, yMin: this.yMin, yMax: this.yMax};
	}
	
	mouseMoveEvt(ev) {
// 		console.log("ge mouseMoveEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		if (! nowDragging)
			return;
		this.mouseShove(ev);

		ev.preventDefault();
		ev.stopPropagation();
	}

	mouseUpEvt(ev) {
		console.log("ge mouseUpEvt", ev.pageX, ev.pageY, ev.timeStamp, nowDragging);////
		if (! nowDragging)
			return;
		this.mouseShove(ev);
		nowDragging = false;
		
		// momentum?
// 		if (Math.abs(this.offsetX) + Math.abs(this.offsetY) > 0.1) {
// 			this.heartbeat = setInterval(() => {
// 				this.shoveByOffset();
// 
// 				// decaying exponentially
// 				this.offsetX *= .95;
// 				this.offsetY *= .95;
// 				
// 				// but stop when it gets too slow, or it gets annoying
// 				if (Math.abs(this.offsetX) + Math.abs(this.offsetY) < 0.01)
// 					clearInterval(this.heartbeat);
// 			}, 50);
// 		}

		ev.preventDefault();
		ev.stopPropagation();
	}
	
	mouseLeaveEvt(ev) {
		this.mouseUpEvt(ev);
	}
	
	/* ************************************************************ touch events */
	
	
	
	/* ************************************************************ gesture events */
	
	
	
	
	
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

	// is called for each redraw of the graphics while coasting.
	// It calls itself as long as animation or coasting is happening.
	animateOneFrame(now) {
		if (! document.getElementById('attitude-readout'))
			return;
		now *= 0.001;  // convert to seconds
		
		// the first time, then is undefined so punt
		let deltaTime = this.then ? (now - this.then) : .1;
		this.then = now;
		if (isNaN(deltaTime) || ! deltaTime)
			throw new Error("animateOneFrame: bad delta time ", deltaTime);

		this.drawFn(this.horizPosition, this.vertPosition);
		
		// Update for the next draw
		this.horizPosition = this.horizPosition + this.horizVelocity * deltaTime;
		this.vertPosition = this.vertPosition + this.vertVelocity * deltaTime;



		//;
		
		// and some friction please.  All time in units of seconds.
		let factor = (1 - FRICTION) ** deltaTime;
		this.horizVelocity *= factor;
		this.vertVelocity *= factor;
		
		this.constrain();

// 		let r2d = radians => radians * 180 / Math.PI;
// 		let readout = document.getElementById('attitude-readout');
// 		if (readout) {
// 			readout.innerHTML = 
// 				r2d(this.horizPosition).toFixed() +'° long '+
// 				r2d(this.vertPosition).toFixed() +'° lat';
// 		}

		// comment this out to just render one frame
		requestAnimationFrame(this.animateOneFrame);

	}
};

// this is the one time it's called
graphicEvents.setOuterHandlers();

export default graphicEvents;
