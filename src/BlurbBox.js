/* eslint-disable eqeqeq, no-throw-literal  */
import React from 'react';
import config from './config.js';
import NavBar from './NavBar.js';
import './BlurbBox.css';

function BlurbBox(props) {
	let scene = config.scenes[props.requestedIndex];
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
		<div id='blurb-box' style={props.style} >
			<NavBar nSteps={config.scenes.length}
					requestedIndex={props.requestedIndex} goToScene={props.goToScene}/>
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
			<div className='3D-instructions' style={{display: threeDDisplay}}>
				Drag to rotate.  Color key:
				<p className='colorExample red'>red is +1</p>
				<p className='colorExample chartreuce'>chartreuce is +<var>i</var></p>
				<p className='colorExample cyan'>cyan is –1</p>
				<p className='colorExample purple'>purple is –<var>i</var></p>
			</div>
		</div>
	);
}
export default BlurbBox;
