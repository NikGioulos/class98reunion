function toComparableName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

function areEqualNames(name1, name2) {
  return toComparableName(name1) === toComparableName(name2);
}

function replaceWhitespacesWithDash(text) {
  return text.replace(/\s+/g, "-");
}

function removePropertyFromObjects(array, propertyToRemove) {
  array.forEach((obj) => {
    if (obj.hasOwnProperty(propertyToRemove)) {
      delete obj[propertyToRemove];
    }
  });
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

function greekToEnglish(word) {
  const greekToEnglishMap = {
    α: "a",
    ά: "a",
    β: "b",
    γ: "g",
    δ: "d",
    ε: "e",
    έ: "e",
    ζ: "z",
    η: "i",
    ή: "i",
    θ: "th",
    ι: "i",
    ί: "i",
    κ: "k",
    λ: "l",
    μ: "m",
    ν: "n",
    ξ: "ks",
    ο: "o",
    ό: "o",
    π: "p",
    ρ: "r",
    σ: "s",
    ς: "s",
    τ: "t",
    υ: "u",
    ύ: "u",
    φ: "ph",
    χ: "x",
    ψ: "ps",
    ω: "o",
    ώ: "o",
    ς: "s",
  };
  let result = "";
  let wordLow = word.toLowerCase();
  for (let i = 0; i < wordLow.length; i++) {
    const char = wordLow[i];
    const englishChar = greekToEnglishMap[char] || char;
    result += englishChar;
  }
  return result;
}

function keepLatinOnly(word) {
  return word.replace(/[^a-zA-Z0-9]/g, "");
}

const isBadName = (photoKey, badNames) => badNames.some((badName) => photoKey.startsWith(badName));

module.exports = {
  toComparableName,
  areEqualNames,
  replaceWhitespacesWithDash,
  removePropertyFromObjects,
  sortByAttribute,
  greekToEnglish,
  isBadName,
  keepLatinOnly,
};
