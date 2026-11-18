import type { WeatherScene } from "@/lib/weather/scene";

const MOTES = [
  { left: "8%", top: "18%", delay: "0s", duration: "8s" },
  { left: "22%", top: "62%", delay: "1.4s", duration: "9s" },
  { left: "70%", top: "22%", delay: "0.6s", duration: "7s" },
  { left: "84%", top: "58%", delay: "2s", duration: "10s" },
  { left: "48%", top: "12%", delay: "1s", duration: "8.5s" },
  { left: "60%", top: "74%", delay: "2.4s", duration: "9.5s" },
];

const FLAKES = [
  { left: "6%", delay: "0s", duration: "8s", size: 5 },
  { left: "18%", delay: "1.2s", duration: "10s", size: 3 },
  { left: "33%", delay: "0.4s", duration: "9s", size: 4 },
  { left: "47%", delay: "2s", duration: "11s", size: 6 },
  { left: "61%", delay: "0.8s", duration: "8.5s", size: 3 },
  { left: "74%", delay: "1.6s", duration: "12s", size: 5 },
  { left: "88%", delay: "0.2s", duration: "9.5s", size: 4 },
  { left: "54%", delay: "2.6s", duration: "10.5s", size: 3 },
];

/** GPU-friendly sky. Motion is transform and opacity only, and stops when reduced motion is on. */
export function WeatherBackdrop({ scene }: { scene: WeatherScene }) {
  return (
    <div className={`weather-sky weather-sky-${scene}`} aria-hidden>
      {scene === "sun" && (
        <>
          <span className="weather-sun" />
          <span className="weather-beam" style={{ left: "18%" }} />
          <span className="weather-beam weather-beam-late" style={{ left: "46%" }} />
          <span className="weather-beam" style={{ left: "72%", animationDelay: "1.2s" }} />
          {MOTES.map((mote) => (
            <span key={mote.left} className="weather-mote" style={{ left: mote.left, top: mote.top, animationDelay: mote.delay, animationDuration: mote.duration }} />
          ))}
        </>
      )}
      {scene === "cloud" && (
        <>
          <span className="weather-cloud weather-cloud-a" />
          <span className="weather-cloud weather-cloud-b" />
          <span className="weather-cloud weather-cloud-c" />
        </>
      )}
      {(scene === "rain" || scene === "storm") && (
        <>
          <span className="weather-rain" />
          <span className="weather-rain weather-rain-far" />
          <span className="weather-mist" />
        </>
      )}
      {scene === "storm" && <span className="weather-flash" />}
      {scene === "night" && (
        <>
          <span className="weather-moon" />
          <span className="weather-stars" />
        </>
      )}
      {scene === "fog" && (
        <>
          <span className="weather-fog weather-fog-a" />
          <span className="weather-fog weather-fog-b" />
        </>
      )}
      {scene === "snow" &&
        FLAKES.map((flake) => (
          <span
            key={flake.left}
            className="weather-flake"
            style={{ left: flake.left, width: flake.size, height: flake.size, animationDelay: flake.delay, animationDuration: flake.duration }}
          />
        ))}
    </div>
  );
}
