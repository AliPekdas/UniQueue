const RESOURCE_TYPES = Object.freeze({
  STUDY_ROOM: 'StudyRoom',
  OFFICE_HOURS: 'OfficeHours',
  TRANSIT_LINE: 'TransitLine',
});

const BOOKABLE_TYPES = new Set([
  RESOURCE_TYPES.STUDY_ROOM,
  RESOURCE_TYPES.OFFICE_HOURS,
]);

function isBookable(resourceType) {
  return BOOKABLE_TYPES.has(resourceType);
}

module.exports = { RESOURCE_TYPES, BOOKABLE_TYPES, isBookable };
