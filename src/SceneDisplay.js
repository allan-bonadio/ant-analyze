import React, { Component } from 'react';

import config from './config';
import SvgChart from './SvgChart';

// there is one of these total, it displays differences depending on its selectedIndex prop passed in
class SceneDisplay extends Component {
	render() {
		return (
			<div className='scene-display' >
				<SvgChart scene={config.scenes[this.props.selectedIndex]} width='800' height='600' />
			</div>
		);
	}


}

export default SceneDisplay;
