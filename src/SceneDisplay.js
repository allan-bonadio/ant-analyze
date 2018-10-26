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
		this.scene = config.scenes[this.props.selectedIndex];
		
		return (
			<div className='scene-display' >
				<Svg2D scene={this.scene} index={this.props.selectedIndex} />
			</div>
		);
	}


}

export default SceneDisplay;
