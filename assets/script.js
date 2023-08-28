function getClassNameForAttendance(attendance) {
	if (attendance === "Yes") {
      return "status-icon attend";
    } else if (attendance === "No") {
      return "status-icon miss";
    } else {
      return "status-icon question";
    }
}

function createParticipantListItem(participant, index) {
	const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#participant-${index}`;
    link.textContent = `${participant.lastName} ${participant.firstName}`;
    
    // Add icons based on the participant's status
    const icon = document.createElement("span");
    icon.className = getClassNameForAttendance(participant.attendance);
    link.appendChild(icon);

    li.appendChild(link);
	return li;
}

// Function to refresh the participant list
function refreshParticipantList() {
  fetch('/api/participants')
    .then(response => response.json())
    .then(participantsResp => {
	  participants = participantsResp;
      // Clear existing list
      participantList.innerHTML = '';

      participants.forEach((participant, index) => {
        // Create and append participant list items
        const listItem = createParticipantListItem(participant, index);
        participantList.appendChild(listItem);
      }); 
    })
    .catch(error => {
      console.error('Error fetching participants:', error);
    });
}

function findParticipantByName(participantsArray, lastName, firstName) {
  return participantsArray.find(p => p.firstName === firstName && p.lastName === lastName);
}

function showParticipantDetails(participant) {
  // Clear existing content
  participantDetailsContainer.innerHTML = '';

  // Create elements for participant details
  const nameElement = document.createElement('h3');
  nameElement.textContent = `${participant.lastName} ${participant.firstName}`;

  const emailElement = document.createElement('p');
  emailElement.textContent = `Email: ${participant.email}`;

  const attendanceElement = document.createElement('p');
  attendanceElement.textContent = `Attendance?:`;
  
  const icon = document.createElement("span");
  icon.className = getClassNameForAttendance(participant.attendance);
  attendanceElement.appendChild(icon);

  // Append elements to container
  participantDetailsContainer.appendChild(nameElement);
  participantDetailsContainer.appendChild(emailElement);
  participantDetailsContainer.appendChild(attendanceElement);


  const s3PhotoURL = (photoName) => `/api/participant-photos/${participant.lastName}_${participant.firstName}/${photoName}`;
  //`/uploads/${participant.lastName}_${participant.firstName}/profilePhoto2023.jpg`

  // Create image elements for the participant's photos
  const photo1998 = document.createElement('img');
  photo1998.src = s3PhotoURL(`profilePhoto1998`);
  photo1998.title='1998';
  
  const photo2023 = document.createElement('img');
  photo2023.src = s3PhotoURL(`profilePhoto2023`);
  photo2023.title='2023';

  // Append photo elements to container
  participantDetailsContainer.appendChild(photo1998);
  participantDetailsContainer.appendChild(photo2023);
}


// Function to filter and refresh participant list
function filterParticipants(searchText) {
  const filteredParticipants = participants.filter(participant =>
    participant.firstName.toLowerCase().includes(searchText.toLowerCase()) ||
    participant.lastName.toLowerCase().includes(searchText.toLowerCase())
  );

  participantList.innerHTML = ""; // Clear existing list
  filteredParticipants.forEach((participant, index) => {
    const li = createParticipantListItem(participant, index);
    participantList.appendChild(li);
  });
}

function formatWithLeadingZero(value) {
  return value < 10 ? `0${value}` : value;
}

// Function to calculate and update countdown timer
function updateCountdown() {
  const countdownElement = document.getElementById("countdownTimer");
  const targetDate = new Date(document.getElementById("targetDatetime").value);
  const now = new Date();

  const timeDifference = targetDate - now;
  if (timeDifference <= 0) {
    countdownElement.innerHTML = "Reunion has started!";
  } else {
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

    const formattedDays = formatWithLeadingZero(days);
    const formattedHours = formatWithLeadingZero(hours);
    const formattedMinutes = formatWithLeadingZero(minutes);
    const formattedSeconds = formatWithLeadingZero(seconds);

    const countdownHtml = `
      <div class="countdown-text">
        Reunion Date: ${targetDate.toLocaleString('en-GB', { timeZone: 'Europe/Zurich' })}
      </div>
      <div class="countdown-row">
        <div class="countdown-block">${formattedDays}</div>
        <div class="countdown-block">${formattedHours}</div>
        <div class="countdown-block">${formattedMinutes}</div>
        <div class="countdown-block">${formattedSeconds}</div>
      </div>
      <div class="countdown-row">
        <div class="countdown-period">days</div>
        <div class="countdown-period">hrs</div>
        <div class="countdown-period">mins</div>
        <div class="countdown-period">secs</div>
      </div>
    `;

    countdownElement.innerHTML = countdownHtml;
  }
}


function fetchAndDisplayPhotos() {
  fetch('/api/photos')
    .then(response => response.json())
    .then(photos => {
      photoFilenames = photos;
      showNextPhoto();
    })
    .catch(error => {
      console.error('Error fetching photos:', error);
    });
}
function showPhoto(index) {
  if (index >= 0 && index < photoFilenames.length) {
    currentPhoto.src = `/photos/${photoFilenames[index]}`;
    currentPhotoIndex = index;
  }
  updateNavigationButtons();
}
function showNextPhoto() {
  showPhoto(currentPhotoIndex + 1);
}
function showPrevPhoto() {
  showPhoto(currentPhotoIndex - 1);
}
function updateNavigationButtons() {
  prevPhotoBtn.disabled = currentPhotoIndex === 0;
  nextPhotoBtn.disabled = currentPhotoIndex === photoFilenames.length - 1;
}


// Populate participant list
const participantList = document.getElementById("participantList");
const participantDetails = document.getElementById("participantDetails");
const participantDetailsContainer = document.querySelector('.participant-details-container');
participantList.addEventListener("click", function(event) {
  event.preventDefault();
  if (event.target.tagName === "A") {
	const lName = event.target.textContent.split(" ")[0];
	const fName = event.target.textContent.split(" ")[1];
	showParticipantDetails(findParticipantByName(participants, lName, fName));
  }
});


// Attach event listener to the search input
const searchInput = document.getElementById("search");
searchInput.addEventListener("input", function() {
  filterParticipants(searchInput.value);
});


// Registration form submission
const registrationForm = document.getElementById("registrationForm");
registrationForm.addEventListener("submit", function (event) {
  event.preventDefault();
  
  document.getElementById("dummy").value='dummy';
  const formData = new FormData(registrationForm);
  fetch('/api/register', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
	  console.log(data.message); // Output the server response message
	  refreshParticipantList(); // Refresh the participants list
	  // Clear the form fields (if needed)
	  registrationForm.reset();
  })
  .catch(error => {
	  console.error('Error registering participant:', error);
  });

  // Clear form fields
  registrationForm.reset();
});


// on load
let participants = []; //participantsSample
refreshParticipantList(); 

const currentPhoto = document.getElementById('current-photo');
const prevPhotoBtn = document.getElementById('prev-photo-btn');
const nextPhotoBtn = document.getElementById('next-photo-btn');
prevPhotoBtn.addEventListener('click', showPrevPhoto);
nextPhotoBtn.addEventListener('click', showNextPhoto);
let currentPhotoIndex = -1;
let photoFilenames = [];
fetchAndDisplayPhotos(); // load photos when the page loads

// Call the updateCountdown function initially
updateCountdown();

// Call the updateCountdown function every second
setInterval(updateCountdown, 1000);
