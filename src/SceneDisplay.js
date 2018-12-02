import React, { Component } from 'react';

import Svg2D from './Svg2D';

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class SceneDisplay extends Component {
	constructor(props) {
		super(props);
		this.state = {selectedIndex: props.selectedIndex};
		this.lastIndex = -1;
	}
	
	render() {
		return (
			<div className='scene-display' >
				<Svg2D selectedIndex={this.props.selectedIndex} />
			</div>
		);
	}


}

export default SceneDisplay;
