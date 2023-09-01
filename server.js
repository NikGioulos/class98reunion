//npm init -y && npm install express body-parser multer

const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer"); // for handling file uploads

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const multerS3 = require("multer-s3");
const { error } = require("console");
const S3_BUCKET_NAME = "cyclic-good-bee-underclothes-us-east-2";
const S3_SERVER_NAME = `https://${S3_BUCKET_NAME}.s3.us-east-2.amazonaws.com/`;

const app = express();
const port = 3000; // You can change this to your desired port

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up static file serving for the "assets" folder
app.use("/assets", express.static(path.join(__dirname, "assets")));

// exclude the following photos from UI
const bad_photo_names = ["photos/1693506117124-my_profile_photo_nikosgdev.jpg", "photos/1693497191691-logo.jpg"];

// Set up file storage for multer
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_BUCKET_NAME,
    key: function (req, file, cb) {
      console.log("start file upload");
      let key = `photos/${Date.now()}-${file.originalname}`;
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
            console.log("bucket file loaded: " + filename);
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

function deleteFileFromBucket(filename) {
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
            resolve(data);
            console.log("bucket file deleted: " + filename);
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

function replaceWhitespacesWithDash(text) {
  return text.replace(/\s+/g, "-");
}

function sortByAttribute(arr, attribute) {
  return arr.sort((a, b) => {
    const valueA = a[attribute];
    const valueB = b[attribute];

    if (typeof valueA === "string" && typeof valueB === "string") {
      return valueA.localeCompare(valueB, undefined, { sensitivity: "base" });
    } else {
      return valueA - valueB;
    }
  });
}

function logEnterEndpoint(endpoint) {
  console.log(`=== ${new Date()} Enter endpoint ${endpoint}`);
}

// Endpoint to post participant registration data
app.post(
  "/api/register",
  upload.fields([
    { name: "profilePhoto1998", maxCount: 1 },
    { name: "profilePhoto2023", maxCount: 1 },
  ]),
  (req, res) => {
    logEnterEndpoint(`/api/register ${req.socket.remoteAddress}`);
    // Process participant data here
    const { firstName, lastName, contact, attendance } = req.body;
    const pwd = "";

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
        contact,
        pwd,
        attendance,
      });

      sortByAttribute(participantsDB, "lastName");

      // Write participants to JSON file
      putFileOnBucket("db/participants.json", JSON.stringify(participantsDB, null, 2));

      console.log("registered ok " + lastName);
      res.status(201).json({ message: "Participant registered successfully" });
    });
  }
);

// Endpoint to list registered participants
app.get("/api/participants", (req, res) => {
  logEnterEndpoint(`/api/participants`);
  loadFileFromBucket(`db/participants.json`).then((response) => {
    arr1 = JSON.parse(response.Body);
    removePropertyFromObjects(arr1, "pwd");
    res.status(200).json(arr1);
  });
});

app.get("/api/participant-photos/:participantName/:photoName", (req, res) => {
  const { participantName, photoName } = req.params;
  logEnterEndpoint(`/api/participant-photos/${participantName}/${photoName}`);
  loadFileFromBucket(`uploads/${participantName}/${photoName}`)
    .then((result) => {
      res.contentType("image/jpeg");
      res.send(result.Body);
    })
    .catch((error) => {
      console.log(error);
      res.status(404).send("Photo not found");
    });
});

// Endpoint to handle GET comments for given photo
app.get("/api/photos/:photoName/comments", (req, res) => {
  const { photoName } = req.params;
  logEnterEndpoint(`/api/photos/${photoName}/comments`);

  const pageSize = parseInt(req.query.pageSize) || 10;
  const pageNumber = parseInt(req.query.pageNumber) || 1; // Default to 1 if not provided

  // Read comments from S3
  loadFileFromBucket(`db/comments.json`)
    .then((response) => {
      const comments = JSON.parse(response.Body);

      console.log("all comments size = ", comments.length);

      //keep only comments for specific photo
      const photoComments = comments.filter((comment) => `/photos/${photoName}` === comment.photoName);

      console.log("photo-specific comments size = ", photoComments.length);

      // Calculate the starting index and ending index for the requested page
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      // Get the comments for the requested page
      const commentsForPage = photoComments.slice(startIndex, endIndex);
      res.status(200).json(commentsForPage);
    })
    .catch((error) => {
      res.status(500).send("Photo Comments not supported");
    });
});

