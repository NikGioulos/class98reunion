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
        const participantName = `${req.body.lastName}_${req.body.firstName}`;
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

// Load existing participants from JSON file if it exists
let participants = [];
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

function removePropertyFromObjects(array, propertyToRemove) {
  array.forEach((obj) => {
    if (obj.hasOwnProperty(propertyToRemove)) {
      delete obj[propertyToRemove];
    }
  });
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
    const { firstNameRaw, lastNameRaw, email, attendance, pwd, dummy } = req.body;

    // Replace whitespaces with dashes in the firstName & lastName before store them
    const firstName = firstNameRaw.replace(/\s+/g, "-");
    const lastName = lastNameRaw.replace(/\s+/g, "-");

    if (dummy !== "dummy") {
      console.log("dummy is not set");
      return res.status(500).json({ message: "Server is Down" });
    }
    if (participants.length >= 200) {
      console.log("Array size has reached the limit.");
      return res.status(500).json({ message: "Server is Full" });
    }
    if (!req.get("User-Agent")) {
      console.log("user agent not set");
      return res.status(500).json({ error: "Invalid Username" });
    }
    console.log(`UserAgent: ${req.get("User-Agent")}`);

    const index1 = participants.findIndex(
      (participant) => participant.firstName === firstName && participant.lastName === lastName
    );
    if (index1 !== -1) {
      //if participant already exists
      console.log("already exists " + lastName);
      participant = participants[index1];
      if (pwd === participant.pwd) {
        participants.splice(index1, 1); //remove the old record
        console.log("old record removed. ready to update");
      } else {
        console.log("cannot update");
        return res.status(400).json({ message: "Participant cannot be updated" });
      }
    }

    participants.push({
      firstName,
      lastName,
      email,
      pwd,
      attendance,
    });

    // Write participants to JSON file
    s3.putObject({
      Body: JSON.stringify(participants, null, 2),
      Bucket: S3_BUCKET_NAME,
      Key: "db/participants.json",
    }).promise();

    console.log("registered ok " + lastName);
    res.status(201).json({ message: "Participant registered successfully" });
  }
);

// Endpoint to list registered participants
app.get("/api/participants", (req, res) => {
  loadFileFromBucket(`db/participants.json`).then((response) => {
    arr1 = JSON.parse(response.Body);
    participants = arr1.slice();
    removePropertyFromObjects(arr1, "pwd");
    sortByAttribute(arr1, "lastName");
    res.status(200).json(arr1);
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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
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

app.put("/admin/participants/", (req, res) => {
  const participants = req.body;
  s3.putObject(
    {
      Bucket: S3_BUCKET_NAME,
      Key: "db/participants.json",
      Body: JSON.stringify(participants, null, 2),
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

app.get("/admin/reset", (req, res) => {
  s3.upload(
    {
      Bucket: S3_BUCKET_NAME,
      Key: "db/participants.json",
      Body: JSON.stringify([]),
      ContentType: "application/json",
    },
    (err, data) => {
      if (err) {
        console.log(`Error::: ${err}`);
      } else {
        console.log(`File uploaded successfully. ${data.Location}`);
      }
    }
  );

  return res.status(200).json({ message: "okokok" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
