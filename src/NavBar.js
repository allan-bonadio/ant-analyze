import React, { Component } from 'react';

import config from './config';
import StepWidget from './StepWidget';

class NavBar extends Component {
	constructor(props) {
		super(props);
		
		this.state = {};
		
		this.clickNumber = this.clickNumber.bind(this);
		this.clickNext = this.clickNext.bind(this);
	}
	
	render() {
		let buttons = config.scenes.map((scene, ix) => {
			let sel = (this.props.selectedIndex === ix) ? 'selected' : '';
			return <button type='button' key={ix} className={sel} onClick={this.clickNumber} >
				{ix + 1}
			</button>;
		});
////		for (let step = 0; step < this.props.nSteps; step++) {
////			let cls = (step == this.props.selectedIndex) ? 'selected' : '';
////			buttons.push(<button type='button' className={cls} onClick={this.clickNumber} >
////				{step + 1}
////			</button>);
////		}

		// the next button
		buttons.push(<button type='button' key='next' onClick={this.clickNext} >
			NEXT &nbsp; ❯
		</button>);
			
		return (
			<div className='nav-bar' >
				{buttons}
			</div>
		);
	}
	
	// human clicks on one of the number buttons
	clickNumber(ev) {
		let stepIndex = +ev.target.innerText - 1;
		StepWidget.goToStep(stepIndex);
	}
	
	// click on the NEXT> button
	clickNext(ev) {
		let stepIndex = (this.props.selectedIndex + 1) % config.scenes.length;
		StepWidget.goToStep(stepIndex);
	}
}

export default NavBar;
