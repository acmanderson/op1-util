import React, {Component} from "react";
import "./App.css";
import Sample from "./components/Sample";
import AiffWriter from "./classes/AiffWriter";
import FileSaver from "file-saver";

class App extends Component {
  constructor() {
    super();
    this.state = {
      audioContext: new AudioContext(),
      buffers: []
    }
  }

  writeAiff() {
    const {buffers} = this.state;
    const aiffWriter = new AiffWriter(buffers);
    return aiffWriter.getBlob();
  }

  render() {
    const samples = [];
    for (let i = 0; i < 24; i++) {
      samples.push(
        <Sample
          audioContext={this.state.audioContext}
          key={i}
          note={i}
          setBuffer={(note, buffer) => {
            const {buffers} = this.state;
            buffers[note] = buffer;
            this.setState({buffers});
          }}
        />
      );
    }

    return (
      <div className="App">
        {samples}
        <button onClick={() => {
          const blob = this.writeAiff();
          FileSaver.saveAs(blob, 'patch.aif');
        }}>
          Click!
        </button>
      </div>
    );
  }
}

export default App;
