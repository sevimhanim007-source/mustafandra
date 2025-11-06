export const Select = ({ className = "", children, ...props }) => (
  <select className={`ui-select ${className}`} {...props}>
    {children}
  </select>
);

export const SelectOption = ({ value, children }) => (
  <option value={value}>{children}</option>
);
