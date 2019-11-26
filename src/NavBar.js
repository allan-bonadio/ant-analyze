import React, { Component } from 'react';

import config from './config';
import App from './App';

class NavBar extends Component {
	constructor(props) {
		super(props);
		
		this.state = {};
		
		this.clickNumber = this.clickNumber.bind(this);
		this.clickNext = this.clickNext.bind(this);
	}
	
	render() {
		let buttons = config.scenes.map((scene, ix) => {
			let sel = (this.props.requestedIndex === ix) ? 'selected' : '';
			return <div key={ix} index={ix} className={sel} onClick={this.clickNumber} 
						onMouseDown={this.killTextSelection}  
						dangerouslySetInnerHTML={{__html: scene.formula}} >
			</div>;
		});

		// the next button
		buttons.push(<div className='next-button' key='next' onClick={this.clickNext} onMouseDown={this.killTextSelection}>
			NEXT &nbsp; ❯
		</div>);
			
		return (
			<div className='nav-bar' >
				{buttons}
			</div>
		);
	}
	
	// human clicks on one of the number buttons
	clickNumber(ev) {
		ev.stopPropagation();
		App.goToStep(+ev.target.getAttribute('index'));
	}
	
	// click on the NEXT> button
	clickNext(ev) {
		ev.stopPropagation();
		let stepIndex = (this.props.requestedIndex + 1) % config.scenes.length;
		App.goToStep(stepIndex);
	}
	
	killTextSelection(ev) {
		ev.preventDefault();
	}
}

export default NavBar;
