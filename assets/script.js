function adjustIframeHeight() {
  const windowHeight = (window.innerHeight || document.documentElement.clientHeight) / 2;
  iframe.style.height = `${windowHeight}px`;
}

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
  fetch("/api/participants")
    .then((response) => response.json())
    .then((participantsDB) => {
      participants = participantsDB;
      // Clear existing list
      participantList.innerHTML = "";

      participants.forEach((participant, index) => {
        // Create and append participant list items
        const listItem = createParticipantListItem(participant, index);
        participantList.appendChild(listItem);
      });
    })
    .catch((error) => {
      console.error("Error fetching participants:", error);
    });
}

function findParticipantByName(participantsArray, lastName, firstName) {
  return participantsArray.find((p) => p.firstName === firstName && p.lastName === lastName);
}

function showParticipantDetails(participant) {
  // Clear existing content
  participantDetailsContainer.innerHTML = "";

  // Create elements for participant details
  const nameElement = document.createElement("h3");
  nameElement.textContent = `${participant.lastName} ${participant.firstName}`;

  const emailElement = document.createElement("p");
  emailElement.textContent = `Email: ${participant.email}`;

  const attendanceElement = document.createElement("p");
  attendanceElement.textContent = `Παρουσία?:`;

  const icon = document.createElement("span");
  icon.className = getClassNameForAttendance(participant.attendance);
  attendanceElement.appendChild(icon);

  // Append elements to container
  participantDetailsContainer.appendChild(nameElement);
  participantDetailsContainer.appendChild(emailElement);
  participantDetailsContainer.appendChild(attendanceElement);

  const s3PhotoURL = (photoName) =>
    `/api/participant-photos/${participant.lastName}_${participant.firstName}/${photoName}`;

  // Create image elements for the participant's photos
  const photo1998 = document.createElement("img");
  photo1998.src = s3PhotoURL(`profilePhoto1998`);
  photo1998.alt = "1998 photo is missing";
  photo1998.title = "1998";

  const photo2023 = document.createElement("img");
  photo2023.src = s3PhotoURL(`profilePhoto2023`);
  photo2023.alt = "2023 photo is missing";
  photo2023.title = "2023";

  // Append photo elements to container
  participantDetailsContainer.appendChild(photo1998);
  participantDetailsContainer.appendChild(photo2023);
}

// Function to filter and refresh participant list
function filterParticipants(searchText) {
  const filteredParticipants = participants.filter(
    (participant) =>
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
    countdownElement.innerHTML = "Η Συνάντηση ξεκίνησε!!";
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
        ${targetDate.toLocaleString("en-GB", { timeZone: "Europe/Zurich" })}
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
  fetch("/api/photos")
    .then((response) => response.json())
    .then((data) => {
      photoFilenames = data.photoURLs;
      showNextPhoto();
      startAutoChange(); // Start auto-changing photos
    })
    .catch((error) => {
      console.error("Error fetching photos:", error);
    });
}
function showPhoto(index) {
  if (index >= 0 && index < photoFilenames.length) {
    currentPhoto.src = `${photoFilenames[index]}`;
    currentPhoto.alt = "generic photo";
    currentPhotoIndex = index;
    refreshPhotoCommentsList(`${photoFilenames[index]}`);
  }
  updateNavigationButtons();
}
function showNextPhoto() {
  const nextIndex = (currentPhotoIndex + 1) % photoFilenames.length;
  showPhoto(nextIndex);
}
function showPrevPhoto() {
  const nextIndex = (currentPhotoIndex - 1) % photoFilenames.length;
  showPhoto(nextIndex);
}
function updateNavigationButtons() {
  prevPhotoBtn.disabled = currentPhotoIndex === 0;
  nextPhotoBtn.disabled = currentPhotoIndex === photoFilenames.length - 1;
}

let autoChangeInterval; // Variable to hold the interval ID
function startAutoChange() {
  //autoChangeInterval = setInterval(showNextPhoto, 5000); // Change photo every 5 seconds
}
function stopAutoChange() {
  clearInterval(autoChangeInterval);
}

function submitComment(event) {
  event.preventDefault();

  const title = document.getElementById("title").value;
  const author = document.getElementById("author").value;
  const message = document.getElementById("message").value;

  const comment = { title, author, message };

  fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comment),
  })
    .then((response) => response.json())
    .then((newComment) => {
      console.log(newComment);
      refreshCommentsList();
      commentForm.reset();
    })
    .catch((error) => {
      console.error("Error submitting comment:", error);
    });
}
function submitPhotoComment(event) {
  event.preventDefault();

  const message = document.getElementById("photo-message").value;
  const photoName = "/" + currentPhoto.src.split("/api/")[1];

  const comment = { message, photoName };

  fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comment),
  })
    .then((response) => response.json())
    .then((newComment) => {
      console.log(newComment);
      refreshPhotoCommentsList(`/api${photoName}`);
      document.getElementById("photo-message").value = "";
    })
    .catch((error) => {
      console.error("Error submitting comment:", error);
    });
}
function plainTextToHtml(plainText) {
  // Replace newlines with <br> tags
  let formattedText = plainText.replace(/\n/g, "<br>");

  // Convert URLs to clickable links
  const linkPattern = /https?:\/\/\S+/g;
  formattedText = formattedText.replace(linkPattern, (match) => {
    return `<a href="${match}" target="_blank">${match}</a>`;
  });

  return formattedText;
}
function createCommentElement(comment) {
  const commentElement = document.createElement("div");
  commentElement.classList.add("comment");
  if (comment.author === undefined) {
    commentElement.innerHTML = `
      <p>${plainTextToHtml(comment.message)}</p>
      <p><em>Ημερομηνία: ${new Date(comment.timestamp).toLocaleString()}</em></p>
    `;
  } else {
    commentElement.innerHTML = `
      <h3>${comment.title}</h3>
      <p><strong>Συντάκτης:</strong> ${comment.author}</p>
      <p>${plainTextToHtml(comment.message)}</p>
      <p><em>Ημερομηνία: ${new Date(comment.timestamp).toLocaleString()}</em></p>
    `;
  }
  return commentElement;
}
function displayComments(comments) {
  commentsList.innerHTML = ""; // Clear existing comments
  comments.forEach((comment) => {
    commentsList.appendChild(createCommentElement(comment));

    // Add a separator between comments
    const separator = document.createElement("hr");
    commentsList.appendChild(separator);
  });
}
function displayPhotoComments(comments) {
  photoCommentsList.innerHTML = ""; // Clear existing comments
  comments.forEach((comment) => {
    photoCommentsList.appendChild(createCommentElement(comment));
    // Add a separator between comments
    const separator = document.createElement("hr");
    photoCommentsList.appendChild(separator);
  });
}
function refreshCommentsList() {
  const pageSize = 200;
  fetch(`/api/comments?pageSize=${pageSize}`)
    .then((response) => response.json())
    .then((comments) => {
      displayComments(comments);
    })
    .catch((error) => {
      console.error("Error fetching comments:", error);
    });
}
function refreshPhotoCommentsList(photoName) {
  const pageSize = 200;
  fetch(`${photoName}/comments?pageSize=${pageSize}`)
    .then((response) => response.json())
    .then((comments) => {
      displayPhotoComments(comments);
    })
    .catch((error) => {
      console.error("Error fetching photo comments:", error);
    });
}

