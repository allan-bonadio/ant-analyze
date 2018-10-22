import React, { Component } from 'react';
import './App.css';
import StepWidget from './StepWidget';
import Svg2D from './Svg2D';

class App extends Component {
  render() {
    return (
      <div className="App" onMouseMove={Svg2D.mouseMove} 
      			onMouseUp={Svg2D.mouseUp} onMouseLeave={Svg2D.mouseUp}>
      	<StepWidget />
      </div>
    );
  }
}

export default App;
