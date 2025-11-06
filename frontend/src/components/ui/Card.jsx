export const Card = ({ className = "", children }) => (
  <div className={`ui-card ${className}`}>{children}</div>
);

export const CardHeader = ({ className = "", children }) => (
  <div className={`ui-card__header ${className}`}>{children}</div>
);

export const CardTitle = ({ className = "", children }) => (
  <h2 className={`ui-card__title ${className}`}>{children}</h2>
);

export const CardDescription = ({ className = "", children }) => (
  <p className={`ui-card__description ${className}`}>{children}</p>
);

export const CardContent = ({ className = "", children }) => (
  <div className={`ui-card__content ${className}`}>{children}</div>
);
