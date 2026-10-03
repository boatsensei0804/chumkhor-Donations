// Web Audio API based ceremonial chime & bell sound
class SoundPlayer {
  private audioCtx: AudioContext | null = null;

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Pre-unlock audio on user gesture
  unlockAudio() {
    try {
      this.initContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch {}
  }

  // Play peaceful ceremonial bell / singing bowl sound
  playCeremonyBell() {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      // Frequencies for a rich, warm Thai ceremonial singing bowl / temple bell (Fundamental + harmonics)
      const baseFreq = 587.33; // D5 tone
      const harmonics = [
        { freq: baseFreq, gain: 0.45, decay: 3.2 },
        { freq: baseFreq * 1.503, gain: 0.25, decay: 2.5 },
        { freq: baseFreq * 2.002, gain: 0.18, decay: 2.0 },
        { freq: baseFreq * 2.76, gain: 0.10, decay: 1.4 },
        { freq: baseFreq * 3.52, gain: 0.05, decay: 0.8 },
      ];

      harmonics.forEach(({ freq, gain, decay }) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Gentle attack then natural exponential decay
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, now + decay);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + decay);
      });
    } catch (e) {
      console.warn('Audio play failed or was blocked by browser policy:', e);
    }
  }
}

export const soundPlayer = new SoundPlayer();
