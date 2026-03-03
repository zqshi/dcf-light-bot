const {
  buildBaseRequestContext,
  runWithRequestContext
} = require('../../../shared/requestContext');

function buildRequestContextMiddleware() {
  return (req, res, next) => {
    const base = buildBaseRequestContext(req.headers || {});
    req.requestContext = base;
    runWithRequestContext(base, () => next());
  };
}

module.exports = { buildRequestContextMiddleware };
