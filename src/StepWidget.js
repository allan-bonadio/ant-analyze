import React, { Component } from 'react';

import BlurbBox from './BlurbBox';
import SceneDisplay from './SceneDisplay';

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
				<BlurbBox  selectedIndex={this.state.selectedIndex} />
				<SceneDisplay  selectedIndex={this.state.selectedIndex} />
			</div>
		);
	}

	// ultimately called by click handlers on the nav bar
	static goToStep(stepIndex) {
		StepWidget.me.setState({selectedIndex: stepIndex});
	}
}

export default StepWidget;
