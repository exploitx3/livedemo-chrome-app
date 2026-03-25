import React, { Component } from 'react';
import icon from '../../assets/img/icon-128.png';
import logo from '../../assets/img/logo-round.png';
import logo128 from '../../assets/img/logo-128.png';
import logoRecording128 from '../../assets/img/logo-recording-128.png';
import logoSvg from '../../assets/img/logo-round.svg';

class GreetingComponent extends Component {
  state = {
    name: 'dev',
  };

  render() {
    return (
      <div>
        <p>Hello, {this.state.name}!</p>
        <img src={icon} alt="extension icon" />
      </div>
    );
  }
}

export default GreetingComponent;
