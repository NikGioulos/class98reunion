const request = require("supertest");
const app = require("../server.js"); // Import your Express app
const dao = require("../backend/aws.js"); // Import your data access object

// Mock the dao's listFilesFromBucket function
jest.mock("../backend/aws.js", () => {
  return {
    listFilesFromBucket: jest.fn(),
    loadFileFromBucket: jest.fn(),
    createStorageEngine: jest.fn(),
    putFileOnBucket: jest.fn(),
  };
});

describe("Testing /api/register endpoint", () => {
  const newParticipant = {
    firstName: "anna maria",
    lastName: "doe",
    contact: "john.doe@example.com",
    pwd: "",
    school: "",
    attendance: "Yes",
  };

  it("should return a 500 response when User-Agent header is missing", async () => {
    const response = await request(app)
      .post("/api/register")
      .attach("profilePhoto1998", "README.md")
      .field("firstName", newParticipant.firstName)
      .field("lastName", newParticipant.lastName)
      .set("Authorization", "Basic someBase64String");

    expect(response.status).toBe(500);
    expect(response.type).toBe("application/json");
    expect(response.body).toStrictEqual({ error: "Invalid Username" });
  });

  it("should return a 500 response when participants limit is reached", async () => {
    // Mock dao.loadFileFromBucket to return a large participant list
    const largeParticipantsList = {
      Body: JSON.stringify(new Array(201).fill({})), // Simulate 200 participants
    };
    dao.loadFileFromBucket.mockResolvedValue(largeParticipantsList);

    const response = await request(app)
      .post("/api/register")
      .attach("profilePhoto1998", "README.md")
      .field("firstName", newParticipant.firstName)
      .field("lastName", newParticipant.lastName)
      .set("User-Agent", "anAgent")
      .set("Authorization", "Basic someBase64String");

    expect(response.status).toBe(500);
    expect(response.type).toBe("application/json");
    expect(response.body).toStrictEqual({ message: "Server is Full" });
  });

  // Test the successful registration scenario
  it("should return a 201 response and register a new participant", async () => {
    // Define a mock response from loadFileFromBucket
    const mockResponse = {
      Body: JSON.stringify([]),
    };
    // Mock the loadFileFromBucket function to resolve with the mock response
    dao.loadFileFromBucket.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post("/api/register")
      //.attach("profilePhoto1998", "image1998.jpeg")
      //.attach("profilePhoto2023", "image2023.jpeg")
      .field("firstName", newParticipant.firstName)
      .field("lastName", newParticipant.lastName)
      .field("contact", newParticipant.contact)
      .field("attendance", newParticipant.attendance)
      .set("User-Agent", "anAgent")
      .set("Authorization", "Basic someBase64String");

    expect(response.status).toBe(201);
    expect(response.type).toBe("application/json");
    expect(response.body).toStrictEqual({ message: "Participant registered successfully" });
  });

  // Test the successful update participant scenario
  it("should return a 200 response and update an existing participant", async () => {
    // Define a mock response from loadFileFromBucket
    const mockResponse = {
      Body: JSON.stringify([
        { firstName: "anna-maria", lastName: "Doe", attendance: "No", contact: "", school: "1o", pwd: "" },
        { firstName: "Jane", lastName: "Doe", attendance: "Yes", contact: "", school: "2o", pwd: "" },
      ]),
    };
    // Mock the loadFileFromBucket function to resolve with the mock response
    dao.loadFileFromBucket.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post("/api/register")
      //.attach("profilePhoto1998", "image1998.jpeg")
      //.attach("profilePhoto2023", "image2023.jpeg")
      .field("firstName", newParticipant.firstName)
      .field("lastName", newParticipant.lastName)
      .field("contact", newParticipant.contact)
      .field("attendance", newParticipant.attendance)
      .set("User-Agent", "anAgent")
      .set("Authorization", "Basic someBase64String");

    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");
    expect(response.body).toStrictEqual({ message: "Participant updated successfully" });
  });
});

