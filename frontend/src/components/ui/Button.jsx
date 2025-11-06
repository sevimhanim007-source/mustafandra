export const Button = ({
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
  children,
  ...props
}) => (
  <button
    type={type}
    disabled={disabled}
    className={`ui-button ui-button--${variant} ${disabled ? "is-disabled" : ""} ${className}`}
    {...props}
  >
    {children}
  </button>
);
