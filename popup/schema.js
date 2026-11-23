// Form schemas rendered by popup.js. Keys match what the content scripts read.
// type: text | number | email | date | select | radio | bool | multi | file | heading
// wide: span both columns; showIf(data): conditional; list: datalist suggestions.
(() => {
  const GENDERS = ["Male", "Female", "Transgender"];
  const ID_PROOFS = ["Aadhaar Card", "Passport"];
  const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry",
  ];
  const COUNTRIES = ["India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia", "Singapore", "Malaysia", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Germany", "New Zealand", "Sri Lanka", "Nepal"];
  const LANGUAGES = ["Telugu", "Tamil", "Kannada", "Malayalam", "Hindi", "English", "Marathi", "Odia", "Bengali", "Gujarati", "Punjabi", "Sanskrit", "Urdu"];
  const isPassport = (d) => d.idProof === "Passport";

  const pilgrim = [
    { key: "name", label: "Name *", type: "text", required: true, wide: true },
    { key: "age", label: "Age *", type: "number", required: true, min: 1, max: 120 },
    { key: "gender", label: "Gender *", type: "select", options: GENDERS, required: true },
    { key: "idProof", label: "ID proof *", type: "select", options: ID_PROOFS, required: true, default: "Aadhaar Card" },
    { key: "idNumber", label: "ID number *", type: "text", required: true, check: "aadhaar" },
    { key: "passportCountry", label: "Passport country", type: "text", list: COUNTRIES, showIf: isPassport },
    { key: "visaNumber", label: "Visa / OCI number", type: "text", showIf: isPassport },
    { key: "visaType", label: "Type of visa", type: "text", showIf: isPassport },
    { key: "visaValidityDate", label: "Visa validity (DD/MM/YYYY)", type: "text", showIf: isPassport },
  ];

  const contact = [
    { key: "email", label: "Email", type: "email", wide: true },
    { key: "country", label: "Country", type: "text", list: COUNTRIES, default: "India" },
    { key: "state", label: "State", type: "text", list: STATES },
    { key: "city", label: "City", type: "text" },
    { key: "pincode", label: "Pincode", type: "text", maxlength: 6 },
    { key: "gothram", label: "Gothram (Divyanugraha Homam)", type: "text", wide: true },
    { key: "document", label: "Supporting document (senior citizen) — max 1 MB", type: "file", accept: ".jpg,.jpeg,.png,.pdf", wide: true },
  ];

  const srivaniMember = [
    { key: "name", label: "Name as per ID * (4+ English letters)", type: "text", required: true, wide: true, check: "srivaniName" },
    { key: "age", label: "Age *", type: "number", required: true, min: 1, max: 120 },
    { key: "gender", label: "Gender *", type: "select", options: GENDERS, required: true },
    { key: "idProof", label: "ID proof type *", type: "select", options: ID_PROOFS, required: true, default: "Aadhaar Card" },
    { key: "idNumber", label: "ID proof number *", type: "text", required: true, check: "aadhaar" },
  ];

  const srivaniAdvance = [
    { key: "srivaniAdvance", label: "Advance booking (select darshan date on the form)", type: "bool", wide: true },
    { key: "srivaniDarshanDate", label: "Break darshan date", type: "date", showIf: (d) => d.srivaniAdvance },
    { key: "srivaniLaddus", label: "Additional laddus", type: "number", min: 0, showIf: (d) => d.srivaniAdvance },
    { key: "srivaniIncludeAccommodation", label: "Select accommodation", type: "bool", wide: true, showIf: (d) => d.srivaniAdvance },
    { key: "srivaniAccommodationDate", label: "Accommodation date (blank = darshan date)", type: "date", showIf: (d) => d.srivaniAdvance && d.srivaniIncludeAccommodation },
    { key: "srivaniAccommodationTimeSlot", label: "Check-in time slot (text on TTD)", type: "text", showIf: (d) => d.srivaniAdvance && d.srivaniIncludeAccommodation },
  ];

  const yes = (k) => (d) => d[k] === "true";
  const sevak = [
    { type: "heading", label: "Identity" },
    { key: "idType", label: "ID proof type *", type: "select", options: ["Aadhaar Card", "Passport", "Voter ID", "Driving Licence", "PAN Card"], default: "Aadhaar Card" },
    { key: "idNumber", label: "ID proof number *", type: "text", check: "aadhaar" },
    { key: "sevakName", label: "Name *", type: "text" },
    { key: "surName", label: "Surname", type: "text" },
    { key: "fatherOrSpouseName", label: "Father / spouse name *", type: "text", wide: true },
    { key: "dob", label: "Date of birth (DD/MM/YYYY) *", type: "text" },
    { key: "age", label: "Age *", type: "number", min: 18, max: 100 },
    { key: "mobileNo", label: "Mobile (10 digits) *", type: "text", maxlength: 10 },
    { key: "email", label: "Email *", type: "email" },
    { key: "bloodGroup", label: "Blood group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    { key: "gender", label: "Gender", type: "radio", options: ["Male", "Female"] },
    { key: "mentallyFit", label: "Mentally fit", type: "bool" },
    { key: "physicallyFit", label: "Physically fit", type: "bool" },

    { type: "heading", label: "Address" },
    { key: "doorNo", label: "Door no *", type: "text" },
    { key: "street", label: "Street *", type: "text" },
    { key: "pincode", label: "Pincode *", type: "text", maxlength: 6 },
    { key: "country", label: "Country *", type: "text", list: COUNTRIES, default: "India" },
    { key: "state", label: "State *", type: "text", list: STATES },
    { key: "district", label: "District *", type: "text" },
    { key: "city", label: "City / village *", type: "text" },
    { key: "nearestTtdTemple", label: "Nearest TTD temple", type: "text" },
    { key: "photo", label: "Photo (JPEG/PNG, max 1 MB)", type: "file", accept: ".jpg,.jpeg,.png", wide: true },

    { type: "heading", label: "Volunteer details (professional / Parakamani forms)" },
    { key: "volunteerQualification", label: "Qualification", type: "text" },
    { key: "volunteerProfession", label: "Profession", type: "text" },
    { key: "employeeId", label: "Employee ID", type: "text" },
    { key: "designation", label: "Designation", type: "text" },
    { key: "specialisation", label: "Specialisation", type: "text" },
    { key: "placeOfWork", label: "Place of work", type: "text" },
    { key: "spvrName", label: "Full name as per Aadhaar", type: "text", wide: true },
    { key: "spvrRelativeName", label: "Father / husband name", type: "text", wide: true },
    { key: "maritalStatus", label: "Marital status", type: "select", options: ["Single", "Married", "Divorced", "Widowed"] },
    { key: "altMobileNo", label: "Alternate mobile", type: "text", maxlength: 10 },
    { key: "residentialAdrs", label: "Residential address", type: "text", wide: true },

    { type: "heading", label: "Education" },
    { key: "qualification", label: "Qualification category (as on TTD)", type: "text" },
    { key: "specQualification", label: "Specific qualification", type: "text" },
    { key: "uniName", label: "University", type: "text" },
    { key: "yearOfGraduation", label: "Year of graduation", type: "text", maxlength: 4 },
    { key: "eduSpecialization", label: "Specialization", type: "text" },

    { type: "heading", label: "Profession" },
    { key: "employmentStatus", label: "Employment status", type: "text" },
    { key: "employmentSector", label: "Sector", type: "text" },
    { key: "professionalCategory", label: "Profession category", type: "text" },
    { key: "specProfession", label: "Role", type: "text" },
    { key: "profYearsOfExp", label: "Years of experience", type: "text" },

    { type: "heading", label: "Experience & references" },
    { key: "previouslyVolunteered", label: "Previously volunteered?", type: "radio", options: [["true", "Yes"], ["false", "No"]] },
    { key: "noOfParticipation", label: "No. of times", type: "text", showIf: yes("previouslyVolunteered") },
    { key: "lastTwoSevaPeriods", label: "Last two seva periods", type: "text", showIf: yes("previouslyVolunteered") },
    { key: "religiousInstitute", label: "Other organisation", type: "text", showIf: yes("previouslyVolunteered") },
    { key: "volunteeredExp", label: "Experience", type: "text", showIf: yes("previouslyVolunteered") },
    { key: "languages", label: "Languages known", type: "multi", options: LANGUAGES, wide: true },
    { key: "firstRefName", label: "Reference 1 name", type: "text", wide: true },
    { key: "firstRefDetails", label: "Details / relation", type: "text" },
    { key: "firstRefMobileNo", label: "Mobile", type: "text", maxlength: 10 },
    { key: "secRefName", label: "Reference 2 name", type: "text", wide: true },
    { key: "secRefDetails", label: "Details / relation", type: "text" },
    { key: "secRefMobileNo", label: "Mobile", type: "text", maxlength: 10 },

    { type: "heading", label: "Trainer specifics" },
    { key: "experiencedTrainer", label: "Training experience?", type: "radio", options: [["true", "Yes"], ["false", "No"]] },
    { key: "trainerInstituteName", label: "Organisation / institute", type: "text", showIf: yes("experiencedTrainer") },
    { key: "trainerRole", label: "Role as trainer", type: "text", showIf: yes("experiencedTrainer") },
    { key: "trainerExp", label: "Experience description", type: "text", wide: true, showIf: yes("experiencedTrainer") },
    { key: "areaOfTrainerExp", label: "Expertise areas (comma separated, exactly as on TTD; e.g. Others (Specify))", type: "csv", wide: true, showIf: yes("experiencedTrainer") },
    { key: "otherAreaOfTrainerExp", label: "Other area (specify)", type: "text", wide: true, showIf: yes("experiencedTrainer") },
    { key: "preferredLoc", label: "Preferred location", type: "select", options: ["Tirumala", "Tirupati", "Other(Specify)"] },
    { key: "otherPreferredLoc", label: "Specify location", type: "text", showIf: (d) => d.preferredLoc === "Other(Specify)" },
    { key: "timeCommitment", label: "Time commitment", type: "select", options: ["Weekdays", "Weekends", "Both"] },
    { key: "freq", label: "Frequency", type: "select", options: ["Monthly", "Quarterly", "Yearly", "As required"] },

    { type: "heading", label: "Uploads" },
    { key: "document", label: "ID proof (max 1 MB)", type: "file", accept: ".jpg,.jpeg,.png", wide: true },
    { key: "eduCertificate", label: "Educational certificate (max 1 MB)", type: "file", accept: ".jpg,.jpeg,.png", wide: true },
  ];

  const settings = [
    { key: "defaultFillAction", label: "Floating button / Alt+A default action", type: "select", options: [["fill", "Fill only"], ["continue", "Fill & Continue"]], default: "fill", wide: true },
    { key: "sevaClickSaveAndAdd", label: "Seva: click “Save and Add Sevak” after filling", type: "bool", default: true, wide: true },
  ];

  globalThis.SCHEMAS = { pilgrim, contact, srivaniMember, srivaniAdvance, sevak, settings };
})();
