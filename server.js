//npm init -y && npm install express body-parser multer

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer'); // for handling file uploads

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const multerS3 = require('multer-s3');
//aws.config.update({
//    secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
//    accessKeyId: 'XXXXXXXXXXXXXXX',
//    region: 'us-east-1'
//});
const S3_BUCKET_NAME='cyclic-good-bee-underclothes-us-east-2';


const app = express();
const port = 3000; // You can change this to your desired port

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up static file serving for uploaded images
app.use('/uploads', express.static('uploads'));

// Set up static file serving for the "assets" folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Set up static file serving for the "photos" folder
app.use('/photos', express.static(path.join(__dirname, 'photos')));

// Set up file storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { firstName, lastName} = req.body;
    const participantDir = path.join(__dirname, 'uploads', `${lastName}_${firstName}`);
	if (!fs.existsSync(participantDir)){
		fs.mkdirSync(participantDir, { recursive: true });
	}
    cb(null, participantDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}.jpg`);
  }
});

const upload = multer({ 
	storage: multerS3({
        s3: s3,
        bucket: S3_BUCKET_NAME,
        key: function (req, file, cb) {
			console.log('within multer_s3 key');
			const participantName = `${req.body.lastName}_${req.body.firstName}`;
			const key = `uploads/${participantName}/${file.fieldname}`;
			cb(null, key);//use Date.now() for unique file keys
			console.log('within multer_s3 key end');
        }
    }),
	limits: {
		fileSize: 5 * 1024 * 1024, // 5 MB (adjust the size as needed)
	},
	parts: 8 //max number of parts in multipart request
});

const participantsFilePath = path.join(__dirname, 'db', 'participants.json');

// Load existing participants from JSON file if it exists
let participants = [];
function loadParticipantsFromDB() {
    let s3File = s3.getObject({
      Bucket: process.env.BUCKET,
      Key: 'db/participants.json',
    }).promise();
	const participantsData = s3File.Body.toString();
	//const participantsData = fs.readFileSync(participantsFilePath, 'utf-8');
	
    participants = JSON.parse(participantsData);
	sortByAttribute(participants, "lastName");
	return participants;
}

function removePropertyFromObjects(array, propertyToRemove) {
  array.forEach(obj => {
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
app.post('/api/register', upload.fields([{ name: 'profilePhoto1998', maxCount: 1 }, { name: 'profilePhoto2023', maxCount: 1 }]), (req, res) => {
  // Process participant data here
  const { firstName, lastName, email, attendance, pwd, dummy } = req.body;
  
  console.log(`Client IP: ${req.ip}`);
  if (dummy !== 'dummy') {
	  console.log('dummy is not set');
	  return res.status(500).json({ message: 'Server is Down' });
  }
  if (participants.length >= 200) {
	console.log('Array size has reached the limit.');
	return res.status(500).json({ message: 'Server is Full' });
  }
  if (!req.get('User-Agent')) {
	console.log('user agent not set');
    return res.status(500).json({ error: 'Invalid Username'});
  }
  console.log(`UserAgent: ${req.get('User-Agent')}`);

  const index1 = participants.findIndex(participant =>
    participant.firstName === firstName && participant.lastName === lastName
  );
  if (index1 !== -1) { //if participant already exists
	console.log('already exists ' + lastName);
	participant = participants[index1];
	if (pwd === participant.pwd) {
		participants.splice(index1, 1); //remove the old record
	}else {
		console.log('cannot update');
		return res.status(400).json({ message: 'Participant cannot be updated' });
	}
  }

  participants.push({
    firstName,
    lastName,
    email,
	pwd,
    attendance
  });

  // Write participants to JSON file
  //fs.writeFileSync(participantsFilePath, JSON.stringify(participants, null, 2));
  await s3.putObject({
    Body: JSON.stringify(participants, null, 2),
    Bucket: process.env.BUCKET,
    Key: 'db/participants.json',
  }).promise()
  
  console.log('registered ok ' + lastName);
  res.status(201).json({ message: 'Participant registered successfully' });
});

// Endpoint to list registered participants
app.get('/api/participants', (req, res) => {
  arr1 = loadParticipantsFromDB();
  removePropertyFromObjects(arr1, "pwd");
  res.status(200).json(arr1);
});

app.get('/api/photos', (req, res) => {
  fs.readdir(path.join(__dirname, 'photos'), (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading photos directory' });
    }
    // Shuffle the array of photo filenames randomly
    const shuffledFiles = files.sort(() => Math.random() - 0.5);
    // Return up to 10 shuffled photo filenames
    const randomPhotos = shuffledFiles.slice(0, 10);
    res.json(randomPhotos);
  });
});

app.get('/api/participant-photos/:participantName/:photoName', (req, res) => {
  const { participantName, photoName } = req.params;
  const params = { Bucket: S3_BUCKET_NAME, Key: `uploads/${participantName}/${photoName}` };
  s3.getObject(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(404).send('Photo not found');
    }
    res.contentType('image/jpeg'); // Replace with the appropriate content type if needed
    res.send(data.Body);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
