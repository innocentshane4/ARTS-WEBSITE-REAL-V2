/**
 * ARTS Admin — Seed Data
 * ------------------------------------------------------------------
 * Builds realistic demo data (ten or more records per table) and loads it
 * into Firestore when an administrator presses "Load demo data".
 * Records use fixed ids, so loading twice overwrites the same demo
 * records instead of duplicating them. Real user accounts are untouched.
 * ------------------------------------------------------------------
 */

function buildDemoData() {
  const data = {};

  // ---- Users --------------------------------------------------------------
  data.users = [
    {
      id: "user_001", fullName: "Jane Mokoena", email: "jane@example.com", phone: "082 123 4567",
      createdAt: "2026-06-10T09:15:00Z",
      idNumber: "9301045800082", age: "29", gender: "Female", weightKg: "68", heightCm: "170",
      bloodType: "O+", medicalAidProvider: "Discovery Health", medicalAidNumber: "DH-99213456",
      preferredHospital: "Netcare Milpark Hospital", allergiesOrConditions: "Penicillin",
      chronicConditions: "None", currentMedications: "None",
      emergencyContactName: "Thabo Mokoena", emergencyContactPhone: "082 555 0199",
      safetyScore: 87,
    },
    {
      id: "user_002", fullName: "Sipho Dlamini", email: "sipho.d@example.com", phone: "083 456 7890",
      createdAt: "2026-06-12T14:20:00Z",
      idNumber: "8811126300088", age: "34", gender: "Male", weightKg: "82", heightCm: "179",
      bloodType: "A+", medicalAidProvider: "Bonitas", medicalAidNumber: "BN-44201982",
      preferredHospital: "Sandton Mediclinic", allergiesOrConditions: "None",
      chronicConditions: "Hypertension", currentMedications: "Enalapril",
      emergencyContactName: "Nomvula Dlamini", emergencyContactPhone: "083 220 4471",
      safetyScore: 74,
    },
    {
      id: "user_003", fullName: "Thandi Khumalo", email: "thandi.k@example.com", phone: "071 998 2231",
      createdAt: "2026-06-15T11:05:00Z",
      idNumber: "9605120900081", age: "20", gender: "Female", weightKg: "58", heightCm: "163",
      bloodType: "B+", medicalAidProvider: "None / Not on a medical aid", medicalAidNumber: "",
      preferredHospital: "Chris Hani Baragwanath", allergiesOrConditions: "Shellfish",
      chronicConditions: "Asthma", currentMedications: "Salbutamol inhaler",
      emergencyContactName: "Precious Khumalo", emergencyContactPhone: "071 340 8820",
      safetyScore: 91,
    },
    {
      id: "user_004", fullName: "Kwame Asante", email: "kwame.a@example.com", phone: "079 112 5563",
      createdAt: "2026-06-18T16:40:00Z",
      idNumber: "8502037700086", age: "39", gender: "Male", weightKg: "90", heightCm: "182",
      bloodType: "O-", medicalAidProvider: "GEMS", medicalAidNumber: "GM-77102341",
      preferredHospital: "Steve Biko Academic Hospital", allergiesOrConditions: "None",
      chronicConditions: "Type 2 Diabetes", currentMedications: "Metformin",
      emergencyContactName: "Ama Asante", emergencyContactPhone: "079 660 1123",
      safetyScore: 68,
    },
    {
      id: "user_005", fullName: "Nandi Zulu", email: "nandi.z@example.com", phone: "084 774 3390",
      createdAt: "2026-06-20T08:55:00Z",
      idNumber: "9911089200080", age: "24", gender: "Female", weightKg: "61", heightCm: "167",
      bloodType: "AB+", medicalAidProvider: "Momentum Health", medicalAidNumber: "MH-33875621",
      preferredHospital: "Life Fourways Hospital", allergiesOrConditions: "Latex",
      chronicConditions: "None", currentMedications: "None",
      emergencyContactName: "Sibusiso Zulu", emergencyContactPhone: "084 991 2247",
      safetyScore: 95,
    },
  ];

  // ---- Contracted Services directory --------------------------------------
  data.contractedServices = [
    { id: "svc_001", name: "Netcare 911", serviceType: "Ambulance", phone: "082 911 0911", email: "dispatch@netcare911.co.za", address: "Rivonia Road, Sandton", notes: "Primary ambulance contract for Sandton/Rosebank corridor", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_002", name: "ER24", serviceType: "Ambulance", phone: "084 124", email: "control@er24.co.za", address: "Bryanston, Johannesburg", notes: "Secondary ambulance service, faster response south of the M1", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_003", name: "SAPS Sandton", serviceType: "Police", phone: "011 722 4300", email: "", address: "Corner Rivonia Rd & West St, Sandton", notes: "", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_004", name: "JMPD Traffic — Region E", serviceType: "Traffic", phone: "011 375 5911", email: "", address: "Randburg", notes: "Handles traffic control and scene management", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_005", name: "Johannesburg Fire & Rescue — Station 1", serviceType: "Fire", phone: "011 375 5911", email: "", address: "Braamfontein", notes: "", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_006", name: "AA Towing Sandton", serviceType: "Towing", phone: "083 843 2277", email: "dispatch@aatowing.co.za", address: "Sandton", notes: "Contracted for accident vehicle removal", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_007", name: "Netcare Milpark Hospital", serviceType: "Hospital", phone: "011 480 5600", email: "", address: "9 Guild Rd, Parktown West", notes: "Trauma unit — Level 1", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_008", name: "Sandton Mediclinic", serviceType: "Hospital", phone: "011 709 2000", email: "", address: "Peter Place, Bryanston", notes: "", active: true, createdAt: "2026-05-01T00:00:00Z" },
  ];

  // ---- Incidents -----------------------------------------------------------
  const now = Date.now();
  const minsAgo = (m) => new Date(now - m * 60000).toISOString();

  data.incidents = [
    {
      id: "inc_001", title: "Multi-vehicle collision on N1 Northbound", type: "Collision",
      priority: "High", status: "Pending", location: "N1 Highway, near Grayston Drive off-ramp",
      latitude: -26.1076, longitude: 28.0567,
      description: "Three-vehicle pile-up blocking two lanes. Visible smoke from engine bay of lead vehicle. Multiple occupants, at least one reporting chest pain.",
      photoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'><rect width='400' height='240' fill='%23F3F9F5'/><rect y='150' width='400' height='90' fill='%23DCE8E1'/><rect y='150' width='400' height='6' fill='%230F4C3A' opacity='0.3'/><g transform='translate(90,120)'><rect x='0' y='30' width='90' height='34' rx='6' fill='%23C81E3A'/><rect x='10' y='10' width='55' height='26' rx='5' fill='%23C81E3A'/><circle cx='20' cy='66' r='11' fill='%2314231C'/><circle cx='75' cy='66' r='11' fill='%2314231C'/></g><g transform='translate(230,128)'><rect x='0' y='24' width='80' height='30' rx='6' fill='%231B6B4A'/><rect x='8' y='6' width='48' height='22' rx='5' fill='%231B6B4A'/><circle cx='16' cy='56' r='10' fill='%2314231C'/><circle cx='66' cy='56' r='10' fill='%2314231C'/></g><text x='200' y='210' font-family='sans-serif' font-size='13' fill='%238A9A92' text-anchor='middle'>Sample incident illustration</text></svg>", photoIsSample: true, reporterId: "user_001", reporterName: "Jane Mokoena",
      createdAt: minsAgo(12), forwardedTo: [], forwardedAt: null, resolvedAt: null, resolvedBy: null,
    },
    {
      id: "inc_002", title: "Pedestrian struck near Sandton Drive crossing", type: "Pedestrian Incident",
      priority: "High", status: "Forwarded", location: "Sandton Drive, outside Sandton City",
      latitude: -26.1067, longitude: 28.0538,
      description: "Pedestrian struck by vehicle at signalled crossing. Conscious but unable to stand. Traffic signal reportedly malfunctioning at time of incident.",
      photoUrl: "", reporterId: "user_003", reporterName: "Thandi Khumalo",
      createdAt: minsAgo(38), forwardedTo: ["svc_001", "svc_003"], forwardedAt: minsAgo(30),
      resolvedAt: null, resolvedBy: null,
    },
    {
      id: "inc_003", title: "Minor fender bender, Rivonia Road", type: "Fender Bender",
      priority: "Low", status: "Resolved", location: "Rivonia Road, near Wierda Valley",
      latitude: -26.0989, longitude: 28.0601,
      description: "Two vehicles, minor damage to rear bumper and headlight. Both drivers present, no injuries reported.",
      photoUrl: "", reporterId: "user_002", reporterName: "Sipho Dlamini",
      createdAt: minsAgo(210), forwardedTo: [], forwardedAt: null,
      resolvedAt: minsAgo(180), resolvedBy: "admin_001",
    },
    {
      id: "inc_004", title: "Vehicle rollover, William Nicol Drive", type: "Collision",
      priority: "High", status: "Forwarded", location: "William Nicol Drive, near Fourways Mall",
      latitude: -26.0273, longitude: 28.0106,
      description: "Single vehicle rollover, driver trapped. Airbags deployed. Passenger conscious and out of vehicle.",
      photoUrl: "", reporterId: "user_004", reporterName: "Kwame Asante",
      createdAt: minsAgo(55), forwardedTo: ["svc_002", "svc_005", "svc_006"], forwardedAt: minsAgo(48),
      resolvedAt: null, resolvedBy: null,
    },
    {
      id: "inc_005", title: "Pothole vehicle damage report", type: "Road Hazard",
      priority: "Low", status: "Pending", location: "Katherine Street, Sandown",
      latitude: -26.1021, longitude: 28.0479,
      description: "Large pothole caused tyre blowout. No injuries, hazard remains for other road users.",
      photoUrl: "", reporterId: "user_005", reporterName: "Nandi Zulu",
      createdAt: minsAgo(95), forwardedTo: [], forwardedAt: null, resolvedAt: null, resolvedBy: null,
    },
    {
      id: "inc_006", title: "Traffic light outage causing congestion", type: "Road Hazard",
      priority: "Medium", status: "Pending", location: "Grayston Drive & Katherine Street intersection",
      latitude: -26.1058, longitude: 28.0495,
      description: "Traffic signals down at major intersection, cars self-directing. No collisions yet reported but high risk.",
      photoUrl: "", reporterId: "user_001", reporterName: "Jane Mokoena",
      createdAt: minsAgo(20), forwardedTo: [], forwardedAt: null, resolvedAt: null, resolvedBy: null,
    },
    {
      id: "inc_007", title: "Motorcycle collision, Grayston Drive", type: "Collision",
      priority: "Medium", status: "Resolved", location: "Grayston Drive underpass",
      latitude: -26.1041, longitude: 28.0512,
      description: "Motorcyclist collided with stationary vehicle. Rider sustained leg injury, was conscious and stable on scene.",
      photoUrl: "", reporterId: "user_002", reporterName: "Sipho Dlamini",
      createdAt: minsAgo(320), forwardedTo: ["svc_001"], forwardedAt: minsAgo(315),
      resolvedAt: minsAgo(260), resolvedBy: "admin_001",
    },
    {
      id: "inc_008", title: "Near-miss at unmarked pedestrian crossing", type: "Near Miss",
      priority: "Low", status: "Pending", location: "West Street, Sandton CBD",
      latitude: -26.1089, longitude: 28.0553,
      description: "Pedestrian nearly struck at unmarked crossing during peak traffic. No contact made, reporting as a hazard for review.",
      photoUrl: "", reporterId: "user_003", reporterName: "Thandi Khumalo",
      createdAt: minsAgo(140), forwardedTo: [], forwardedAt: null, resolvedAt: null, resolvedBy: null,
    },
  ];

  // ---- Dispatch log (matches the already-forwarded incidents above) --------
  data.dispatchLog = [
    { id: "disp_001", incidentId: "inc_002", serviceId: "svc_001", serviceName: "Netcare 911", forwardedBy: "admin_001", forwardedAt: minsAgo(30), notes: "Pedestrian injury, priority response requested" },
    { id: "disp_002", incidentId: "inc_002", serviceId: "svc_003", serviceName: "SAPS Sandton", forwardedBy: "admin_001", forwardedAt: minsAgo(30), notes: "Traffic signal fault to be logged" },
    { id: "disp_003", incidentId: "inc_004", serviceId: "svc_002", serviceName: "ER24", forwardedBy: "admin_001", forwardedAt: minsAgo(48), notes: "Trapped occupant, jaws of life may be required" },
    { id: "disp_004", incidentId: "inc_004", serviceId: "svc_005", serviceName: "Johannesburg Fire & Rescue — Station 1", forwardedBy: "admin_001", forwardedAt: minsAgo(48), notes: "Extraction support" },
    { id: "disp_005", incidentId: "inc_004", serviceId: "svc_006", serviceName: "AA Towing Sandton", forwardedBy: "admin_001", forwardedAt: minsAgo(48), notes: "Vehicle recovery once scene cleared" },
    { id: "disp_006", incidentId: "inc_007", serviceId: "svc_001", serviceName: "Netcare 911", forwardedBy: "admin_001", forwardedAt: minsAgo(315), notes: "" },
  ];

  // ---- Notifications ---------------------------------------------------------
  data.notifications = [
    { id: "notif_001", type: "new_incident", incidentId: "inc_001", message: "New High priority incident: Multi-vehicle collision on N1 Northbound", read: false, createdAt: minsAgo(12) },
    { id: "notif_002", type: "new_incident", incidentId: "inc_006", message: "New Medium priority incident: Traffic light outage causing congestion", read: false, createdAt: minsAgo(20) },
    { id: "notif_003", type: "new_incident", incidentId: "inc_005", message: "New Low priority incident: Pothole vehicle damage report", read: true, createdAt: minsAgo(95) },
  ];

    // ---- Additional records so every table holds at least ten ---------------
  data.users.push(
    { id: "user_006", fullName: "Lerato Molefe", email: "lerato.m@example.com", phone: "072 330 4418", createdAt: "2026-06-22T10:10:00Z",
      idNumber: "9008140456087", age: "36", gender: "Female", weightKg: "66", heightCm: "168", bloodType: "A-",
      medicalAidProvider: "Discovery Health", medicalAidNumber: "DH-55410298", preferredHospital: "Netcare Linksfield Hospital",
      allergiesOrConditions: "None", chronicConditions: "None", currentMedications: "None",
      emergencyContactName: "Kabelo Molefe", emergencyContactPhone: "072 118 6620", safetyScore: 82 },
    { id: "user_007", fullName: "Johan van der Merwe", email: "johan.vdm@example.com", phone: "082 667 1204", createdAt: "2026-06-25T13:30:00Z",
      idNumber: "7804255100081", age: "48", gender: "Male", weightKg: "95", heightCm: "185", bloodType: "B-",
      medicalAidProvider: "Bonitas", medicalAidNumber: "BN-60229187", preferredHospital: "Life Fourways Hospital",
      allergiesOrConditions: "Aspirin", chronicConditions: "High cholesterol", currentMedications: "Atorvastatin",
      emergencyContactName: "Marlene van der Merwe", emergencyContactPhone: "082 440 9915", safetyScore: 71 },
    { id: "user_008", fullName: "Ayesha Patel", email: "ayesha.p@example.com", phone: "073 912 5540", createdAt: "2026-06-28T09:45:00Z",
      idNumber: "0101180622083", age: "25", gender: "Female", weightKg: "55", heightCm: "160", bloodType: "O+",
      medicalAidProvider: "None / Not on a medical aid", medicalAidNumber: "", preferredHospital: "Charlotte Maxeke Johannesburg Academic Hospital",
      allergiesOrConditions: "Bee stings", chronicConditions: "None", currentMedications: "None",
      emergencyContactName: "Imran Patel", emergencyContactPhone: "073 220 7781", safetyScore: 93 },
    { id: "user_009", fullName: "Themba Ndlovu", email: "themba.n@example.com", phone: "081 205 6673", createdAt: "2026-07-02T15:20:00Z",
      idNumber: "8209165900084", age: "44", gender: "Male", weightKg: "88", heightCm: "176", bloodType: "AB-",
      medicalAidProvider: "Momentum Health", medicalAidNumber: "MH-88213340", preferredHospital: "Netcare Milpark Hospital",
      allergiesOrConditions: "None", chronicConditions: "Epilepsy", currentMedications: "Lamotrigine",
      emergencyContactName: "Zanele Ndlovu", emergencyContactPhone: "081 773 2290", safetyScore: 79 },
    { id: "user_010", fullName: "Chloe Naidoo", email: "chloe.n@example.com", phone: "076 558 3092", createdAt: "2026-07-05T11:00:00Z",
      idNumber: "0306210234080", age: "23", gender: "Female", weightKg: "60", heightCm: "171", bloodType: "A+",
      medicalAidProvider: "GEMS", medicalAidNumber: "GM-21094455", preferredHospital: "Sandton Mediclinic",
      allergiesOrConditions: "Peanuts", chronicConditions: "None", currentMedications: "None",
      emergencyContactName: "Devan Naidoo", emergencyContactPhone: "076 301 8847", safetyScore: 90 }
  );

  data.contractedServices.push(
    { id: "svc_009", name: "Life Fourways Hospital", serviceType: "Hospital", phone: "011 875 1000", email: "", address: "Cedar Road, Fourways", notes: "Emergency unit open 24 hours", active: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "svc_010", name: "Midrand Tow & Recovery", serviceType: "Towing", phone: "082 331 0042", email: "dispatch@midrandtow.co.za", address: "Midrand", notes: "Heavy vehicle recovery", active: true, createdAt: "2026-05-01T00:00:00Z" }
  );

  data.incidents.push(
    { id: "inc_009", title: "Taxi and bakkie collision, Bryanston Drive", type: "Collision",
      priority: "High", status: "Forwarded", location: "Bryanston Drive, near Ballyoaks Office Park",
      latitude: -26.0568, longitude: 28.0207,
      description: "Minibus taxi and bakkie collided at the intersection. Several passengers injured, one unresponsive. Fuel leak reported.",
      photoUrl: "", reporterId: "user_006", reporterName: "Lerato Molefe",
      createdAt: minsAgo(75), forwardedTo: ["svc_001", "svc_003"], forwardedAt: minsAgo(70), autoForwarded: true,
      resolvedAt: null, resolvedBy: null },
    { id: "inc_010", title: "Truck breakdown blocking left lane, M1 North", type: "Breakdown",
      priority: "Medium", status: "Forwarded", location: "M1 North, before the Corlett Drive off-ramp",
      latitude: -26.1345, longitude: 28.0505,
      description: "Heavy truck broke down in the left lane with hazards on. No injuries. Traffic building up behind it.",
      photoUrl: "", reporterId: "user_007", reporterName: "Johan van der Merwe",
      createdAt: minsAgo(165), forwardedTo: ["svc_004", "svc_010"], forwardedAt: minsAgo(150),
      resolvedAt: null, resolvedBy: null }
  );

  data.dispatchLog.push(
    { id: "disp_007", incidentId: "inc_009", serviceId: "svc_001", serviceName: "Netcare 911", forwardedBy: "ai_triage", forwardedAt: minsAgo(70), notes: "Auto-dispatched by AI triage" },
    { id: "disp_008", incidentId: "inc_009", serviceId: "svc_003", serviceName: "SAPS Sandton", forwardedBy: "ai_triage", forwardedAt: minsAgo(70), notes: "Auto-dispatched by AI triage" },
    { id: "disp_009", incidentId: "inc_010", serviceId: "svc_004", serviceName: "JMPD Traffic \u2014 Region E", forwardedBy: "admin_001", forwardedAt: minsAgo(150), notes: "Traffic control for the blocked lane" },
    { id: "disp_010", incidentId: "inc_010", serviceId: "svc_010", serviceName: "Midrand Tow & Recovery", forwardedBy: "admin_001", forwardedAt: minsAgo(150), notes: "Heavy vehicle recovery" }
  );

  data.notifications.push(
    { id: "notif_004", type: "new_incident", incidentId: "inc_002", message: "New High priority incident: Pedestrian struck near Sandton Drive crossing", read: true, createdAt: minsAgo(38) },
    { id: "notif_005", type: "new_incident", incidentId: "inc_004", message: "New High priority incident: Vehicle rollover, William Nicol Drive", read: true, createdAt: minsAgo(55) },
    { id: "notif_006", type: "new_incident", incidentId: "inc_008", message: "New Low priority incident: Near-miss at unmarked pedestrian crossing", read: true, createdAt: minsAgo(140) },
    { id: "notif_007", type: "new_incident", incidentId: "inc_009", message: "Urgent Collision at Bryanston Drive was auto-dispatched by AI triage to 2 services.", read: false, createdAt: minsAgo(75) },
    { id: "notif_008", type: "new_incident", incidentId: "inc_010", message: "New Medium priority incident: Truck breakdown blocking left lane, M1 North", read: false, createdAt: minsAgo(165) },
    { id: "notif_009", type: "new_incident", incidentId: "inc_003", message: "New Low priority incident: Minor fender bender, Rivonia Road", read: true, createdAt: minsAgo(210) },
    { id: "notif_010", type: "new_incident", incidentId: "inc_007", message: "New Medium priority incident: Motorcycle collision, Grayston Drive", read: true, createdAt: minsAgo(320) }
  );
  return data;
}

const DEMO_COLLECTIONS = ["users", "contractedServices", "incidents", "dispatchLog", "notifications"];

/** Writes the demo data into Firestore (administrators only, enforced by the security rules). */
async function seedDemoData() {
  const data = buildDemoData();
  for (const name of DEMO_COLLECTIONS) {
    await Store.setMany(name, data[name]);
  }
}

/** True while any demo table still holds fewer than ten records. */
async function demoDataNeeded() {
  for (const name of DEMO_COLLECTIONS) {
    const records = await Store.getAll(name);
    if (records.length < 10) return true;
  }
  return false;
}
