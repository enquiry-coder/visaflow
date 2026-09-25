const app = require("./express-app");

// Vercel serverless entrypoint. Exports a handler that Vercel invokes
// for requests routed here via vercel.json rewrites (e.g. /admin/users).
module.exports = (req, res) => {
  return app(req, res);
};