describe("GET /api/participants", () => {
  it("responds with JSON containing participants", async () => {
    // Define a mock response from loadFileFromBucket
    const mockResponse = {
      Body: JSON.stringify([
        { firstName: "John", lastName: "Doe", school: "1o", pwd: "random" },
        { firstName: "Jane", lastName: "Doe", school: "2o", pwd: "random2" },
        { firstName: "John", lastName: "Smith", school: "2o" },
        { firstName: "Νίκος", lastName: "Γκιούλος", school: "2o" },
        { firstName: "ΝΙΚΟΣ", lastName: "ΦΙΛΛΙΠΟΥ", school: "2o" },
      ]),
    };
    // Mock the loadFileFromBucket function to resolve with the mock response
    dao.loadFileFromBucket.mockResolvedValue(mockResponse);

    const response = await request(app).get("/api/participants");
    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");

    // Add more assertions based on your specific data structure
    // For example, if you expect an array of participants:
    expect(Array.isArray(response.body)).toBe(true);

    // You can also check for specific properties in each participant object
    for (const participant of response.body) {
      expect(participant).toHaveProperty("firstName");
      expect(participant).toHaveProperty("lastName");
      expect(participant).toHaveProperty("school");
      expect(participant).not.toHaveProperty("pwd");
    }
  });
});

describe("Testing /api/participant-photos/:participantName/:photoName endpoint", () => {
  it("should respond with a photo when found", async () => {
    // Define a mock response from loadFileFromBucket
    const mockResponse = {
      Body: Buffer.from("Sample image data", "utf-8"),
    };
    // Mock the loadFileFromBucket function to resolve with the mock response
    dao.loadFileFromBucket.mockResolvedValue(mockResponse);

    const response = await request(app).get("/api/participant-photos/doe_john/photoProfile1998");

    expect(response.status).toBe(200);
    expect(response.type).toBe("image/jpeg");
    expect(response.body).toStrictEqual(mockResponse.Body);
  });

  it("should respond with a 404 when photo is not found", async () => {
    // Define a mock response from loadFileFromBucket
    const mockResponse = new Error("Photo not found");
    // Mock the loadFileFromBucket function to reeject with the mock response
    dao.loadFileFromBucket.mockRejectedValue(mockResponse);

    const response = await request(app).get("/api/participant-photos/bad_name/photoProfile1998");

    expect(response.status).toBe(404);
  });
});

describe("GET /admin/uploadedphotos", () => {
  it("should return a list of uploaded photos", async () => {
    // Define a mock response from listFilesFromBucket
    const mockResponse = {
      Contents: [
        { Key: "photo1.jpg", LastModified: "2" },
        { Key: "photo2.jpg", LastModified: "3" },
      ],
    };

    // Mock the listFilesFromBucket function to resolve with the mock response
    dao.listFilesFromBucket.mockResolvedValue(mockResponse);

    // Make a GET request to the endpoint using Supertest
    const res = await request(app).get("/admin/uploadedphotos");

    // Assertions
    expect(res.status).toBe(200);
    expect(res.body.allUploadedPhotos).toEqual(["photo1.jpg", "photo2.jpg"]);
  });

  it("should handle errors and return a 500 status", async () => {
    // Mock the listFilesFromBucket function to reject with an error
    dao.listFilesFromBucket.mockRejectedValue(new Error("An error occurred"));

    // Make a GET request to the endpoint using Supertest
    const res = await request(app).get("/admin/uploadedphotos");

    // Assertions
    expect(res.status).toBe(500);
    expect(res.text).toBe("Error fetching uploaded photos");
  });
});

describe("POST /api/comments", () => {
  it("should add a new comment and return it", async () => {
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    const mockPutFileOnBucket = dao.putFileOnBucket;

    mockLoadFileFromBucket.mockResolvedValue({
      Body: JSON.stringify([]), // Assuming comments.json is initially empty
    });
    mockPutFileOnBucket.mockResolvedValue({});

    // Define the request payload
    const comment = {
      title: "Test Title",
      author: "Test Author",
      message: "Test Message",
      photoName: "Test Photo",
    };

    // Send a POST request to the endpoint with the payload
    const response = await request(app).post("/api/comments").send(comment).set("Accept", "application/json");

    console.log(response.body);
    // Assert that the response status code is 201 (Created)
    expect(response.status).toBe(201);

    // Assert that the response body matches the expected comment
    expect(response.body).toEqual({
      ...comment,
      timestamp: expect.any(String), // Check if timestamp is a string
    });

    // Assert that the DAO methods were called correctly
    expect(mockLoadFileFromBucket).toHaveBeenCalledWith("db/comments.json");
    expect(mockPutFileOnBucket).toHaveBeenCalledWith("db/comments.json", JSON.stringify([response.body]));
  });

  it("should return a 400 error if required fields are missing", async () => {
    // Define a request payload with missing fields
    const invalidComment = {
      title: "Test Comment",
    };

    // Send a POST request to the endpoint with the invalid payload
    const response = await request(app).post("/api/comments").send(invalidComment).set("Accept", "application/json");

    // Assert that the response status code is 400 (Bad Request)
    expect(response.status).toBe(400);

    // Assert that the response contains an error message
    expect(response.body).toEqual({
      error: "Συντάκτης και Μήνυμα είναι υποχρεωτικά πεδία",
    });
  });
});

