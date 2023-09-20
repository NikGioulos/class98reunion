const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const multerS3 = require("multer-s3");

const { replaceWhitespacesWithDash, greekToEnglish, keepLatinOnly } = require("./tools.js");

const S3_BUCKET_NAME = "cyclic-good-bee-underclothes-us-east-2";
const S3_SERVER_NAME = `https://${S3_BUCKET_NAME}.s3.us-east-2.amazonaws.com/`;

function createStorageEngine() {
  console.log("enter createStorageEngine");
  const storage = multerS3({
    s3: s3,
    bucket: S3_BUCKET_NAME,
    key: function (req, file, cb) {
      console.log("start file upload");
      let key = `photos/${Date.now()}-${keepLatinOnly(greekToEnglish(file.originalname))}`;
      if (req.body.lastName !== undefined) {
        // Replace whitespaces with dashes in the firstName & lastName before store them
        const formattedFirstName = replaceWhitespacesWithDash(req.body.firstName);
        const formattedLastName = replaceWhitespacesWithDash(req.body.lastName);
        const participantName = `${formattedLastName}_${formattedFirstName}`;
        key = `uploads/${participantName}/${file.fieldname}`;
      }
      cb(null, key);
      console.log("end file upload:", key);
    },
  });
  return storage;
}

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
            console.log(err);
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
          console.log(err);
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

// Delete any file from S3 bucket
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
            console.log(err);
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

// List objects in the folder
function listFilesFromBucket(folder) {
  return new Promise((resolve, reject) => {
    try {
      s3.listObjectsV2(
        {
          Bucket: S3_BUCKET_NAME,
          Prefix: `${folder}/`, // Include the folder path
        },
        (err, data) => {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            resolve(data);
            console.log("bucket folder listed: " + folder);
          }
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  createStorageEngine,
  loadFileFromBucket,
  putFileOnBucket,
  deleteFileFromBucket,
  listFilesFromBucket,
};
