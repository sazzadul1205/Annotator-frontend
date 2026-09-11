
export function getErrorMessage(err) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    "Something went wrong"
  );
}