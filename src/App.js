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
		this.state = {selectedIndex: 3};
	}
	
	render() {
		// only one of svg3d or webgl3d will appear
		let scene = config.scenes[this.state.selectedIndex];
		let graph = (scene.graphics == '2D') 
			? <Svg2D  selectedIndex={this.state.selectedIndex} />
			: <Webgl3D  selectedIndex={this.state.selectedIndex} />

		return (
			<div className='step-widget'>
				{graph}
				<BlurbBox  selectedIndex={this.state.selectedIndex} />
			</div>
		);
	}

	// ultimately called by click handlers on the nav bar
	static goToStep(stepIndex) {
		App.me.setState({selectedIndex: stepIndex});
		Svg2D.haltMomentum();
	}
}

export default App;
