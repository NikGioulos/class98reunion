//npm init -y && npm install express body-parser multer

const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer"); // for handling file uploads

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const multerS3 = require("multer-s3");
const S3_BUCKET_NAME = "cyclic-good-bee-underclothes-us-east-2";
const S3_SERVER_NAME = `https://${S3_BUCKET_NAME}.s3.us-east-2.amazonaws.com/`;

const app = express();
const port = 3000; // You can change this to your desired port

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up static file serving for the "assets" folder
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Set up file storage for multer
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_BUCKET_NAME,
    key: function (req, file, cb) {
      console.log("start file upload");
      let key = `photos/${file.originalname}`;
      if (req.body.lastName !== undefined) {
        // Replace whitespaces with dashes in the firstName & lastName before store them
        const formattedFirstName = replaceWhitespacesWithDash(req.body.firstName);
        const formattedLastName = replaceWhitespacesWithDash(req.body.lastName);
        const participantName = `${formattedLastName}_${formattedFirstName}`;
        key = `uploads/${participantName}/${file.fieldname}`;
      }
      cb(null, key); //use Date.now() for unique file keys
      console.log("end file upload:", key);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB (adjust the size as needed)
  },
  parts: 8, //max number of parts in multipart request
});

// Load any file from S3 Bucket
function loadFileFromBucket(filename) {
  return new Promise((resolve, reject) => {
    try {
      s3.getObject(
        {
          Bucket: S3_BUCKET_NAME,
          Key: filename,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            console.log("bucket file loaded");
            resolve(data);
          }
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

// Put any file on S3 Bucket
function putFileOnBucket(filename, body) {
  return new Promise((resolve, reject) => {
    try {
      const putObjectParams = { Bucket: S3_BUCKET_NAME, Key: filename, Body: body };
      s3.putObject(putObjectParams, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("bucket file placed");
          resolve(body);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function removePropertyFromObjects(array, propertyToRemove) {
  array.forEach((obj) => {
    if (obj.hasOwnProperty(propertyToRemove)) {
      delete obj[propertyToRemove];
    }
  });
}

function replaceWhitespacesWithDash(text) {
  return text.replace(/\s+/g, "-");
}

function sortByAttribute(array, attribute) {
  array.sort((a, b) => {
    const aa = a[attribute].toLowerCase();
    const bb = b[attribute].toLowerCase();
    if (aa < bb) {
      return -1;
    }
    if (aa > bb) {
      return 1;
    }
    return 0;
  });
}

// Endpoint to post participant registration data
app.post(
  "/api/register",
  upload.fields([
    { name: "profilePhoto1998", maxCount: 1 },
    { name: "profilePhoto2023", maxCount: 1 },
  ]),
  (req, res) => {
    // Process participant data here
    const { firstName, lastName, email, attendance, pwd } = req.body;

    // Replace whitespaces with dashes in the firstName & lastName before store them
    const formattedFirstName = replaceWhitespacesWithDash(firstName);
    const formattedLastName = replaceWhitespacesWithDash(lastName);

    if (!req.get("User-Agent")) {
      console.log("user agent not set");
      return res.status(500).json({ error: "Invalid Username" });
    }
    console.log(`UserAgent: ${req.get("User-Agent")}`);

    loadFileFromBucket(`db/participants.json`).then((response) => {
      participantsDB = JSON.parse(response.Body);

      if (participantsDB.length >= 200) {
        console.log("Array size has reached the limit.");
        return res.status(500).json({ message: "Server is Full" });
      }

      const index1 = participantsDB.findIndex(
        (participant) => participant.firstName === formattedFirstName && participant.lastName === formattedLastName
      );
      if (index1 !== -1) {
        //if participant already exists
        console.log("already exists " + lastName);
        participant = participantsDB[index1];
        if (pwd === participant.pwd) {
          participantsDB.splice(index1, 1); //remove the old record
          console.log("old record removed. ready to update");
        } else {
          console.log("cannot update");
          return res.status(400).json({ message: "Participant cannot be updated" });
        }
      }

      participantsDB.push({
        firstName: formattedFirstName,
        lastName: formattedLastName,
        email,
        pwd,
        attendance,
      });

      sortByAttribute(participantsDB, "lastName");

      // Write participants to JSON file
      s3.putObject({
        Body: JSON.stringify(participantsDB, null, 2),
        Bucket: S3_BUCKET_NAME,
        Key: "db/participants.json",
      }).promise();

      console.log("registered ok " + lastName);
      res.status(201).json({ message: "Participant registered successfully" });
    });
  }
);

// Endpoint to list registered participants
app.get("/api/participants", (req, res) => {
  loadFileFromBucket(`db/participants.json`).then((response) => {
    arr1 = JSON.parse(response.Body);
    removePropertyFromObjects(arr1, "pwd");
    res.status(200).json(arr1);
  });
});

app.get("/api/participant-photos/:participantName/:photoName", (req, res) => {
  const { participantName, photoName } = req.params;
  const params = { Bucket: S3_BUCKET_NAME, Key: `uploads/${participantName}/${photoName}` };
  s3.getObject(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(404).send("Photo not found");
    }
    res.contentType("image/jpeg"); // Replace with the appropriate content type if needed
    res.send(data.Body);
  });
});

//retrieve 10 random photoNames from the photos bucket folder
app.get("/api/photos", (req, res) => {
  // List objects in the folder
  const maxPhotos = 10;
  const listParams = {
    Bucket: S3_BUCKET_NAME,
    Prefix: `photos/`, // Include the folder path
  };

  s3.listObjectsV2(listParams, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error fetching photos");
    }

    // Filter out folders and get object keys
    const objectKeys = data.Contents.map((item) => item.Key).filter((key) => !key.endsWith("/"));

    // Get random photo keys
    const randomPhotoKeys = [];
    while (randomPhotoKeys.length < maxPhotos && objectKeys.length > 0) {
      const randomIndex = Math.floor(Math.random() * objectKeys.length);
      randomPhotoKeys.push(objectKeys.splice(randomIndex, 1)[0]);
    }

    // Construct S3 URLs and send response
    const photoURLs = randomPhotoKeys.map((key) => `api/${key}`);

    res.json({ photoURLs });
  });
});

app.get("/api/photos/:photoName", (req, res) => {
  const { photoName } = req.params;
  console.log("PhotoName is:", photoName);
  const params = { Bucket: S3_BUCKET_NAME, Key: `photos/${photoName}` };
  s3.getObject(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(404).send("Photo not found");
    }
    res.contentType("image/jpeg"); // Replace with the appropriate content type if needed
    res.send(data.Body);
  });
});

app.post("/api/photo/add", upload.fields([{ name: "photo", maxCount: 1 }]), (req, res) => {
  return res.status(200).json({ message: "photo uploaded" });
});

//Admin Endpoints
app.get("/admin/participants", (req, res) => {
  const params = { Bucket: S3_BUCKET_NAME, Key: "db/participants.json" };
  s3.getObject(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(404).send("json not found");
    }
    res.contentType("application/json");
    res.send(data.Body);
  });
});

app.put("/admin/participants", (req, res) => {
  s3.putObject(
    {
      Bucket: S3_BUCKET_NAME,
      Key: "db/participants.json",
      Body: JSON.stringify(req.body, null, 2),
    },
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error updating participants file");
      }
      res.status(200).send("Participants file updated successfully");
    }
  );
});

app.put("/admin/auth", (req, res) => {
  putFileOnBucket("db/auth.json", JSON.stringify(req.body, null, 2))
    .then((result) => {
      res.status(200).send("Auth file updated successfully");
    })
    .catch((error) => {
      res.status(500).send("Error updating Auth file");
    });
});

// Basic authentication middleware
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    res.status(401).send("Unauthorized");
    return;
  }

  const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  loadFileFromBucket(`db/auth.json`).then((response) => {
    config = JSON.parse(response.Body);
    if (username === config.username && password === config.password) {
      next();
    } else {
      res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
      res.status(401).send("Unauthorized");
    }
  });
};

app.get("/", basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
