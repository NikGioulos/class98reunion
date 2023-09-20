const {
  areEqualNames,
  replaceWhitespacesWithDash,
  sortByAttribute,
  greekToEnglish,
  keepLatinOnly,
} = require("../backend/tools.js");

describe("areEqualNames", () => {
  it("should return true for equal names", () => {
    const result = areEqualNames("John Doe", "john doe");
    expect(result).toBe(true);
  });

  it("should return false for different names", () => {
    const result = areEqualNames("Alice Smith", "Bob Johnson");
    expect(result).toBe(false);
  });

  it("should handle diacritics and case differences", () => {
    const result = areEqualNames("Mário Müller", "maRIO MuLLER");
    expect(result).toBe(true);
  });

  it("should handle Greek letter sigma (ς) and regular sigma (σ)", () => {
    const result = areEqualNames("Παναγιώτης", "Παναγιώτησ");
    expect(result).toBe(true);
  });
});

describe("replaceWhitespacesWithDash", () => {
  it("should replace spaces with dashes", () => {
    const result = replaceWhitespacesWithDash("Hello World");
    expect(result).toBe("Hello-World");
  });

  it("should handle multiple consecutive spaces", () => {
    const result = replaceWhitespacesWithDash("Hello   World");
    expect(result).toBe("Hello-World");
  });

  it("should handle tabs and line breaks", () => {
    const result = replaceWhitespacesWithDash("Hello\tWorld\nHow are you?");
    expect(result).toBe("Hello-World-How-are-you?");
  });

  it("should return the same string if there are no spaces", () => {
    const result = replaceWhitespacesWithDash("NoSpacesHere");
    expect(result).toBe("NoSpacesHere");
  });
});

describe("sortByAttribute", () => {
  it("should sort an array of objects by a specified attribute (string)", () => {
    const arr = [
      { name: "Alice", age: 30 },
      { name: "Charlie", age: 25 },
      { name: "Bob", age: 35 },
    ];

    const sortedArr = sortByAttribute(arr, "name");

    expect(sortedArr).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 35 },
      { name: "Charlie", age: 25 },
    ]);
  });

  it("should sort an array of objects by a specified attribute (number)", () => {
    const arr = [
      { name: "Alice", age: 30 },
      { name: "Charlie", age: 25 },
      { name: "Bob", age: 35 },
    ];

    const sortedArr = sortByAttribute(arr, "age");

    expect(sortedArr).toEqual([
      { name: "Charlie", age: 25 },
      { name: "Alice", age: 30 },
      { name: "Bob", age: 35 },
    ]);
  });

  it("should handle objects with non-numeric attributes", () => {
    const arr = [
      { name: "Alice", score: "C" },
      { name: "Charlie", score: "A" },
      { name: "Bob", score: "B" },
    ];

    const sortedArr = sortByAttribute(arr, "score");

    expect(sortedArr).toEqual([
      { name: "Charlie", score: "A" },
      { name: "Bob", score: "B" },
      { name: "Alice", score: "C" },
    ]);
  });
});

describe("greekToEnglish", () => {
  it("should convert Greek characters to English", () => {
    expect(greekToEnglish("γειά σας")).toBe("geia sas");
    expect(greekToEnglish("Καλημέρα")).toBe("kalimera");
    expect(greekToEnglish("αγάπη")).toBe("agapi");
    expect(greekToEnglish("1-2-98 ΛΟΚΑΤΖΗΔΕΣ")).toBe("1-2-98 lokatzides");
    expect(greekToEnglish("ΑΓ,ΔΗΜΗΤΡΙΟΣ ΘΕΣΣΑΛΟΝΙΚΗ")).toBe("ag,dimitrios thessaloniki");
    expect(greekToEnglish("Σχολείο Σημερα κ ΑυριΟ")).toBe("sxoleio simera k aurio");
    expect(convgreekToEnglishertGreekToEnglish("Φιλοσοφία")).toBe("philosophia");
  });

  it("should handle non-Greek characters", () => {
    expect(greekToEnglish("Hello")).toBe("hello");
    expect(greekToEnglish("12345")).toBe("12345");
    expect(greekToEnglish("")).toBe("");
  });
});

describe("keepLatinOnly", () => {
  it("should remove non-Latin characters and non-numbers", () => {
    expect(keepLatinOnly("H3ll0, W0rld!")).toBe("H3ll0W0rld");
    expect(keepLatinOnly("Thérè Àrè 123 çhäràctèrs")).toBe("ThreAre123charrctrs");
    expect(keepLatinOnly("Special@Characters!$")).toBe("SpecialCharacters");
  });

  it("should handle an empty string", () => {
    expect(keepLatinOnly("")).toBe("");
  });

  it("should handle a string with only non-Latin characters", () => {
    expect(keepLatinOnly("Γειά σας")).toBe("");
  });

  it("should handle a string with only numbers", () => {
    expect(keepLatinOnly("1234567890")).toBe("1234567890");
  });
});
