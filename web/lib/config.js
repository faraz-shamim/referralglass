export const MODEL = {
  id: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
  dtype: "q8",
  device: "wasm",
  dimensions: 384,
  license: "Apache-2.0",
};
export const LIMITS = {
  files: 12,
  fileBytes: 10 * 1024 * 1024,
  pages: 20,
  packetChars: 240000,
  chunks: 300,
  requirements: 12,
};
export const DEFAULT_REQUIREMENTS = [
  {
    id: "reason",
    label: "Referral reason & history",
    query:
      "A referral letter explaining the reason for specialist assessment and the relevant medical history.",
    aliases: ["referral", "reason", "history"],
    required: true,
    maxAgeDays: 0,
  },
  {
    id: "medicines",
    label: "Current medicines",
    query:
      "A current medication list describing the medicines or regular prescriptions the patient takes.",
    aliases: ["medication", "medicines", "prescriptions", "meds"],
    required: true,
    maxAgeDays: 0,
  },
  {
    id: "allergies",
    label: "Allergies & reactions",
    query:
      "Recorded allergies or adverse drug reactions, including a documented statement of no known drug allergies.",
    aliases: ["allergy", "allergies", "reactions", "nkda"],
    required: true,
    maxAgeDays: 0,
  },
  {
    id: "investigations",
    label: "Investigation reports",
    query:
      "An attached diagnostic test report with laboratory findings, imaging results or investigation results.",
    aliases: ["investigation", "laboratory", "imaging", "results", "report"],
    required: true,
    maxAgeDays: 0,
  },
  {
    id: "contact",
    label: "Administration & contact",
    query:
      "A patient administration cover sheet with a patient reference, contact telephone number and referring practice.",
    aliases: ["contact", "telephone", "cover", "administration"],
    required: true,
    maxAgeDays: 0,
  },
  {
    id: "consent",
    label: "Records-sharing permission",
    query:
      "A signed consent or authorization to share medical records with the receiving specialist practice.",
    aliases: ["consent", "authorization", "permission", "sharing"],
    required: true,
    maxAgeDays: 0,
  },
];
export const POLICY_NOTE =
  "Illustrative office checklist. Your practice sets the actual referral requirements; this is not clinical guidance.";
