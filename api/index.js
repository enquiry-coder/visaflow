// Standalone entrypoint for the API container. The platform launches
// `node index.js`; this starts the Express app from express-app.js as a
// long-running server (for local/preview), whereas vercel.js re-exports the
// same app as a serverless handler for Vercel.
const app = require("./express-app");
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
