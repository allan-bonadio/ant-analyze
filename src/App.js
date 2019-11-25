/* eslint-disable eqeqeq, no-throw-literal  */


import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';
import React, { Component } from 'react';

import config from './config';
import BlurbBox from './BlurbBox';
import Svg2D from './Svg2D';
import Webgl3D from './Webgl3D';

import './App.css';

class App extends Component {
	constructor(props) {
		super(props);
		App.me = this;  // singleton

		// the step index is 0...n-1, whereas the step number is 1...n
		// this is just the initial one
		this.state = {requestedIndex: 3};
	}
	
	render() {
		// only one of svg3d or webgl3d will appear
		let scene = config.scenes[this.state.requestedIndex];

		return (
			<div className='outer-wrapper'>
				<Svg2D  requestedIndex={this.state.requestedIndex} 
						name='area' show={scene.graphics == '2D'}/>
				<Webgl3D  requestedIndex={this.state.requestedIndex} 
						name='volume' show={scene.graphics == '3D'}/>
				<BlurbBox  requestedIndex={this.state.requestedIndex} />
			</div>
		);
	}

	// ultimately called by click handlers on the nav bar
	static goToStep(stepIndex) {
		App.me.setState({requestedIndex: stepIndex});
		Svg2D.haltMomentum();
	}
}

export default App;
