import React from "react";
import { useLocation } from "react-router-dom";
import { getPatientMedicalProfile, updatePatientMedicalProfile } from "../../services/HospitalApi";
import { useAuth } from "../../auth/AuthProvider";
import { hasValidBloodGroup, isPatientMedicalProfileComplete, normalizeBloodGroup } from "../../utils/patientMedicalProfile";

const OTHER_OPTION_VALUE = "__OTHER__";
const MOBILE_NUMBER_LENGTH = 10;

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

function normalizeMobileDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, MOBILE_NUMBER_LENGTH);
}

function isValidMobile(value) {
  return normalizeMobileDigits(value).length === MOBILE_NUMBER_LENGTH;
}

function hasTextValue(value) {
  return Boolean(String(value || "").trim());
}

function hasPositiveNumber(value) {
  if (value === null || value === "") {
    return false;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

export default function PatientProfilePage() {
  const { setProfileCompletion } = useAuth();
  const location = useLocation();
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
    const profileAlert = location.state?.profileAlert;
    if (profileAlert) {
      setError(profileAlert);
      setMessage("");
    }
  }, [location.state]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getPatientMedicalProfile();
        const nextProfile = { ...defaultProfile, ...data };
        nextProfile.blood_group = normalizeBloodGroup(nextProfile.blood_group) || "UNKNOWN";
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

    const missingFields = [];

    if (!hasTextValue(medicalProfile.first_name)) {
      missingFields.push("First Name");
    }
    if (!hasTextValue(medicalProfile.last_name)) {
      missingFields.push("Last Name");
    }
    if (numberOrNull(medicalProfile.age) === null) {
      missingFields.push("Age");
    }
    if (!hasTextValue(medicalProfile.gender)) {
      missingFields.push("Gender");
    }
    if (!hasPositiveNumber(medicalProfile.height_cm)) {
      missingFields.push("Height (cm)");
    }
    if (!hasPositiveNumber(medicalProfile.weight_kg)) {
      missingFields.push("Weight (kg)");
    }
    if (!hasTextValue(medicalProfile.disability_notes)) {
      missingFields.push("Disability / Accessibility Needs");
    }

    MEDICAL_FIELD_CONFIGS.forEach((field) => {
      const selectedValue = medicalSelections[field.key];
      if (!selectedValue) {
        missingFields.push(field.label);
      }
      if (selectedValue === OTHER_OPTION_VALUE && !hasTextValue(customMedicalValues[field.key])) {
        missingFields.push(`${field.label} (Other details)`);
      }
    });

    if (missingFields.length) {
      setError(`Please complete all mandatory fields: ${missingFields.join(", ")}.`);
      return;
    }

    const sanitizedMobile = normalizeMobileDigits(medicalProfile.mobile);
    if (!isValidMobile(sanitizedMobile)) {
      setError(`Mobile number must be exactly ${MOBILE_NUMBER_LENGTH} digits.`);
      return;
    }

    const normalizedBloodGroup = normalizeBloodGroup(medicalProfile.blood_group);
    if (!hasValidBloodGroup(normalizedBloodGroup)) {
      setError("Please select a valid blood group.");
      return;
    }

    const normalizedDisabilityNotes = String(medicalProfile.disability_notes || "").trim();

    try {
      await updatePatientMedicalProfile({
        first_name: medicalProfile.first_name,
        last_name: medicalProfile.last_name,
        email: medicalProfile.email,
        mobile: sanitizedMobile,
        age: numberOrNull(medicalProfile.age),
        gender: medicalProfile.gender,
        blood_group: normalizedBloodGroup,
        previous_diagnosis: medicalProfile.previous_diagnosis,
        allergies: textOrNA(medicalProfile.allergies),
        chronic_conditions: textOrNA(medicalProfile.chronic_conditions),
        current_medications: textOrNA(medicalProfile.current_medications),
        major_past_surgeries: textOrNA(medicalProfile.major_past_surgeries),
        height_cm: numberOrNull(medicalProfile.height_cm),
        weight_kg: numberOrNull(medicalProfile.weight_kg),
        disability_notes: normalizedDisabilityNotes,
      });

      const completed = isPatientMedicalProfileComplete({
        ...medicalProfile,
        mobile: sanitizedMobile,
        blood_group: normalizedBloodGroup,
        disability_notes: normalizedDisabilityNotes,
        allergies: textOrNA(medicalProfile.allergies),
        chronic_conditions: textOrNA(medicalProfile.chronic_conditions),
        current_medications: textOrNA(medicalProfile.current_medications),
        major_past_surgeries: textOrNA(medicalProfile.major_past_surgeries),
      });
      setProfileCompletion(completed);
      setMessage("Medical profile updated.");
    } catch (err) {
      setError(err.message || "Medical profile update failed");
    }
  }

  return (
    <div>
      <h3>Medical Profile</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}
      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <div className="form-group">
            <label>First Name</label>
            <input
              value={medicalProfile.first_name || ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="Given name"
              required
            />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input
              value={medicalProfile.last_name || ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, last_name: e.target.value }))}
              placeholder="Family name"
              required
            />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input
              type="tel"
              value={medicalProfile.mobile || ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, mobile: normalizeMobileDigits(e.target.value) }))}
              placeholder={`Phone number (${MOBILE_NUMBER_LENGTH} digits)`}
              inputMode="numeric"
              pattern={`\\d{${MOBILE_NUMBER_LENGTH}}`}
              minLength={MOBILE_NUMBER_LENGTH}
              maxLength={MOBILE_NUMBER_LENGTH}
              title={`Enter exactly ${MOBILE_NUMBER_LENGTH} digits`}
              required
            />
          </div>
          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              min="0"
              value={medicalProfile.age ?? ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, age: e.target.value }))}
              placeholder="Age in years"
              required
            />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select
              value={medicalProfile.gender || ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, gender: e.target.value }))}
              required
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Height (cm)</label>
            <input
              type="number"
              min="1"
              value={medicalProfile.height_cm ?? ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, height_cm: e.target.value }))}
              placeholder="e.g. 170"
              required
            />
          </div>
          <div className="form-group">
            <label>Weight (kg)</label>
            <input
              type="number"
              min="1"
              value={medicalProfile.weight_kg ?? ""}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, weight_kg: e.target.value }))}
              placeholder="e.g. 65"
              required
            />
          </div>
          <div className="form-group">
            <label>Blood Group</label>
            <select
              value={medicalProfile.blood_group || "UNKNOWN"}
              onChange={(e) => setMedicalProfile((prev) => ({ ...prev, blood_group: e.target.value }))}
              required
            >
              <option value="UNKNOWN">Unknown</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Disability / Accessibility Needs</label>
          <textarea
            value={medicalProfile.disability_notes || ""}
            onChange={(e) => setMedicalProfile((prev) => ({ ...prev, disability_notes: e.target.value }))}
            placeholder="List any disabilities, assistive devices, or accessibility preferences"
            required
          />
        </div>

        {MEDICAL_FIELD_CONFIGS.map((field) => (
          <div key={field.key} className="form-group">
            <label>{field.label}</label>
            <select
              value={medicalSelections[field.key] || "NA"}
              onChange={(e) => handleMedicalSelectionChange(field.key, e.target.value)}
            >
              <option value="NA">NA</option>
              {MEDICAL_DROPDOWN_OPTIONS[field.key].map((option) => (
                <option key={`${field.key}-${option}`} value={option}>
                  {option}
                </option>
              ))}
              <option value={OTHER_OPTION_VALUE}>Other (Type manually)</option>
            </select>

            {medicalSelections[field.key] === OTHER_OPTION_VALUE && (
              <textarea
                value={customMedicalValues[field.key] || ""}
                onChange={(e) => handleMedicalOtherInput(field.key, e.target.value)}
                placeholder={field.placeholder}
                required
              />
            )}
          </div>
        ))}

        <div className="form-group">
          <label>Previous Diagnosis</label>
          <textarea
            value={medicalProfile.previous_diagnosis || ""}
            placeholder="Describe previous diagnosis history"
            readOnly
          />
        </div>

        <button type="submit" className="btn">Save Medical Profile</button>
      </form>
    </div>
  );
}