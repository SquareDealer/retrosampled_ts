import WaveSurfer from 'wavesurfer.js';

// Используй тип any, если тип недоступен:
export function createWaveSurfer(options: any): WaveSurfer {
  return WaveSurfer.create(options);
}