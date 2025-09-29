// Spatial audio helper
export class AudioManager {
  constructor(listener) {
    this.listener = listener;
    this.sounds = {};
  }

  async load(name, url, { loop=false, volume=1 }={}) {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.volume = volume;
    this.sounds[name] = audio;
    return new Promise(res => { audio.addEventListener('canplaythrough', () => res(audio), { once:true }); });
  }

  play(name) {
    const s = this.sounds[name];
    if (!s) return;
    s.currentTime = 0;
    s.play();
  }

  stop(name) { const s = this.sounds[name]; if (s) s.pause(); }
}
