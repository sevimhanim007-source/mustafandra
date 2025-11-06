const createFormatter = (options) => {
  try {
    return new Intl.DateTimeFormat("tr-TR", options);
  } catch (_error) {
    return null;
  }
};

const dateFormatter = createFormatter({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = createFormatter({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  try {
    const date = new Date(value);
    return dateFormatter ? dateFormatter.format(date) : date.toISOString();
  } catch (_error) {
    return String(value);
  }
};

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  try {
    const date = new Date(value);
    return dateTimeFormatter ? dateTimeFormatter.format(date) : date.toISOString();
  } catch (_error) {
    return String(value);
  }
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0";
  }
  return new Intl.NumberFormat("tr-TR").format(Number(value));
};
