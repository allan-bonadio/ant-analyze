import React, { Component } from 'react';

import config from './config';
import NavBar from './NavBar';

class BlurbBox extends Component {
	render() {
		let scene = config.scenes[this.props.selectedIndex];
		return (
			<div className='blurb-box' >
				<NavBar nSteps={config.scenes.length} selectedIndex={this.props.selectedIndex} />
				<h2 className='blurb-title'>
					{scene.title}
				</h2>
				<p className='blurb-text'>
					{scene.blurb}
				</p>
			</div>
		);
	}


}

export default BlurbBox;