//retrieve names of recent photos from the photos bucket folder
app.get("/api/photos", (req, res) => {
  logEnterEndpoint(`===Enter Endpoint: /api/photos`);
  // List objects in the folder
  const listParams = {
    Bucket: S3_BUCKET_NAME,
    Prefix: `photos/`, // Include the folder path
  };

  s3.listObjectsV2(listParams, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error fetching photos");
    }

    const allPhotos = data.Contents.filter((photo) => !bad_photo_names.includes(photo.Key));
    // sort by timestamp
    sortByAttribute(allPhotos, "LastModified");
    //Reverse sorting & Filter out folders and get object keys
    const objectKeys = allPhotos
      .reverse()
      .map((item) => item.Key)
      .filter((key) => !key.endsWith("/"));

    console.log("=============object keys:", objectKeys);

    // Construct S3 URLs and send response
    const photoURLs = objectKeys.slice(0, Math.min(50, objectKeys.length)).map((key) => `api/${key}`);

    res.json({ photoURLs });
  });
});

app.get("/api/photos/:photoName", (req, res) => {
  const { photoName } = req.params;
  logEnterEndpoint(`/api/photos/${photoName}`);
  loadFileFromBucket(`photos/${photoName}`)
    .then((result) => {
      res.contentType("image/jpeg");
      res.send(result.Body);
    })
    .catch((error) => {
      console.log(error);
      res.status(404).send("Photo not found");
    });
});

app.post("/api/photo/add", upload.fields([{ name: "photo", maxCount: 1 }]), (req, res) => {
  //console.log("Uploaded file name:", req.file.originalname);
  logEnterEndpoint(`/api/photo/add ${req.socket.remoteAddress}`);
  return res.status(200).json({ message: "photo uploaded" });
});

// Endpoint to handle POST requests to add comments
app.post("/api/comments", (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const message = req.body.message;
  const photoName = req.body.photoName;

  logEnterEndpoint(`/api/comments`);

  if (!photoName) {
    if (!title || !author || !message) {
      return res.status(400).json({ error: "Title, author, and message are required" });
    }
  }

  const newComment = {
    title,
    author,
    message,
    photoName,
    timestamp: new Date().toISOString(),
  };

  console.log("new-comment", newComment);

  //fetch existing comments from S3
  loadFileFromBucket(`db/comments.json`)
    .then((response) => {
      console.log("comments json fetched");
      const comments = JSON.parse(response.Body);

      // Insert the new comment at the beginning of the array
      comments.unshift(newComment); //unshift instead of push

      // Update comments in S3
      putFileOnBucket("db/comments.json", JSON.stringify(comments))
        .then((result) => {
          console.log("comments json updated");
          res.status(201).json(newComment);
        })
        .catch((error) => {
          res.status(500).json({ error: "Error updating comments" });
        });
    })
    .catch((error) => {
      res.status(500).json({ error: "Comments not supported" });
    });
});

// Endpoint to handle GET requests to fetch comments
app.get("/api/comments", (req, res) => {
  const pageSize = parseInt(req.query.pageSize) || 10; // Default to 20 if not provided
  const pageNumber = parseInt(req.query.pageNumber) || 1; // Default to 1 if not provided

  logEnterEndpoint(`/api/comments`);

  // Read comments from S3
  loadFileFromBucket(`db/comments.json`)
    .then((response) => {
      const comments = JSON.parse(response.Body);

      // keep only comments that are not bound to any photo
      genericComments = comments.filter((comment) => comment.photoName === undefined);

      // Calculate the starting index and ending index for the requested page
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      // Get the comments for the requested page
      const commentsForPage = genericComments.slice(startIndex, endIndex);
      res.json(commentsForPage);
    })
    .catch((error) => {
      res.status(500).send("Comments not supported");
    });
});

//Admin Endpoints
app.get("/admin/participants", (req, res) => {
  loadFileFromBucket("db/participants.json")
    .then((result) => {
      res.contentType("application/json");
      res.send(result.Body);
    })
    .catch((error) => {
      res.status(404).send(error);
    });
});

app.get("/admin/comments", (req, res) => {
  loadFileFromBucket("db/comments.json")
    .then((result) => {
      res.contentType("application/json");
      res.send(result.Body);
    })
    .catch((error) => {
      res.status(404).send(error);
    });
});

// init any json file (eg participants, comments, auth)
app.put("/admin/init/json", (req, res) => {
  const filename = req.query.filename;
  console.log(`===Enter Endpoint: /admin/init/json ${req.socket.remoteAddress}`);
  putFileOnBucket(filename, JSON.stringify(req.body, null, 2))
    .then((result) => {
      res.status(200).send(`${filename} file initialized successfully`);
    })
    .catch((error) => {
      res.status(500).send(`Error initializing ${filename} file`);
    });
});

app.delete("/admin/photos/:photoName", (req, res) => {
  const photoName = req.params.photoName;
  console.log(`===Enter Endpoint: /admin/photos/${photoName} ${req.socket.remoteAddress}`);
  deleteFileFromBucket(`photos/${photoName}`)
    .then((result) => {
      res.status(200).json({ message: `Photo ${photoName} deleted successfully.` });
    })
    .catch((error) => {
      res.status(500).json({ error: `An error occurred while deleting the photo. ${photoName}....${error}` });
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
