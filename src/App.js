/* eslint-disable eqeqeq, no-throw-literal  */
import React, { Component } from 'react';
import {config} from './config.js';
import BlurbBox from './BlurbBox.js';
import Svg2D from './Svg2D.js';
import Webgl3D from './Webgl3D.js';
import graphicEvents from './graphicEvents.js';
import graphDimensions from './graphDimensions.js';
import './App.css';

// for startup, use 1 for 2d, 3 for 3d
//const INITIAL_SCENE_INDEX = 1;  // 2d sin(x)/x
const INITIAL_SCENE_INDEX = 3;  // 3d sin(x+iy)

// window resize handler.
// runs before any instances are created.
function resizeEvt(ev) {
	let graphDims = graphDimensions(ev.target);
	// now kick App and all the graphs cuz they all have to deal with it
	// setState will cause render to give the graphElement the new h/w
	App.adjustForResize(graphDims);
	graphicEvents.allGraphs.forEach(graph => {
		graph.adjustForResize(graphDims.graphWidth, graphDims.graphHeight);
		graph.setState(graphDims);
	});
	console.log("resize ev", ev.target.innerWidth, ev.target.innerHeight,
		graphDims);
}

window.addEventListener('resize', graphicEvents.resizeEvt);



class App extends Component {
	constructor(props) {
		super(props);

		App.me = this;  // singleton.  I think I could get rid of this if I tried...

		// scene is remembered in localStorage.  So, validate.
		if (typeof config == 'undefined' || !config.scenes)
			throw `no config, no config.scenes`;
		let chosenSceneIndex = localStorage.sceneIndex || INITIAL_SCENE_INDEX;
		if (!config.scenes[chosenSceneIndex])
			chosenSceneIndex = INITIAL_SCENE_INDEX;
		localStorage.sceneIndex = chosenSceneIndex;
		this.scene = config.scenes[chosenSceneIndex];
		if (!this.scene)
			throw `no this.scene`;

		// the scene index is 0...n-1 and i keep adding more
		// this is just the initial one

		const graphDims = graphDimensions(props.innerWidth? props : window);

		this.state = {
			requestedIndex: chosenSceneIndex,
			readout: '',
			error: null,
			secondError: null,
			...graphDims,
		};
		this.setReadout = this.setReadout.bind(this);
		this.hamburgerClickEvt = this.hamburgerClickEvt.bind(this);
		this.beforeUnloadEvt = this.beforeUnloadEvt.bind(this);
		window.addEventListener('beforeunload', this.beforeUnloadEvt);
	}

	// this intercepts exceptions from lower components during render.
	// Supposed to return an addition to the state to indicate so.
	// These should be one level higher to catch exceptions in this file
	static getDerivedStateFromError(errObj) {
		// probably already spewed a message, huh?
// 		console.error('getDerivedStateFromError:',
// 				errObj.stack || errObj.message || errObj);
		debugger;
		return {error: errObj};
	}
	componentDidCatch(errObj, info) {
		console.error('App caught exception:', errObj.stack, info.componentStack);
		debugger;
		if (this.state.error)
			this.setState({secondError: errObj});  // repeat offender
		else
			this.setState({error: errObj});  // first render?  let it go again.
	}

	static adjustForResize(graphDims) {
		App.me.setState(graphDims);
	}

	// ultimately called by click handlers on the nav bar, this sets the scene After
	// the initial render(s)
	goToScene = (sceneIndex) => {
		this.setState({requestedIndex: sceneIndex,
					error: null, secondError: null});
		this.scene = config.scenes[sceneIndex];
		Svg2D.prepForNewScene(sceneIndex);
		Webgl3D.prepForNewScene(sceneIndex);
		localStorage.sceneIndex = sceneIndex;  // remember as user pref
	}

	// the little text thing in the northwest corner of the graph
	setReadout(readout) {
		this.setState({readout});
	}

	// a click on the hamburger menu button to show the blurb
	hamburgerClickEvt(ev) {
		this.setState({hamburgerMenuShowing: ! this.state.hamburgerMenuShowing})
	}

	// this gets called before reload; must dispose of some stuff to avoid
	// error messages and garbage collection problems.
	beforeUnloadEvt(ev) {
		////ev.preventDefault();
		Svg2D.me.dispose();
		Webgl3D.me.dispose();
		////return null;
	}

	render() {
		let s = this.state;
		// if we've got an error attached, show it
		let error = {};
		if (s.error) {
			// show this oopsey on the screen but draw the rest of it anyway
			error[s.error.message] = true;
			if (s.secondError) {
				// no, we've got a pattern here.  Kill the render.
				error[s.secondError.message] = true;
				error = Object.keys(error).map(
						(er, ix) => <h1 key={ix} style={{color: 'red'}}>{er.message}</h1>
					);
				// and don't try that again.  (secondError ensures this.)
				return <div>
					{error}
				</div>;
			}
		}
		error = Object.keys(error)[0];
		// only one of svg3d or webgl3d will appear, boolean 'show'
		// do the menu properly
		let blurbStyle = {display: 'block', minWidth: 23 * s.fontSize};
		if (s.hamburgerButtonShowing && ! s.hamburgerMenuShowing)
			blurbStyle.display = 'none';
		if (!this.scene)
			throw `this.scene empty in render`;
		return (
			<div className='outer-wrapper' style={{flexDirection: s.flexDirection}}>
				<div id='hamburger-button' onClick={this.hamburgerClickEvt} >
					<div /> <div /> <div />
				</div>
				<div className='graph-wrapper'
							style={{width: s.graphWidth,
									height: s.graphHeight}}>
					<div id='attitude-readout'>{s.readout}</div>
					{error}
					<Svg2D  requestedIndex={s.requestedIndex}
							name='line' show={this.scene.graphics == '2D'}
							setReadout={this.setReadout}
							graphWidth={s.graphWidth}
							graphHeight={s.graphHeight}
							goToScene={this.goToScene}
					/>
					<Webgl3D  requestedIndex={s.requestedIndex}
							name='surface' show={this.scene.graphics == '3D'}
							setReadout={this.setReadout}
							graphWidth={s.graphWidth}
							graphHeight={s.graphHeight}
							goToScene={this.goToScene}
					/>
				</div>
				<BlurbBox  requestedIndex={s.requestedIndex}
					style={blurbStyle} goToScene={this.goToScene} />
			</div>
		);//// the height and width of graph-wrapper above
	}
}
export default App;
