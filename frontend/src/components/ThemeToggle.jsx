import React from "react";
import { useTheme } from "../theme/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "light" ? "Dark mode" : "Light mode";
  const icon = theme === "light" ? "☾" : "☀";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-slate"
      style={{ width: "auto", padding: "8px 12px", minWidth: 44 }}
      aria-label={`Switch to ${nextLabel}`}
      title={nextLabel}
    >
      {icon}
    </button>
  );
}