describe("GET /api/comments", () => {
  it("should return a list of comments with default pagination", async () => {
    // Mock DAO method to return expected response
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    const comments = [
      { title: "Comment 1", author: "Author 1", message: "Message 1" },
      { title: "Comment 2", author: "Author 2", message: "Message 2" },
      // Add more comments as needed
    ];

    mockLoadFileFromBucket.mockResolvedValue({
      Body: JSON.stringify(comments),
    });

    // Send a GET request to the endpoint
    const response = await request(app).get("/api/comments").set("Accept", "application/json");

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);

    // Assert that the response body contains comments with default pagination
    expect(response.body).toEqual(comments.slice(0, 100)); // Default pageSize is 100
  });

  it("should return a list of comments with custom pagination", async () => {
    // Mock DAO method to return expected response
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    const comments = [
      { title: "Comment 1", author: "Author 1", message: "Message 1" },
      { title: "Comment 2", author: "Author 2", message: "Message 2" },
      // Add more comments as needed
    ];

    mockLoadFileFromBucket.mockResolvedValue({
      Body: JSON.stringify(comments),
    });

    // Define custom pagination parameters
    const pageSize = 50;
    const pageNumber = 2;

    // Send a GET request to the endpoint with custom pagination parameters
    const response = await request(app)
      .get(`/api/comments?pageSize=${pageSize}&pageNumber=${pageNumber}`)
      .set("Accept", "application/json");

    // Calculate the expected comments for the custom pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const expectedComments = comments.slice(startIndex, endIndex);

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);

    // Assert that the response body contains comments with custom pagination
    expect(response.body).toEqual(expectedComments);
  });

  it("should handle errors when loading comments", async () => {
    // Mock DAO method to simulate an error
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    mockLoadFileFromBucket.mockRejectedValue(new Error("Failed to load comments"));

    // Send a GET request to the endpoint
    const response = await request(app).get("/api/comments").set("Accept", "application/json");

    // Assert that the response status code is 500 (Internal Server Error)
    expect(response.status).toBe(500);

    // Assert that the response body contains an error message
    expect(response.body).toEqual({ error: "Comments not supported" });
  });
});

describe("GET /api/photos/:photoName/comments", () => {
  it("should return comments for a specific photo with default pagination", async () => {
    // Mock DAO method to return expected response
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    const photoName = "example.jpg";
    const comments = [
      { title: "Comment 1", author: "Author 1", message: "Message 1", photoName: `/photos/${photoName}` },
      { title: "Comment 2", author: "Author 2", message: "Message 2", photoName: `/photos/${photoName}` },
      // Add more comments for the specific photo as needed
    ];

    mockLoadFileFromBucket.mockResolvedValue({
      Body: JSON.stringify(comments),
    });

    // Send a GET request to the endpoint for the specific photo with default pagination
    const response = await request(app).get(`/api/photos/${photoName}/comments`).set("Accept", "application/json");

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);

    // Assert that the response body contains comments for the specific photo with default pagination
    expect(response.body).toEqual(comments.slice(0, 10)); // Default pageSize is 10
  });

  it("should return comments for a specific photo with custom pagination", async () => {
    // Mock DAO method to return expected response
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    const photoName = "example.jpg";
    const comments = [
      { title: "Comment 1", author: "Author 1", message: "Message 1", photoName: `/photos/${photoName}` },
      { title: "Comment 2", author: "Author 2", message: "Message 2", photoName: `/photos/${photoName}` },
      // Add more comments for the specific photo as needed
    ];

    mockLoadFileFromBucket.mockResolvedValue({
      Body: JSON.stringify(comments),
    });

    // Define custom pagination parameters
    const pageSize = 5;
    const pageNumber = 2;

    // Send a GET request to the endpoint for the specific photo with custom pagination
    const response = await request(app)
      .get(`/api/photos/${photoName}/comments?pageSize=${pageSize}&pageNumber=${pageNumber}`)
      .set("Accept", "application/json");

    // Calculate the expected comments for the custom pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const expectedComments = comments.slice(startIndex, endIndex);

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);

    // Assert that the response body contains comments for the specific photo with custom pagination
    expect(response.body).toEqual(expectedComments);
  });

  it("should handle errors when loading comments", async () => {
    // Mock DAO method to simulate an error
    const mockLoadFileFromBucket = dao.loadFileFromBucket;
    mockLoadFileFromBucket.mockRejectedValue(new Error("Failed to load comments"));

    // Send a GET request to the endpoint
    const response = await request(app).get("/api/photos/example.jpg/comments").set("Accept", "application/json");

    // Assert that the response status code is 500 (Internal Server Error)
    expect(response.status).toBe(500);

    // Assert that the response body contains an error message
    expect(response.body).toEqual({ error: "Photo Comments not supported" });
  });
});

