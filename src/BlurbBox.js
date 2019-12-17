/* eslint-disable eqeqeq, no-throw-literal  */
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
		let scene = config.scenes[this.props.requestedIndex];
		
		// decide which instructions to display
		let touchDisplay = 'none', mouseDisplay = 'none', threeDDisplay = 'none';
		if (scene.graphics == '2D') {
			if ('ontouchstart' in document.body)
				touchDisplay = 'block';
			else
				mouseDisplay = 'block';
		}
		else
			threeDDisplay = 'block';
		
		
		return (
			<div className='blurb-box' >
				<NavBar nSteps={config.scenes.length} 
						requestedIndex={this.props.requestedIndex} />
				<h2 className='blurb-title' 
						dangerouslySetInnerHTML={{__html: scene.title}}>
				</h2>
				<p className='blurb-text'>
					{scene.blurb}
				</p>
				<br clear='right' />
				<p className='desktop-instructions' style={{display: mouseDisplay}}>
					Click and drag to scroll sideways or vertically.
				</p>
				<p className='mobile-instructions' style={{display: touchDisplay}}>
					Drag to scroll.  Two fingers zoom in/out.
					<br/><big> ↔ </big> zoom along <i>x</i> axis
					<br/><big> ↕ </big> zoom along <i>y</i> axis
				</p>
				<p className='3D-instructions' style={{display: threeDDisplay}}>
					Drag to rotate.
				</p>
			</div>
		);
	}

}

export default BlurbBox;
