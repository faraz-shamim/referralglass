import { normalizeText } from "./core.js";
export function demoDocuments(complete = false) {
  const rows = [
    [
      "01-referral-note.txt",
      [
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nMossvale Demo Clinic | Reference DEMO-104\nDocument date: 2026-10-18\n\nDear receiving specialist,\nI am referring DEMO-104 for an outpatient assessment. The reason for referral is persistent symptoms discussed at a recent primary-care visit. Relevant history and the clinician's referral question are included in this letter. This fictional note is for administrative software testing, not medical advice.\n\nThe referring practice is Mossvale Demo Clinic. Please return correspondence through the practice's approved channel.`,
      ],
    ],
    [
      "02-prescription-and-sensitivity-record.txt",
      [
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nRegular prescriptions on record\nReference DEMO-104 | Document date: 2026-10-18\n\nCurrent medication reconciliation, reviewed at the referring visit:\nExample medicine A - recorded on the fictional list.\nExample medicine B - recorded on the fictional list.\nThese are placeholders, not treatment recommendations.`,
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nDrug sensitivities and reactions\nReference DEMO-104 | Document date: 2026-10-18\n\nThe documented allergy history records an adverse reaction to an example substance. Details of the reaction were written by the referring clinician. This fictional record illustrates where staff can locate allergy information; it is not a clinical record.`,
      ],
    ],
    [
      "03-administration-and-permission.txt",
      [
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nReferral administration cover\nReference: DEMO-104\nDocument date: 2026-10-18\n\nPatient contact telephone: +1 202-555-0142 (fictional example)\nReferring practice: Mossvale Demo Clinic\nReceiving practice: Harbor Specialist Demo\nPreferred language: English\nThe office reference is included for administrative matching.`,
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nPermission to disclose records\nReference DEMO-104 | Document date: 2026-10-18\n\nI authorize Mossvale Demo Clinic to share the enclosed medical records with Harbor Specialist Demo for this referral.\nSignature: DEMO SIGNATURE - not a real signature\nDate: 2026-10-18`,
      ],
    ],
    [
      "04-correspondence.txt",
      [
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nCorrespondence about investigations\nReference DEMO-104 | Document date: 2026-10-18\n\nThe imaging report is still pending and is not attached to this packet. Laboratory results have been requested but are not yet received. This correspondence is a mention of missing paperwork, not an investigation report.`,
      ],
    ],
  ];
  if (complete)
    rows[3] = [
      "04-investigation-report.txt",
      [
        `SYNTHETIC DEMONSTRATION - NOT A REAL PATIENT\nInvestigation report\nReference DEMO-104 | Document date: 2026-10-18\n\nDiagnostic laboratory findings and imaging results\nReport received from the fictional diagnostic service. Example result fields are included for administrative retrieval testing. No clinical interpretation or treatment advice is supplied.\nAuthor: DEMO REPORT AUTHOR`,
      ],
    ];
  return rows.map(([name, pages], i) => ({
    id: "demo-" + i,
    name,
    type: "text/plain",
    bytes: pages.join("").length,
    date: "2026-10-18",
    hash: "demo-" + i,
    demo: true,
    pages: pages.map((text, n) => ({
      number: n + 1,
      text: normalizeText(text),
      ocr: false,
      confidence: null,
    })),
    file: null,
  }));
}
