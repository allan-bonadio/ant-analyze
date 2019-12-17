/* eslint-disable eqeqeq, no-throw-literal  */


import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';
import React, { Component } from 'react';

import config from './config';
import BlurbBox from './BlurbBox';
import Svg2D from './Svg2D';
import Webgl3D from './Webgl3D';
import graphicEvents from './graphicEvents';

import './App.css';

// for startup, use 1 for 2d, 3 for 3d
//const INITIAL_SCENE_INDEX = 1;  // 2d sin(x)/x
const INITIAL_SCENE_INDEX = 3;  // 3d sin(x+iy)

class App extends Component {
	constructor(props) {
		super(props);
		App.me = this;  // singleton

		// scene is remembered in localStorage
		let chosenSceneIndex = localStorage.sceneIndex || INITIAL_SCENE_INDEX;
		this.scene = config.scenes[chosenSceneIndex];
		
		// the step index is 0...n-1, whereas the step number is 1...n
		// this is just the initial one
		this.state = {
			requestedIndex: chosenSceneIndex, 
			readout: '', 
			error: null,
			...graphicEvents.decideGraphDimensions(props.innerWidth? props : window),
		};

		this.setReadout = this.setReadout.bind(this);
	}
	
	// this intercepts exceptions from lower components during render.
	// Supposed to return an addition to the state to indicate so.
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
	
	static adjustForResize(graphSize) {
		App.me.setState(graphSize);
	}
	
	render() {
		let s = this.state;
		
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

				// and don't try that again.
				return <div>
					{error}
				</div>;
			}
		}
		error = Object.keys(error)[0];
		
		// only one of svg3d or webgl3d will appear, boolean 'show'
		///let scene = config.scenes[s.requestedIndex];

		return (
			<div className='outer-wrapper' style={{flexDirection: this.state.flexDirection}}>
				
				<div className='graph-wrapper'
							style={{width: this.state.graphWidth, 
									height: this.state.graphHeight}}>
					<div id='attitude-readout'>{s.readout}</div>
					{error}
					
					<Svg2D  requestedIndex={s.requestedIndex} 
							name='line' show={this.scene.graphics == '2D'}
							setReadout={this.setReadout} 
							graphWidth={this.state.graphWidth}
							graphHeight={this.state.graphHeight}
					/>
						
					<Webgl3D  requestedIndex={s.requestedIndex} 
							name='surface' show={this.scene.graphics == '3D'}
							setReadout={this.setReadout} 
							graphWidth={this.state.graphWidth}
							graphHeight={this.state.graphHeight}
					/>
				</div>
				
				<BlurbBox  requestedIndex={s.requestedIndex} />
			</div>
		);//// the height and width of graph-wrapper above
	}

	// ultimately called by click handlers on the nav bar, this sets the scene After
	// the initial render(s)
	static goToScene(sceneIndex) {
		App.me.setState({requestedIndex: sceneIndex, 
				error: null, secondError: null});
		App.me.scene = config.scenes[sceneIndex];
		Svg2D.prepForNewScene(sceneIndex);
		Webgl3D.prepForNewScene(sceneIndex);

		localStorage.sceneIndex = sceneIndex;  // remember for later
	}
	
	// the little text thing in the northwest corner of the graph
	setReadout(readout) {
		this.setState({readout});
	}
}

export default App;
