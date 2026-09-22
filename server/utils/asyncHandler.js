const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    // Returning the promise (not just firing it) lets callers await a wrapped
    // handler directly — Express itself ignores the return value, so this is
    // a no-op for normal request handling, but it makes handlers composable
    // and testable without going through a real HTTP request.
    return Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export default asyncHandler;