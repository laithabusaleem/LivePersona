type Props = {
  speaking: boolean;
  name: string;
};

/**
 * Clearly labeled synthetic static avatar.
 * Speaking pulse is NOT photoreal lip-sync — see docs/ARCHITECTURE.md.
 */
export function StaticAvatar({ speaking, name }: Props) {
  return (
    <div className="avatar-stage" aria-label={`Synthetic avatar ${name}`}>
      <span className="state-chip">
        {speaking ? "speaking (heuristic)" : "idle"} · synthetic
      </span>
      <svg
        className={`avatar-svg${speaking ? " speaking" : ""}`}
        viewBox="0 0 200 240"
        role="img"
      >
        <title>{name} — synthetic avatar</title>
        <ellipse className="glow" cx="100" cy="120" rx="78" ry="90" fill="#1f3d4d" opacity="0.35" />
        <rect x="40" y="40" width="120" height="140" rx="60" fill="#2a4a5e" stroke="#3dd6c6" strokeWidth="3" />
        <circle cx="75" cy="100" r="8" fill="#e8eef8" />
        <circle cx="125" cy="100" r="8" fill="#e8eef8" />
        <ellipse
          className="mouth"
          cx="100"
          cy="145"
          rx="18"
          ry="10"
          fill="#0c1220"
          style={{ transformOrigin: "100px 145px" }}
        />
        <text x="100" y="210" textAnchor="middle" fill="#93a4bd" fontSize="12" fontFamily="JetBrains Mono, monospace">
          {name}
        </text>
      </svg>
    </div>
  );
}
