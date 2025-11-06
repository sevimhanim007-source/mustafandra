export const Badge = ({ variant = "neutral", className = "", children }) => (
  <span className={`ui-badge ui-badge--${variant} ${className}`}>{children}</span>
);
