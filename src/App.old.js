import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Sample from './components/Sample';

class App extends Component {
  componentDidMount() {
    fetch('dk.aif').then(res => res.arrayBuffer()).then(buffer => {
      let slice = buffer.slice(1342, buffer.byteLength - 1342 + 488862);
      let buff = new Uint8Array(slice.byteLength);
      buff.set(new Uint8Array(slice));
      // buff.set(new Uint8Array([0, 0]), slice.byteLength);
      let view = new DataView(buff.buffer);
      let l = buff.byteLength;
      let frameCount = 0x3bacb;
      let floatArray = new Float32Array(frameCount);
      console.log(view.buffer);
      for (let i = 0; i < l; i+=2) {
        let num = (view.getInt16(i, true)) / 32768;
        // if (num > 1)
        //   num = num - 2;
        floatArray[i / 2] = num;
        if (i <= 10)
          console.log((view.getUint16(i, true) & 0x00ff), (view.getUint16(i, true) & 0xff00) >> 8)
      }
      console.log(floatArray);
      let audioContext = new AudioContext();
      let audioBuffer  = audioContext.createBuffer(1, frameCount, 44100);
      audioBuffer.copyToChannel(floatArray, 0);

      // Get an AudioBufferSourceNode.
      // This is the AudioNode to use when we want to play an AudioBuffer
      var source = audioContext.createBufferSource();
      // set the buffer in the AudioBufferSourceNode
      source.buffer = audioBuffer;
      // connect the AudioBufferSourceNode to the
      // destination so we can hear the sound
      source.connect(audioContext.destination);
      // start the source playing
      window.source = source;
      source.start();
      let blob = this.bufferToWave(audioBuffer, 0, audioBuffer.length);
      var a = document.createElement("a");
      document.body.appendChild(a);
      a.href = window.URL.createObjectURL(blob);
      a.download = "hey.wav";
      // a.click()
      console.log(source);
    });
  }

  bufferToWave(abuffer, offset, len) {

    var numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this demo)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
      channels.push(abuffer.getChannelData(i));

    while(pos < length) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true);          // update data chunk
        pos += 2;
      }
      offset++                                     // next source sample
    }

    // create Blob
    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }

  render() {
    return (
      <div className="App">
        <Sample/>
      </div>
    );
  }
}

export default App;
