import { ART } from "../data/art";

/**
 * Captions + replay (TECH §2.1, §9.1): lyric lives in the bottom letterbox bar —
 * cinema-subtitle style, never over the artwork; replay is a caption-styled control.
 */
export class Captions {
  private lyric: HTMLElement;
  private replay: HTMLElement;
  onReplay?: () => void;

  constructor() {
    const lyric = document.getElementById("lyric");
    const replay = document.getElementById("replay");
    if (!lyric || !replay) throw new Error("caption DOM missing");
    this.lyric = lyric;
    this.replay = replay;
    this.lyric.textContent = ART.meta.lyric;
    replay.addEventListener("click", () => this.onReplay?.());
  }

  update(t: number) {
    const T = ART.times;
    const inW = T.lyricIn;
    const outW = T.lyricOut;
    const shown = t >= inW && t < outW;
    this.lyric.classList.toggle("in", shown);

    // replay affordance after the fade-out ends
    this.replay.classList.toggle("show", t >= T.replayAt);
  }

  reset() {
    this.lyric.classList.remove("in");
    this.replay.classList.remove("show");
  }
}
