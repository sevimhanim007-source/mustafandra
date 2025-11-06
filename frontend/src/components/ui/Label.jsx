export const Label = ({ htmlFor, className = "", children }) => (
  <label htmlFor={htmlFor} className={`ui-label ${className}`}>
    {children}
  </label>
);