describe("GET /api/photos", () => {
  it("should return recent photo URLs", async () => {
    // Mock DAO method to return a list of photo objects
    const mockListFilesFromBucket = dao.listFilesFromBucket;
    const photoObjects = [
      { Key: "photos/photo1.jpg", LastModified: new Date("2023-01-01T12:00:00Z") },
      { Key: "photos/photo2.jpg", LastModified: new Date("2023-01-02T12:00:00Z") },
      { Key: "photos/photo3.jpg", LastModified: new Date("2023-01-03T12:00:00Z") },
      // Add more photo objects as needed
    ];

    mockListFilesFromBucket.mockResolvedValue({
      Contents: photoObjects,
    });

    // Send a GET request to the endpoint
    const response = await request(app).get("/api/photos").set("Accept", "application/json");

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);
    // Assert that the response contains expected photo URLs with proper sorting
    expect(response.body.photoURLs).toEqual([
      "api/photos/photo3.jpg",
      "api/photos/photo2.jpg",
      "api/photos/photo1.jpg",
    ]);
  });

  it("should handle errors when listing photos", async () => {
    // Mock DAO method to simulate an error
    const mockListFilesFromBucket = dao.listFilesFromBucket;
    mockListFilesFromBucket.mockRejectedValue(new Error("Failed to list photos"));

    // Send a GET request to the endpoint
    const response = await request(app).get("/api/photos").set("Accept", "application/json");

    // Assert that the response status code is 500 (Internal Server Error)
    expect(response.status).toBe(500);

    // Assert that the response body contains an error message
    expect(response.body).toEqual({ error: "Error fetching photos" });
  });
});

describe("GET /api/photos/:photoName", () => {
  it("should return the requested photo", async () => {
    const mockLoadFileFromBucket = dao.loadFileFromBucket;

    // Define a mock photo object
    const mockPhoto = {
      Body: Buffer.from("Mock photo data", "utf-8"), // Replace with your mock photo data
    };

    // Mock DAO method to return the mock photo
    mockLoadFileFromBucket.mockResolvedValue(mockPhoto);

    // Send a GET request to the endpoint with a mock photo name
    const response = await request(app).get("/api/photos/mockphoto.jpg").set("Accept", "image/jpeg"); // Set the expected content type

    // Assert that the response status code is 200 (OK)
    expect(response.status).toBe(200);

    // Assert that the response content type is image/jpeg
    expect(response.header["content-type"]).toBe("image/jpeg");

    // Assert that the response body matches the mock photo data
    expect(response.body.equals(mockPhoto.Body)).toBe(true);
  });

  it("should handle errors when the requested photo is not found", async () => {
    const mockLoadFileFromBucket = dao.loadFileFromBucket;

    // Mock DAO method to simulate a "photo not found" error
    mockLoadFileFromBucket.mockRejectedValue(new Error("Photo not found"));

    // Send a GET request to the endpoint with a non-existent photo name
    const response = await request(app).get("/api/photos/nonexistent.jpg").set("Accept", "image/jpeg"); // Set the expected content type

    // Assert that the response status code is 404 (Not Found)
    expect(response.status).toBe(404);

    // Assert that the response body contains an error message
    expect(response.body).toEqual({ error: "Photo not found" });
  });
});
