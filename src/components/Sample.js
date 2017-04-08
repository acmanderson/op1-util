import React, {Component} from 'react';
import Dropzone from 'react-dropzone';

class Sample extends Component {
  flattenBuffer(buffer) {
    const {audioContext} = this.props;
    let numFrames = buffer.length * buffer.numberOfChannels;
    let monoBuffer = audioContext.createBuffer(1, numFrames, buffer.sampleRate * buffer.numberOfChannels);
    let array = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i += buffer.numberOfChannels) {
      for (let j = 0; j < buffer.numberOfChannels; j++) {
        array[i + j] = buffer.getChannelData(j)[i / buffer.numberOfChannels];
      }
    }
    monoBuffer.copyToChannel(array, 0);
    return monoBuffer
  }

  resampleBuffer(buffer) {
    let offlineContext = new OfflineAudioContext(1, buffer.length / (buffer.sampleRate / 44100), 44100);
    const offlineSource = offlineContext.createBufferSource();
    offlineSource.buffer = buffer;
    offlineSource.connect(offlineContext.destination);
    offlineSource.start();
    return offlineContext.startRendering();
  }

  setBuffer(source, buffer) {
    const {audioContext, note} = this.props;
    source.buffer = buffer;
    source.connect(audioContext.destination);
    this.setState({source});
    this.props.setBuffer(note, buffer);
    source.start(0);
  }

  onDrop(files) {
    const {audioContext, note} = this.props;
    const file = files[0];
    this.setState({file});
    const source = audioContext.createBufferSource();
    const fileReader = new FileReader();
    fileReader.addEventListener('loadend', () => {
      audioContext.decodeAudioData(fileReader.result).then(buffer => {
        if (buffer.numberOfChannels > 1) {
          buffer = this.flattenBuffer(buffer);
        }

        let bufferPromise;
        if (buffer.sampleRate !== 44100) {
          bufferPromise = this.resampleBuffer(buffer);
        } else {
          bufferPromise = new Promise((resolve, reject) => resolve(buffer));
        }
        bufferPromise.then(buffer => {
          source.buffer = buffer;
          source.connect(audioContext.destination);
          this.setState({source});
          this.props.setBuffer(note, buffer);
          source.start(0);
        });
      });
    });
    fileReader.readAsArrayBuffer(file.slice());
  }

  render() {
    const {file} = this.state || {};
    return (
      <div>
        <Dropzone onDrop={file => this.onDrop(file)} multiple={false}>
          {file ? file.name : 'Put a sample here.'}
        </Dropzone>
      </div>
    );
  }
}

export default Sample;