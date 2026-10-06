/** Wrap async controllers/services so rejections reach the error middleware. */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/** Wrap every async function in a controller's exports object (in place). */
module.exports.wrapAll = function wrapAll(controllers) {
  const wrap = module.exports;
  for (const key of Object.keys(controllers)) {
    if (typeof controllers[key] === 'function') {
      controllers[key] = wrap(controllers[key]);
    }
  }
  return controllers;
};
