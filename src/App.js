import React, { Component } from 'react';
import './App.css';
import StepWidget from './StepWidget';
import Svg2D from './Svg2D';

class App extends Component {
	constructor(props) {
		super(props);
	}
	
	render() {
		return (
			<div className="App">
				<StepWidget />
			</div>
		);
	}
}

export default App;
