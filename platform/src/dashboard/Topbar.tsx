
interface TopBarProps {
  onReset: () => void;
}

export function TopBar({ onReset }: TopBarProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });
  const icon = "/icon.png";

  return (
    <div className="topbar">
      <div className="topbar__left">
        <div className="topbar__logo"><img src={icon} alt="Meridian Bank Logo" /></div>
      </div>

      <div className="topbar__center">
        <div className="topbar__brand-name">Executive Performance Dashboard</div>
      </div>

      <div className="topbar__right">
        <div className="topbar__date">{dateStr}</div>
        <button className="topbar__btn topbar__btn--ghost">Export PDF</button>
        <button className="topbar__btn topbar__btn--primary" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}