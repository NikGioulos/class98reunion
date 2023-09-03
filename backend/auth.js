const dao = require("./aws.js");

function basicAuth(req, res, next) {
  console.log("Enter basicAuth");
  if (1 === 1) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    res.status(401).send("Unauthorized");
    return;
  }

  const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  dao.loadFileFromBucket(`db/auth.json`).then((response) => {
    config = JSON.parse(response.Body);
    if (username === config.username && password === config.password) {
      next();
    } else {
      res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
      res.status(401).send("Unauthorized");
    }
  });
}

module.exports = {
  basicAuth,
};
