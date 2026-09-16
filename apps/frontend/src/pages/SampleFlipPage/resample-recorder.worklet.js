/* global AudioWorkletProcessor, currentFrame, registerProcessor */
// Capture the processed sample bus, never the monitor/metronome bus.
class ResampleRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.startFrame = options.processorOptions.startFrame;
    this.stopFrame = Infinity;
    this.alive = true;
    this.used = 0;
    this.chunkStart = this.startFrame;
    this.channels = [new Float32Array(4096), new Float32Array(4096)];
    this.port.onmessage = ({ data }) => {
      if (data.type === "cancel") this.alive = false;
      if (data.type === "stop" && this.alive) {
        this.stopFrame = Math.max(this.startFrame, data.stopFrame);
        if (this.stopFrame <= currentFrame) this.finish();
      }
    };
  }

  flush() {
    if (!this.used) return;
    const channels = this.channels.map((channel) =>
      channel.slice(0, this.used),
    );
    this.port.postMessage(
      { type: "chunk", offset: this.chunkStart - this.startFrame, channels },
      channels.map((channel) => channel.buffer),
    );
    this.chunkStart += this.used;
    this.used = 0;
  }

  finish() {
    this.flush();
    this.alive = false;
    this.port.postMessage({
      type: "done",
      frames: this.stopFrame - this.startFrame,
    });
  }

  process(inputs, outputs) {
    if (!this.alive) return false;
    const input = inputs[0] ?? [];
    const blockLength = outputs[0][0].length;
    const from = Math.max(0, this.startFrame - currentFrame);
    const to = Math.min(blockLength, this.stopFrame - currentFrame);
    for (let i = from; i < to; i++) {
      if (!this.used) this.chunkStart = currentFrame + i;
      this.channels[0][this.used] = input[0]?.[i] ?? 0;
      this.channels[1][this.used] = (input[1] ?? input[0])?.[i] ?? 0;
      if (++this.used === this.channels[0].length) this.flush();
    }
    if (currentFrame + blockLength >= this.stopFrame) this.finish();
    // Outputs remain silent; the sample bus is already connected to the speakers.
    return this.alive;
  }
}
registerProcessor("flip-resample-recorder", ResampleRecorder);
