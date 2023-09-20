//npm init -y && npm install express body-parser multer

const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer"); // for handling file uploads

const tools = require("./backend/tools.js");
const dao = require("./backend/aws.js");
const auth = require("./backend/auth.js");

const app = express();
const port = 3000; // You can change this to your desired port

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up static file serving for the "assets" folder
app.use("/assets", express.static(path.join(__dirname, "assets")));

// exclude the following photos from UI
const bad_photo_names = [
  "photos/1693506117124-my_profile_photo_nikosgdev.jpg",
  "photos/1693497191691-logo.jpg",
  "photos/1693497519600-logo.jpg",
  "photos/gymnasio-eisodos.jpg",
  "photos/1695196642140-",
  "photos/1695196634820-",
  "photos/1695196622942-",
  "photos/1695196533703-",
  "photos/1695203677869-",
];

// Set up file storage for multer
const upload = multer({
  storage: dao.createStorageEngine(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB (adjust the size as needed)
  },
  parts: 8, //max number of parts in multipart request
});

function logEnterEndpoint(endpoint) {
  console.log(`=== ${new Date().toLocaleString()} Enter endpoint ${endpoint}`);
}

// Endpoint to post participant registration data
app.post(
  "/api/register",
  auth.basicAuth,
  upload.fields([
    { name: "profilePhoto1998", maxCount: 1 },
    { name: "profilePhoto2023", maxCount: 1 },
  ]),
  (req, res) => {
    logEnterEndpoint(`/api/register`);
    // Process participant data here
    const { firstName, lastName, contact, attendance } = req.body;
    const pwd = "";
    let school = "";
    let seq = "";

    // Replace accents (and whitespaces with dashes) in the firstName & lastName before store them
    const formattedFirstName = tools.toComparableName(tools.replaceWhitespacesWithDash(firstName)).toUpperCase();
    const formattedLastName = tools.toComparableName(tools.replaceWhitespacesWithDash(lastName)).toUpperCase();

    if (!req.get("User-Agent")) {
      console.log("user agent not set");
      return res.status(500).json({ error: "Invalid Username" });
    }
    console.log(`UserAgent: ${req.get("User-Agent")}`);

    dao.loadFileFromBucket(`db/participants.json`).then((response) => {
      participantsDB = JSON.parse(response.Body);

      if (participantsDB.length >= 200) {
        console.log("Array size has reached the limit.");
        return res.status(500).json({ message: "Server is Full" });
      }

      const index1 = participantsDB.findIndex(
        (participant) =>
          tools.areEqualNames(participant.firstName, formattedFirstName) &&
          tools.areEqualNames(participant.lastName, formattedLastName)
      );
      if (index1 !== -1) {
        //if participant already exists
        console.log("already exists " + lastName);
        participant = participantsDB[index1];
        school = participant.school;
        seq = participant.seq;
        if (!participant.pwd || pwd === participant.pwd) {
          participantsDB.splice(index1, 1); //remove the old record
          console.log("old record removed. ready to update");
        } else {
          console.log("cannot update");
          return res.status(400).json({ message: "Participant cannot be updated" });
        }
      }

      participantsDB.push({
        seq,
        firstName: formattedFirstName,
        lastName: formattedLastName,
        contact,
        pwd,
        school,
        attendance,
      });

      tools.sortByAttribute(participantsDB, "lastName");

      // Write participants to JSON file
      dao.putFileOnBucket("db/participants.json", JSON.stringify(participantsDB, null, 2));

      console.log("registered ok " + lastName);
      if (index1 === -1) {
        res.status(201).json({ message: "Participant registered successfully" });
      } else {
        res.status(200).json({ message: "Participant updated successfully" });
      }
    });
  }
);

// Endpoint to list registered participants
app.get("/api/participants", (req, res) => {
  logEnterEndpoint(`/api/participants`);
  dao.loadFileFromBucket(`db/participants.json`).then((response) => {
    arr1 = JSON.parse(response.Body);
    tools.removePropertyFromObjects(arr1, "pwd");
    res.status(200).json(arr1);
  });
});

app.get("/api/participant-photos/:participantName/:photoName", (req, res) => {
  const { participantName, photoName } = req.params;
  logEnterEndpoint(`/api/participant-photos/${participantName}/${photoName}`);
  dao
    .loadFileFromBucket(`uploads/${participantName}/${photoName}`)
    .then((response) => {
      res.contentType("image/jpeg");
      res.send(response.Body);
    })
    .catch((error) => {
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
  dao
    .loadFileFromBucket(`db/comments.json`)
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
      res.status(500).json({ error: "Photo Comments not supported" });
    });
});

