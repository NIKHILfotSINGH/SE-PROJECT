export const PROFILE_COMPLETION_ALERT = "Please complete your medical profile to access this feature.";

const VALID_BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
const REQUIRED_MEDICAL_TEXT_FIELDS = [
  "allergies",
  "chronic_conditions",
  "current_medications",
  "major_past_surgeries",
];
const MOBILE_NUMBER_LENGTH = 10;

export function normalizeBloodGroup(value) {
  return String(value || "").trim().toUpperCase();
}

export function hasValidBloodGroup(value) {
  return VALID_BLOOD_GROUPS.has(normalizeBloodGroup(value));
}

function hasTextValue(value) {
  return Boolean(String(value || "").trim());
}

function hasValidMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === MOBILE_NUMBER_LENGTH;
}

function hasValidAge(value) {
  if (value === null || value === "") {
    return false;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0;
}

function hasPositiveNumber(value) {
  if (value === null || value === "") {
    return false;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

export function isPatientMedicalProfileComplete(profile) {
  const currentProfile = profile || {};

  return (
    hasTextValue(currentProfile.first_name) &&
    hasTextValue(currentProfile.last_name) &&
    hasValidMobile(currentProfile.mobile) &&
    hasValidAge(currentProfile.age) &&
    hasTextValue(currentProfile.gender) &&
    hasValidBloodGroup(currentProfile.blood_group) &&
    hasPositiveNumber(currentProfile.height_cm) &&
    hasPositiveNumber(currentProfile.weight_kg) &&
    hasTextValue(currentProfile.disability_notes) &&
    REQUIRED_MEDICAL_TEXT_FIELDS.every((fieldName) => hasTextValue(currentProfile[fieldName]))
  );
}