import { useState } from "react";

/** The 3-minute demo, in the hero - as a facade, not an embed.
 *
 *  Nothing is requested from YouTube until the visitor clicks: no iframe, no cookie,
 *  no third-party script on first paint. That keeps the promise the rest of the page
 *  makes (this deployment talks to nobody you did not ask it to) and keeps the hero
 *  fast, which matters more than autoplay ever could.
 *
 *  To publish the video: set VIDEO_ID to the YouTube id and, if you have one, POSTER
 *  to a frame of your own. With VIDEO_ID empty the block renders nothing at all, so
 *  the page is never left showing a broken player.
 */
const VIDEO_ID = "";
const POSTER = "/shots/sc-live.png";
const DURATION = "2 min 55";

export default function HeroVideo() {
  const [playing, setPlaying] = useState(false);
  if (!VIDEO_ID) return null;

  return (
    <figure className="ce-video" data-testid="hero-video">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
          title="COBOL Explorer · 3-minute demo"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button className="ce-video-facade" onClick={() => setPlaying(true)}
          aria-label={`Play the demo video, ${DURATION}`} data-testid="hero-video-play">
          <img src={POSTER} alt="" aria-hidden="true" loading="lazy" />
          <span className="ce-video-play" aria-hidden="true">
            <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor"><path d="M1 1.6v16.8L17 10z" /></svg>
          </span>
          <span className="ce-video-meta">
            <b>Watch the demo</b>
            <i>{DURATION} · the whole product, end to end</i>
          </span>
        </button>
      )}
    </figure>
  );
}
