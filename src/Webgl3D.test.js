/*

		
				Not implemented yet	

*/

import 'raf/polyfill';  // says to
import 'core-js/es6/map';
import 'core-js/es6/set';

import React from 'react';
import ReactDOM from 'react-dom';

import enzyme, {configure, shallow, mount, render} from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

import Svg2D, {axisMargin} from './Svg2D';
import NavBar from './NavBar';
import config from './config';

configure({ adapter: new Adapter() });

// make an Svg2D component, but pass back the wrapper for its iinner <svg>
function makeASvg() {
	return mount(
		<Svg2D requestedIndex='0' innerWidth='600' innerHeight='500' />
	).childAt(0);
}

// check the pixel locations of the margin rectangle, slightly inside the svg itself
function checkMargins(instance) {
	expect(instance.marginLeft).toEqual(axisMargin);
	expect(instance.marginRight).toEqual(instance.state.svgWidth - axisMargin);
	expect(instance.marginTop).toEqual(axisMargin);
	expect(instance.marginBottom).toEqual(instance.state.svgHeight - axisMargin);
}

let preventDefault = () => {};
	
	
describe('Svg2D ', () => {
	// mostly based on the initial render and method calls leading up to it
	let w, instance;

	// applies to all 'it' calls, even in sub-describes
	beforeEach(() => {
		w = makeASvg();
		instance = Svg2D.me;  // the actual instance of Svg2D class
	});

	it('renders without crashing', () => {
		const div = document.createElement('div');
		ReactDOM.render(<Svg2D requestedIndex='0' />, div);
	});

	describe('nodes under svg ', () => {
		it('should have three direct g children ', () => {
			expect(w.find('g').length).toEqual(3);
			expect(w.find('g.xAxis').length).toEqual(1);
			expect(w.find('g.yAxis').length).toEqual(1);
			expect(w.find('g.line-paths').length).toEqual(1);
		});

		function testAxis(axis) {
			//console.log('testAxis:', axis.debug());
			
			// we must check the DOM nodes directly cuz they're created by d3, not react
			let ax = axis.getDOMNode();  // axis's overall g
			let gtick = ax.children[1];   // g for the first tick mark

			// each has a line and text element
			expect(gtick.children[0].nodeName).toEqual('line');
			expect(gtick.children[1].nodeName).toEqual('text');
		}
		
		it('has x and y axes ', () => {
			//console.log('w:', w.debug({ignoreProps: false}));
			testAxis(w.find('g.xAxis'));  // x axis
			testAxis(w.find('g.yAxis'));  // y axis
		});
			
		it('has series ', () => {
			let paths = w.childAt(2).find('path');  // the g element
			expect(paths.length).toEqual(2);
			
			// the d attribute has all the coordinates of the line segments, it's long
			expect(paths.at(0).prop('d').length).toBeGreaterThan(2000);
			expect(paths.at(1).prop('d').length).toBeGreaterThan(2000);
		});
	});

	describe('calculations ', () => {
		it('initially, has has the right overall sizes ', () => {
			let t = instance;
			let s = t.state;
			expect(s.svgWidth).toEqual(196);
			expect(s.svgHeight).toEqual(500);

			checkMargins(instance);
////			expect(t.marginLeft).toEqual(axisMargin);
////			expect(t.marginTop).toEqual(axisMargin);
////			expect(t.marginRight).toEqual(s.svgWidth - axisMargin);
////			expect(t.marginBottom).toEqual(s.svgHeight - axisMargin);
		});

		it('getDerivedStateFromProps() should work right ', () => {
			let dState;
			
			// when not changing scene
			dState = Svg2D.getDerivedStateFromProps({requestedIndex: 0}, {requestedIndex: 0});
			expect(dState).toBeNull();
			
			// when changing scene
			dState = Svg2D.getDerivedStateFromProps({requestedIndex: 1}, {requestedIndex: 0});
			expect(instance.funcs).toBe(config.scenes[1].funcs);
			expect(dState.xMin).toEqual(-20);
			expect(dState.xMax).toEqual(20);
		});

		it('can calculate the data table ', () => {
			//console.log(instance.pixelsAr);
			expect(instance.pixelsAr).toBeTruthy();
			let [sinAr, cosAr] = instance.pixelsAr;
			
			// check point number 5
			expect(sinAr[5].x).toBeCloseTo(-5.393939393939394, 10);
			expect(sinAr[5].y).toBeCloseTo(0.7765968953564173, 10);

			expect(cosAr[5].x).toBeCloseTo(-5.393939393939394, 10);
			expect(cosAr[5].y).toBeCloseTo(0.6299978270778193, 10);

			// sin's y values should add up to zero cuz it's an odd function
			let sum = sinAr.map(p => p.y).reduce((ya, yb) => ya + yb);
			expect(sum).toBeCloseTo(0, 10);
		});

		it('can calculate the d3 scalers ', () => {
			let min, max;
			let s = instance.state;
			
			[min, max] = instance.xScale.domain();
			expect(min).toEqual(-6);
			expect(min).toEqual(s.xMin);
			expect(max).toEqual(6);
			expect(max).toEqual(s.xMax);
			
			[min, max] = instance.yScale.domain();
			expect(min).toBeCloseTo(-1, 2);
			expect(min).toEqual(instance.yMin);
			expect(max).toBeCloseTo(1, 2);
			expect(max).toEqual(instance.yMax);
		});
	});

	xdescribe('event utilities ', () => {
		// little methods that are used for clicks and touches
		it('shoveByOffset() correctly modifies x/yMin/Max and x/yScale domains ', () => {
			// starting with the default state as first rendered...
			instance.offsetX = 3.5;
			instance.offsetY = 1.1
			instance.shoveByOffset();
			
			// easy, in the instance.  The xMin and yMin are in the state and was 
			// recently set with setState() so ... just check it through the scaler
			expect(instance.yMin).toBeCloseTo(0.1, 2);
			expect(instance.yMax).toBeCloseTo(2.1, 2);
			
			// make sure scalers are updated
			expect(instance.xScale.domain()).toEqual([-2.5, 9.5]);
			let yMin, yMax;
			[yMin, yMax] = instance.yScale.domain();
			expect(yMin).toBeCloseTo(0.1, 2);
			expect(yMax).toBeCloseTo(2.1, 2);
		});

		it('touchToEvent() correctly makes an event out of a single touch obj ', () => {
			let newEv = instance.touchToEvent({
						preventDefault,
						touches: [
							{foo: 'foo', bar: 'bar'}
						]
					});
			expect(typeof newEv.preventDefault).toEqual('function');
			expect(newEv.foo).toEqual('foo');
		});

		it('calcTouchFingers() correctly figures out the  delta and midpoint ', () => {
			let widthHeight, midpoint, touches;

			// zero touches
			expect(instance.calcTouchFingers([])).toBeNull();
			
			// one touch
			touches = [{clientX: 150, clientY: 200}];
			[widthHeight, midpoint] = instance.calcTouchFingers(touches);
			expect(widthHeight).toEqual([0, 0]);
			expect(midpoint[0]).toBeCloseTo(3.319148936170212, 2);
			expect(midpoint[1]).toBeCloseTo(0.2030396172963268, 2);
			
			// two touches
			touches = [{clientX: 150, clientY: 200}, {clientX: 200, clientY: 150}];
			[widthHeight, midpoint] = instance.calcTouchFingers(touches);
			expect(widthHeight).toEqual([50, 50]);
			expect(midpoint[0]).toBeCloseTo(4.914893617021276, 2);
			expect(midpoint[1]).toBeCloseTo(0.30455942594449026, 2);
			
			// three touches
			touches = [{clientX: 250, clientY: 250}, {clientX: 100, clientY: 300}, {clientX: 90, clientY: 240}];
			[widthHeight, midpoint] = instance.calcTouchFingers(touches);
			expect(widthHeight).toEqual([160, 60]);
			expect(midpoint[0]).toBeCloseTo(4.595744680851064, 10);
			expect(midpoint[1]).toBeCloseTo(-0.08121584691853079, 2);
		});
	});

	xdescribe('mouse & touch drags ', () => {
		let origTimeout;
		beforeAll(() => {
			origTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;  // defaults to 5000
			jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
		});
		
		// this is called both by mouse and by touch-1 code
		// pass down the done() then handler-event pairs for down, move and up
		function tryDragging(done, downEvent, mDown, moveEvent, mMove, upEvent, mUp) {
			//console.log("tryDragging args:", arguments);
			
			// click down.  these coords are in pixel units.
			mDown(downEvent);
			expect(instance.dragging).toBeTruthy();
			
			// these are all in data units
////			console.log(instance.downY, instance.downMinMax);////
			expect(instance.downX).toBeCloseTo(0.12765957446808507, 2);
			expect(instance.downY).toBeCloseTo(0.6091188518889805, 2);
			expect(instance.offsetX).toEqual(0);
			expect(instance.offsetY).toEqual(0);
			
			// downMinMax in case this turns into a 2-finger touch
			expect(instance.downMinMax.xMin).toEqual(-6);
			expect(instance.downMinMax.xMax).toEqual(6);
			expect(instance.downMinMax.yMin).toBeCloseTo(-1, 2);
			expect(instance.downMinMax.yMax).toBeCloseTo(1, 2);

			// move a bit
			mMove(moveEvent);
			//console.log(instance.offsetX, instance.offsetY);////
			expect(instance.dragging).toBeTruthy();
			expect(instance.offsetX).toBeCloseTo(-3.1914893617021267, 10);
			expect(instance.offsetY).toBeCloseTo(0.2030396172963268, 2);
			checkMargins(instance);

			// mouse up stops it
			mUp(upEvent);
			//console.log(instance.offsetX, instance.offsetY);////
			expect(instance.dragging).toBeFalsy();
			expect(instance.offsetX).toBeCloseTo(-3.1914893617021267, 10);
			expect(instance.offsetY).toBeCloseTo(0.2030396172963268, 2);
			checkMargins(instance);
			
			// then let momentum carry it a bit
			setTimeout(() => {
				//console.log(instance.offsetX, instance.offsetY);////
				expect(instance.dragging).toBeFalsy();
				
				// for some reason the equivalent expect()s never come back
				let expectX = -2.117299248794879;
				if (Math.abs(instance.offsetX - expectX) > .01)
					fail(`offsetX off, was ${instance.offsetX} expected ${expectX}`);
				
				let expectY = 0.1279655989517205;
				if (Math.abs(instance.offsetY - expectY) > .01)
					fail(`offsetY off, was ${instance.offsetY} expected ${expectY}`);
			 	
				// inexplicably these take a long time to do (>10min)
				////expect(instance.offsetX).toBeCloseTo(-0.44910884556302577, 10);
				////expect(instance.offsetY).toBeCloseTo(0.11227721139075647, 10);
				done();
			}, 525);//525
		}


		it('mouse moves the domains correctly but not the ranges', done => {
			tryDragging(done, 
				{pageX: 100, pageY: 100, preventDefault}, instance.mouseDownEvt, 
				{pageX: 150, pageY: 150,	preventDefault}, instance.mouseMoveEvt, 
				{pageX: 150, pageY: 150, preventDefault}, instance.mouseUpEvt);
		});

		it('touch moves the domains correctly but not the ranges', done => {
			tryDragging(done, 
				{touches: [{pageX: 100, pageY: 100}], pageX: 100, pageY: 100, preventDefault},
				instance.mouseDownEvt, 
				{touches: [{pageX: 150, pageY: 150}], pageX: 150, pageY: 150,	preventDefault}, 
				instance.mouseMoveEvt, 
				{touches: [{pageX: 150, pageY: 150}], pageX: 150, pageY: 150, preventDefault}, 
				instance.mouseUpEvt);
		});

		afterAll(() => {
			jasmine.DEFAULT_TIMEOUT_INTERVAL = origTimeout;
		});
	});

	describe('resizing ', () => {
	});






	describe('just screwing areound ', () => {
		const tabStr = '                                                                ';
		var textOut;
		
		function analObj(obj, indent) {
			if (indent > 3)
				return;
			if (obj == undefined)  // undefined or null
				return;
			
			let tabs = tabStr.substr(tabStr.length - 3*indent);

			let names = Object.getOwnPropertyNames(obj);
			//console.log(names);
			
			names.forEach(name => {
				try {
					let sub = obj[name];
					analVal(sub, indent, name);
				} catch (ex) {
					textOut += tabs +'error in '+ name +': '+ ex.stack +'\n';
				}
			});

			let symbols = Object.getOwnPropertySymbols(obj);
			
			symbols.forEach(sy => {
				try {
					let sub = obj[sy];
					analVal(sub, indent, sy.toString());
				} catch (ex) {
					textOut += tabs +'error in '+ sy +': '+ ex.stack +'\n';
				}
			});
		}
		
		function analVal(val, indent, name) {
			let tabs = tabStr.substr(tabStr.length - 3*indent);

			switch (typeof val) {
			case 'boolean': case 'number': case 'undefined':
				textOut += tabs + name +' '+ (typeof val) +' '+ val +'\n';
				break;
			
			case 'symbol':
				textOut += tabs + name +' symbol '+ val.toString() +'\n';
				break;
			
			case 'string':
				textOut += tabs + name + ' "'+ val.replace(/"/, '\\"') +'"\n';
				break;
				
			case 'object':
				textOut += tabs + name + ' object '+ val +'\n';
				analObj(val, indent+1);
				break;
				
			case 'function':
				textOut += tabs + name + ' function '+ val.name +'\n';
				analObj(val, indent+1);
				break;
			}
		}
		
		function anal(val) {
			textOut = '\n';
			analVal(val, 0, '');
			console.log(textOut);
		}
		
////		anal("just a stinrg");
////		anal(666);
////		anal(true);
////		anal(undefined);
////		anal({a: 11, b: 22});
////		anal(() => {});
	
		it('structures of mount and shallow ', () => {
				let dsd = <div><span /></div>;
				let divm =  mount(dsd);
				////console.log("divm", divm, divm.debug());
				//anal(divm);
				
				let divm2 = divm[Symbol.for('enzyme.__root__')];
				console.log(divm2, divm2 === divm);

				let divmNode = divm[Symbol.for('enzyme.__node__')];
				console.log(divmNode, divmNode === dsd);

				let divmNodes = divm[Symbol.for('enzyme.__nodes__')];
				console.log(divmNodes, divmNodes[0] === dsd, divmNodes[0] === divmNode);

				let divs =  shallow(<div><span /></div>);
				console.log("divs", divs, divs.debug());
				//anal(divs);
				g
////			let navw =  mount(<NavBar requestedIndex='0' />);
			////console.log("navw", navw, navw.debug());

////			let navs =  shallow(<NavBar requestedIndex='0' />);
			////console.log("navs", navs, navs.debug());
				
				
				expect(true).toBeTruthy();
////			expect(typeof newEv.preventDefault).toEqual('function');
////			expect(newEv.foo).toEqual('foo');
		});

	});
});
