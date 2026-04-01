import React from "react";
import { getPatientMedicalProfile, updatePatientMedicalProfile } from "../../services/hospitalApi";
import { useAuth } from "../../auth/AuthProvider";

const OTHER_OPTION_VALUE = "__OTHER__";

const MEDICAL_DROPDOWN_OPTIONS = {
  allergies: ["Dust", "Pollen", "Peanuts", "Dairy", "Egg", "Latex", "Penicillin"],
  chronic_conditions: ["Diabetes", "Hypertension", "Asthma", "Thyroid Disorder", "Heart Disease"],
  current_medications: ["Metformin", "Insulin", "Amlodipine", "Levothyroxine", "Inhaler"],
  major_past_surgeries: ["Appendectomy", "Gallbladder Surgery", "C-Section", "Bypass Surgery", "Knee Replacement"],
};

const MEDICAL_FIELD_CONFIGS = [
  {
    key: "allergies",
    label: "Allergies",
    placeholder: "Describe allergy details",
  },
  {
    key: "chronic_conditions",
    label: "Chronic Conditions",
    placeholder: "Describe chronic condition details",
  },
  {
    key: "current_medications",
    label: "Current Medications",
    placeholder: "List medicine names and dosage",
  },
  {
    key: "major_past_surgeries",
    label: "Major Past Surgeries",
    placeholder: "Describe procedure and year",
  },
];

function parseMedicalFieldValue(value, knownOptions) {
  const clean = String(value || "").trim();
  if (!clean || clean.toUpperCase() === "NA") {
    return { selected: "NA", customValue: "" };
  }

  const matchedOption = knownOptions.find((option) => option.toLowerCase() === clean.toLowerCase());
  if (matchedOption) {
    return { selected: matchedOption, customValue: "" };
  }

  return { selected: OTHER_OPTION_VALUE, customValue: clean };
}

export default function PatientProfilePage() {
  const { setProfileCompletion } = useAuth();
  const defaultProfile = React.useMemo(() => ({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    age: null,
    gender: "",
    blood_group: "UNKNOWN",
    previous_diagnosis: "",
    allergies: "NA",
    chronic_conditions: "NA",
    current_medications: "NA",
    major_past_surgeries: "NA",
    height_cm: null,
    weight_kg: null,
    disability_notes: "",
  }), []);

  const [medicalProfile, setMedicalProfile] = React.useState(defaultProfile);
  const [medicalSelections, setMedicalSelections] = React.useState({
    allergies: "NA",
    chronic_conditions: "NA",
    current_medications: "NA",
    major_past_surgeries: "NA",
  });
  const [customMedicalValues, setCustomMedicalValues] = React.useState({
    allergies: "",
    chronic_conditions: "",
    current_medications: "",
    major_past_surgeries: "",
  });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getPatientMedicalProfile();
        const nextProfile = { ...defaultProfile, ...data };
        setMedicalProfile(nextProfile);

        const nextSelections = {};
        const nextCustomValues = {};
        MEDICAL_FIELD_CONFIGS.forEach((field) => {
          const parsed = parseMedicalFieldValue(nextProfile[field.key], MEDICAL_DROPDOWN_OPTIONS[field.key]);
          nextSelections[field.key] = parsed.selected;
          nextCustomValues[field.key] = parsed.customValue;
        });
        setMedicalSelections((prev) => ({ ...prev, ...nextSelections }));
        setCustomMedicalValues((prev) => ({ ...prev, ...nextCustomValues }));
      } catch (err) {
        setError(err.message || "Failed to load medical profile");
      }
    })();
  }, [defaultProfile]);

  const numberOrNull = (value) => (value === null || value === "" ? null : Number(value));
  const textOrNA = (value) => {
    const clean = String(value || "").trim();
    return clean ? clean : "NA";
  };

  function handleMedicalSelectionChange(fieldName, selectedValue) {
    setMedicalSelections((prev) => ({ ...prev, [fieldName]: selectedValue }));

    if (selectedValue === "NA") {
      setCustomMedicalValues((prev) => ({ ...prev, [fieldName]: "" }));
      setMedicalProfile((prev) => ({ ...prev, [fieldName]: "NA" }));
      return;
    }

    if (selectedValue === OTHER_OPTION_VALUE) {
      setMedicalProfile((prev) => ({ ...prev, [fieldName]: customMedicalValues[fieldName] || "" }));
      return;
    }

    setCustomMedicalValues((prev) => ({ ...prev, [fieldName]: "" }));
    setMedicalProfile((prev) => ({ ...prev, [fieldName]: selectedValue }));
  }

  function handleMedicalOtherInput(fieldName, value) {
    setCustomMedicalValues((prev) => ({ ...prev, [fieldName]: value }));
    setMedicalProfile((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await updatePatientMedicalProfile({
        first_name: medicalProfile.first_name,
        last_name: medicalProfile.last_name,
        email: medicalProfile.email,
        mobile: medicalProfile.mobile,
        age: numberOrNull(medicalProfile.age),
        gender: medicalProfile.gender,
        blood_group: medicalProfile.blood_group,
        previous_diagnosis: medicalProfile.previous_diagnosis,
        allergies: textOrNA(medicalProfile.allergies),
        chronic_conditions: textOrNA(medicalProfile.chronic_conditions),
        current_medications: textOrNA(medicalProfile.current_medications),
        major_past_surgeries: textOrNA(medicalProfile.major_past_surgeries),
        height_cm: numberOrNull(medicalProfile.height_cm),
        weight_kg: numberOrNull(medicalProfile.weight_kg),
        disability_notes: medicalProfile.disability_notes,
      });

      const completed =
        Boolean((medicalProfile.first_name || "").trim()) &&
        Boolean((medicalProfile.last_name || "").trim()) &&
        Boolean((medicalProfile.mobile || "").trim()) &&
        numberOrNull(medicalProfile.age) !== null &&
        Boolean((medicalProfile.gender || "").trim()) &&
        Boolean((medicalProfile.blood_group || "").trim()) &&
        medicalProfile.blood_group !== "UNKNOWN";
      setProfileCompletion(completed);
      setMessage("Medical profile updated.");
    } catch (err) {
      setError(err.message || "Medical profile update failed");
    }
  }