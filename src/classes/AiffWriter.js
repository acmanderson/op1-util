class AiffWriter {
  constructor(buffers, maxBuffers = 24) {
    this.buffers = buffers;
    this.maxBuffers = maxBuffers;
    this.pos = 0;
  }

  getFilledBuffers() {
    const filledBuffers = [];
    const bufferIndices = Object.keys(this.buffers).map(key => parseInt(key, 10));

    let currentBuffer = 0;
    for (let i = 0; i < this.maxBuffers; i++) {
      if (currentBuffer < bufferIndices.length - 1 && i >= bufferIndices[currentBuffer + 1]) {
        currentBuffer++;
      }

      if (i in this.buffers) {
        filledBuffers[i] = this.buffers[i];
      } else {
        filledBuffers[i] = this.buffers[bufferIndices[currentBuffer]];
      }
    }

    return filledBuffers;
  }

  getStartEndTimes() {
    const filledBuffers = this.getFilledBuffers();
    const startTimes = [], endTimes = [];
    const timeRatio = (2 ** 31 - 1) / 12;

    let currentDuration = 0;
    let timePadding = 0;

    for (let i = 0; i < this.maxBuffers; i++) {
      const bufferDuration = filledBuffers[i].duration;
      const startTime = Math.ceil(currentDuration * timeRatio) + timePadding;
      const endTime = Math.ceil((currentDuration + bufferDuration) * timeRatio) + timePadding;

      startTimes.push(startTime);
      endTimes.push(endTime);

      if (i < this.maxBuffers - 1 && filledBuffers[i] !== filledBuffers[i + 1]) {
        currentDuration += bufferDuration;
        // TODO: the OP-1 uses a padding of 4058 between the end time of one sample and
        // the start time of the next. It'd be worth figuring out why this is.
        timePadding += 4058;
      }
    }

    return [startTimes, endTimes];
  }

  setUint16(data) {
    this.view.setUint16(this.pos, data);
    this.pos += 2;
  }

  setUint32(data) {
    this.view.setUint32(this.pos, data);
    this.pos += 4;
  }

  setString(string) {
    for (let i = 0; i < string.length; i++) {
      this.view.setUint8(this.pos, string.charCodeAt(i));
      this.pos++;
    }
  }

  getBlob() {
    const [startTimes, endTimes] = this.getStartEndTimes();
    const soundBufferSize = this.buffers.reduce((acc, val) => {
      return acc + val.length;
    }, 0);

    const joinedBuffers = new Float32Array(soundBufferSize);
    let sizeOffset = 0;
    this.buffers.forEach(buffer => {
      joinedBuffers.set(buffer.getChannelData(0), sizeOffset);
      sizeOffset += buffer.length;
    });

    const jsonHeader = {
      "drum_version": 1,
      "type": "drum",
      "name": "user",
      "octave": 0,
      "pitch": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "start": startTimes,
      "end": endTimes,
      "playmode": [8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192],
      "reverse": [8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192],
      "volume": [8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192, 8192],
      "dyna_env": [0, 8192, 0, 8192, 0, 0, 0, 0],
      "fx_active": false,
      "fx_type": "delay",
      "fx_params": [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
      "lfo_active": false,
      "lfo_type": "tremolo",
      "lfo_params": [16000, 16000, 16000, 16000, 0, 0, 0, 0]
    };
    let jsonString = `op-1${JSON.stringify(jsonHeader)} `;

    let fileSize =
      soundBufferSize * 2 // why * 2?
      + 12                // FORM chunk
      + 26                // COMM chunk
      + 8                 // APPL chunk metadata
      + jsonString.length
      + 16;               // SSND chunk metadata
    while (fileSize % 4 !== 0) { // FIXME: may not be necessary?
      jsonString += String.fromCharCode(0);
      fileSize++;
    }

    const fileBuffer = new ArrayBuffer(fileSize);
    this.view = new DataView(fileBuffer);

    this.setUint32(0x464F524D); // "FORM"
    this.setUint32(fileSize - 8); // file length - 8
    this.setUint32(0x41494646); // "AIFF"

    this.setUint32(0x434F4D4D); // "COMM"
    this.setUint32(18); // COMM size
    this.setUint16(1); // number of channels
    this.setUint32(soundBufferSize); // number of sample frames
    this.setUint16(16); // sample size
    this.setUint32(0x400EAC44); // 4 bytes of 44100
    this.setUint32(0x00000000); // 4 bytes of 44100
    this.setUint16(0x0000); // 2 bytes of 44100

    this.setUint32(0x4150504C); // "APPL"
    this.setUint32(jsonString.length); // json blob size
    this.setString(jsonString);

    this.setUint32(0x53534E44); // "SSND"
    this.setUint32(soundBufferSize * 2 + 8);
    this.setUint32(0); // offset
    this.setUint32(0); // block size

    let writeOffset = 0;
    while (this.pos < fileSize) {
      let sample = joinedBuffers[writeOffset];
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      this.view.setInt16(this.pos, sample);
      this.pos += 2;
      writeOffset++;
    }

    return new Blob([fileBuffer], {type: "audio/aiff"});
  }
}

export default AiffWriter;