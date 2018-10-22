import React, { Component } from 'react';

import config from './config';
import Svg2D from './Svg2D';

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class SceneDisplay extends Component {
	constructor(props) {
		super(props);
		this.state = {index: props.selectedIndex};
		this.lastIndex = -1;
	}
	
	render() {
////		if (this.lastIndex != this.props.index) {
////			// change of scene!  Have to set a few things.
////			Svg2D.setExternalScene(this.props.index, this.props.scene);
////		}
	
	
		let scene = config.scenes[this.props.selectedIndex];


		this.scene = scene;
		
		return (
			<div className='scene-display' >
				<Svg2D scene={scene} index={this.props.selectedIndex} width='800' height='600' />
			</div>
		);
	}


}

export default SceneDisplay;