const photoCommentsList = document.getElementById("photoCommentsList");
const photoMessageButton = document.getElementById("photo-message-btn");
photoMessageButton.addEventListener("click", submitPhotoComment);

const commentForm = document.getElementById("commentForm");
const commentsList = document.getElementById("commentsList");
commentForm.addEventListener("submit", submitComment);

// Populate participant list
const participantList = document.getElementById("participantList");
const participantDetails = document.getElementById("participantDetails");
const participantDetailsContainer = document.querySelector(".participant-details-container");
participantList.addEventListener("click", function (event) {
  event.preventDefault();
  if (event.target.tagName === "A") {
    const lName = event.target.textContent.split(" ")[0];
    const fName = event.target.textContent.split(" ")[1];
    showParticipantDetails(findParticipantByName(participants, lName, fName));
  }
});

// Attach event listener to the search input
const searchInput = document.getElementById("search");
searchInput.addEventListener("input", function () {
  filterParticipants(searchInput.value);
});

// Registration form submission
const registrationForm = document.getElementById("registrationForm");
registrationForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  fetch("/api/register", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data.message); // Output the server response message
      refreshParticipantList(); // Refresh the participants list
      // Clear the form fields (if needed)
      registrationForm.reset();
    })
    .catch((error) => {
      console.error("Error registering participant:", error);
    });

  // Clear form fields
  registrationForm.reset();
});

// Upload Generic Photo
const uploadGenericPhoto = document.getElementById("upload-photo-btn");
uploadGenericPhoto.addEventListener("click", function () {
  event.preventDefault();

  const formData = new FormData(uploadPhotoForm);
  fetch("/admin/photo/add", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data.message); // Output the server response message
      uploadPhotoForm.reset();
    })
    .catch((error) => {
      console.error("Error uploading generic photo:", error);
    });
});

// Call the function initially and whenever the window is resized
const iframe = document.getElementById("location-iframe");
adjustIframeHeight();
window.addEventListener("resize", adjustIframeHeight);

// on load
let participants = []; //participantsSample
refreshParticipantList();

const currentPhoto = document.getElementById("current-photo");
const prevPhotoBtn = document.getElementById("prev-photo-btn");
const nextPhotoBtn = document.getElementById("next-photo-btn");
prevPhotoBtn.addEventListener("click", showPrevPhoto);
nextPhotoBtn.addEventListener("click", showNextPhoto);
currentPhoto.addEventListener("mouseenter", stopAutoChange);
currentPhoto.addEventListener("mouseleave", startAutoChange);

let currentPhotoIndex = -1;
let photoFilenames = [];
fetchAndDisplayPhotos(); // load photos when the page loads

refreshCommentsList();

// Call the updateCountdown function initially
updateCountdown();

// Call the updateCountdown function every second
setInterval(updateCountdown, 1000);
