import React, { Component } from 'react';

import BlurbBox from './BlurbBox';
////import SceneDisplay from './SceneDisplay';
import Svg2D from './Svg2D';

import './App.css';

class App extends Component {
	constructor(props) {
		super(props);
		App.me = this;  // singleton

		// the step index is 0...n-1, whereas the step number is 1...n
		this.state = {selectedIndex: 0};
	}
	
	render() {
		return (
			<div className='step-widget'>
				<Svg2D  selectedIndex={this.state.selectedIndex} />
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
