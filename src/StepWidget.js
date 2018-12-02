import React, { Component } from 'react';

import BlurbBox from './BlurbBox';
import SceneDisplay from './SceneDisplay';
import Svg2D from './Svg2D';

class StepWidget extends Component {
	constructor(props) {
		super(props);
		StepWidget.me = this;  // singleton

		// the step index is 0...n-1, whereas the step number is 1...n
		this.state = {selectedIndex: 0};
	}
	
	render() {
		return (
			<div className='step-widget'>
				<SceneDisplay  selectedIndex={this.state.selectedIndex} />
				<BlurbBox  selectedIndex={this.state.selectedIndex} />
			</div>
		);
		
					////	<SceneDisplay  selectedIndex={this.state.selectedIndex} />
////				<div class='scene-display' style={{backgroundColor: 'green', height: '100%', }}>
////					blah blah blah
////				</div>

	}

	// ultimately called by click handlers on the nav bar
	static goToStep(stepIndex) {
		StepWidget.me.setState({selectedIndex: stepIndex});
		Svg2D.haltMomentum();
	}
}

export default StepWidget;