//retrieve names of recent photos from the photos bucket folder
app.get("/api/photos", (req, res) => {
  logEnterEndpoint(`===Enter Endpoint: /api/photos`);
  // List objects from 'photos' folder
  dao
    .listFilesFromBucket("photos")
    .then((result) => {
      const allPhotos = result.Contents.filter((photo) => !tools.isBadName(photo.Key, bad_photo_names));
      // sort by timestamp
      tools.sortByAttribute(allPhotos, "LastModified");
      //Reverse sorting & Filter out folders and get object keys
      const objectKeys = allPhotos
        .reverse()
        .map((item) => item.Key)
        .filter((key) => !key.endsWith("/"));

      console.log("=============object keys:", objectKeys);

      // Construct S3 URLs and send response
      const photoURLs = objectKeys.slice(0, Math.min(50, objectKeys.length)).map((key) => `api/${key}`);

      res.json({ photoURLs });
    })
    .catch((error) => {
      res.status(500).json({ error: "Error fetching photos" });
    });
});

app.get("/api/photos/:photoName", (req, res) => {
  const { photoName } = req.params;
  logEnterEndpoint(`/api/photos/${photoName}`);
  dao
    .loadFileFromBucket(`photos/${photoName}`)
    .then((result) => {
      res.contentType("image/jpeg");
      res.send(result.Body);
    })
    .catch((error) => {
      res.status(404).json({ error: "Photo not found" });
    });
});

app.post("/api/photo/add", upload.fields([{ name: "photo", maxCount: 1 }]), (req, res) => {
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
    if (!author || !message) {
      return res.status(400).json({ error: "Συντάκτης και Μήνυμα είναι υποχρεωτικά πεδία" });
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
  dao
    .loadFileFromBucket(`db/comments.json`)
    .then((response) => {
      console.log("comments json fetched");
      const comments = JSON.parse(response.Body);

      // Insert the new comment at the beginning of the array
      comments.unshift(newComment); //unshift instead of push

      // Update comments in S3
      dao
        .putFileOnBucket("db/comments.json", JSON.stringify(comments))
        .then((result) => {
          console.log("comments json updated");
          res.status(201).json(newComment);
        })
        .catch((error) => {
          res.status(500).json({ error: "Error updating comments" });
        });
    })
    .catch((error) => {
      res.status(500).json({ error: "Post Comment is not supported" });
    });
});

// Endpoint to handle GET requests to fetch comments
app.get("/api/comments", (req, res) => {
  const pageSize = parseInt(req.query.pageSize) || 100; // Default to 100 if not provided
  const pageNumber = parseInt(req.query.pageNumber) || 1; // Default to 1 if not provided
  logEnterEndpoint(`/api/comments`);
  // Read comments from S3
  dao
    .loadFileFromBucket(`db/comments.json`)
    .then((response) => {
      const comments = JSON.parse(response.Body);
      // keep only comments that are not bound to any photo
      genericComments = comments.filter((comment) => comment.photoName === undefined);

      // Calculate the starting index and ending index for the requested page
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      // Get the comments for the requested page
      const commentsForPage = genericComments.slice(startIndex, endIndex);
      res.status(200).json(commentsForPage);
    })
    .catch((error) => {
      res.status(500).json({ error: "Comments not supported" });
    });
});

//Admin Endpoints
app.get("/admin/participants", (req, res) => {
  dao
    .loadFileFromBucket("db/participants.json")
    .then((result) => {
      res.contentType("application/json");
      res.send(result.Body);
    })
    .catch((error) => {
      res.status(404).send(error);
    });
});

app.get("/admin/comments", (req, res) => {
  dao
    .loadFileFromBucket("db/comments.json")
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
  dao
    .putFileOnBucket(filename, JSON.stringify(req.body, null, 2))
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
  dao
    .deleteFileFromBucket(`photos/${photoName}`)
    .then((result) => {
      res.status(200).json({ message: `Photo ${photoName} deleted successfully.` });
    })
    .catch((error) => {
      res.status(500).json({ error: `An error occurred while deleting the photo. ${photoName}....${error}` });
    });
});

app.get("/admin/uploadedphotos", (req, res) => {
  logEnterEndpoint(`===Enter Endpoint: /admin/uploadedphotos`);
  // List objects in the 'uploads' folder
  dao
    .listFilesFromBucket("uploads")
    .then((result) => {
      const allUploadedPhotos = result.Contents.map((item) => item.Key).filter((key) => !key.endsWith("/"));
      res.json({ allUploadedPhotos });
    })
    .catch((error) => {
      res.status(500).send("Error fetching uploaded photos");
    });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
