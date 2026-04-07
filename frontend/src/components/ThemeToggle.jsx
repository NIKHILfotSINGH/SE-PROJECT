import React from "react";
import { useTheme } from "../theme/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "light" ? "Dark mode" : "Light mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn"
      style={{ width: "auto", padding: "8px 12px", minWidth: 110 }}
      aria-label={`Switch to ${nextLabel}`}
    >
      {nextLabel}
    </button>
  );
}