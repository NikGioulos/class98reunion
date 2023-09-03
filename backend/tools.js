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

module.exports = {
  toComparableName,
  areEqualNames,
  replaceWhitespacesWithDash,
  removePropertyFromObjects,
  sortByAttribute,
};
