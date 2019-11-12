import React, { Component } from 'react';

import config from './config';
import NavBar from './NavBar';

import './BlurbBox.css';

class BlurbBox extends Component {
	// the calculated dimensions of the svg initially estimates this box to be some fixed height.
	// once we've rendered once
	componentDidMount() {
	
	}

	render() {
		let scene = config.scenes[this.props.selectedIndex];
////		let touchDisplay ='block';
////		let mouseDisplay = 'none';
////		if (! ('ontouchstart' in document.body)) {
////			touchDisplay = 'none';
////			mouseDisplay = 'block';
////		}
////		let touchDisplay =  ? 'block' : 'none';
////		let touchDisplay = 'ontouchstart' in document.body ? 'block' : 'none';
		let touchDisplay = 'ontouchstart' in document.body ? 'block' : 'none';
		let mouseDisplay = 'ontouchstart' in document.body ? 'none' : 'block';
		
		return (
			<div className='blurb-box' >
				<p className='desktop-instructions' style={{display: mouseDisplay}}>
					Click and drag to scroll sideways or vertically.
				</p>
				<p className='mobile-instructions' style={{display: touchDisplay}}>
					Drag to scroll.  Two fingers zoom in/out.
					<br/><big> ↔ </big> zoom along <i>x</i> axis
					<br/><big> ↕ </big> zoom along <i>y</i> axis
				</p>
				<NavBar nSteps={config.scenes.length} selectedIndex={this.props.selectedIndex} />
				<h2 className='blurb-title'>
					{scene.title}
				</h2>
				<p className='blurb-text'>
					{scene.blurb}
				</p>
				<br clear='right' />
			</div>
		);
	}

}

export default BlurbBox;
