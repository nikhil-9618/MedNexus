/**
 * 100% SYNTHETIC demo data. All names are fictional; any resemblance to
 * real persons is coincidental. Diagnoses/medications are demo strings,
 * not medical advice.
 */

const DEPARTMENTS = [
  { code: 'CARD', name: 'Cardiology', description: 'Heart and vascular care' },
  { code: 'DERM', name: 'Dermatology', description: 'Skin, hair and nail care' },
  { code: 'ORTHO', name: 'Orthopedics', description: 'Bones, joints and muscles' },
  { code: 'PEDIA', name: 'Pediatrics', description: 'Child healthcare' },
  { code: 'GENMED', name: 'General Medicine', description: 'Primary and internal medicine' },
  { code: 'NEURO', name: 'Neurology', description: 'Brain and nervous system' },
];

const DOCTORS = [
  { name: 'Dr. Ananya Reddy', email: 'doctor@mednexus.demo', specialization: 'General Physician', department: 'General Medicine', experience: 10, qualification: 'MD (General Medicine)', rating: 4.8, reviewsCount: 212, fee: 90, bio: 'Synthetic profile. Focuses on preventive care and chronic-disease management.', availability: { Mon: ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30'], Tue: ['09:00','09:30','10:00','10:30','11:00'], Wed: ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30'], Thu: ['09:00','09:30','10:00','10:30','11:00'], Fri: ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00'], Sat: ['09:00','09:30','10:00'] } },
  { name: 'Dr. Rohan Mehta', email: 'rohan.mehta@mednexus.demo', specialization: 'Cardiology', department: 'Cardiology', experience: 12, qualification: 'MD, DM (Cardiology)', rating: 4.6, reviewsCount: 154, fee: 70, bio: 'Synthetic profile. Preventive cardiac care and hypertension management.', availability: { Mon: ['10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00'], Wed: ['10:00','10:30','11:00','11:30','12:00'], Fri: ['10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00'], Sat: ['10:00','10:30','11:00'] } },
  { name: 'Dr. Sneha Kapoor', email: 'sneha.kapoor@mednexus.demo', specialization: 'Dermatology', department: 'Dermatology', experience: 8, qualification: 'MD (Dermatology)', rating: 4.9, reviewsCount: 301, fee: 60, bio: 'Synthetic profile. Medical dermatology, skin cancer screening and cosmetic consults.', availability: { Mon: ['09:00','09:30','10:00','11:00','11:30'], Tue: ['09:00','09:30','10:00','11:00','11:30'], Wed: ['09:00','09:30','10:00','11:00','11:30','14:00'], Thu: ['09:00','09:30','10:00','11:00','11:30'], Fri: ['09:00','09:30','10:00','11:00','11:30','14:00'], Sat: ['09:00','09:30','10:00','11:00'] } },
  { name: 'Dr. Arjun Kapoor', email: 'arjun.kapoor@mednexus.demo', specialization: 'Orthopedics', department: 'Orthopedics', experience: 15, qualification: 'MS (Orthopedics)', rating: 4.7, reviewsCount: 189, fee: 100, bio: 'Synthetic profile. Sports injuries, joint replacement and fracture care.', availability: { Tue: ['09:00','09:30','10:00','10:30','14:00','14:30','15:00','15:30'], Thu: ['09:00','09:30','10:00','10:30','14:00','14:30','15:00','15:30'], Sat: ['09:00','09:30','10:00','10:30','11:00'] } },
  { name: 'Dr. Meera Iyer', email: 'meera.iyer@mednexus.demo', specialization: 'General Medicine', department: 'General Medicine', experience: 9, qualification: 'MD (Internal Medicine)', rating: 4.5, reviewsCount: 143, fee: 50, bio: 'Synthetic profile. Diabetes, thyroid and lifestyle-related conditions.', availability: { Mon: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00'], Tue: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00'], Wed: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00'], Thu: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00'], Fri: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00'], Sat: ['09:00','09:30','10:00'] } },
  { name: 'Dr. Kabir Singh', email: 'kabir.singh@mednexus.demo', specialization: 'Neurology', department: 'Neurology', experience: 14, qualification: 'DM (Neurology)', rating: 4.8, reviewsCount: 176, fee: 110, bio: 'Synthetic profile. Headache medicine, epilepsy and stroke rehabilitation.', availability: { Mon: ['10:00','10:30','11:00','11:30'], Wed: ['10:00','10:30','11:00','11:30','14:00','14:30'], Fri: ['10:00','10:30','11:00','11:30','14:00','14:30'] } },
  { name: 'Dr. Sara Thomas', email: 'sara.thomas@mednexus.demo', specialization: 'ENT', department: 'General Medicine', experience: 7, qualification: 'MS (ENT)', rating: 4.4, reviewsCount: 98, fee: 55, bio: 'Synthetic profile. Sinus disorders, hearing evaluation and tonsil care.', availability: { Tue: ['10:00','10:30','11:00','11:30','12:00'], Thu: ['10:00','10:30','11:00','11:30','12:00'], Sat: ['10:00','10:30','11:00','11:30'] } },
  { name: 'Dr. Vikram Rao', email: 'vikram.rao@mednexus.demo', specialization: 'Ophthalmology', department: 'General Medicine', experience: 11, qualification: 'MS (Ophthalmology)', rating: 4.6, reviewsCount: 132, fee: 65, bio: 'Synthetic profile. Cataract surgery, refractive errors and diabetic eye care.', availability: { Mon: ['09:30','10:00','10:30','11:00','14:00','14:30'], Wed: ['09:30','10:00','10:30','11:00','14:00','14:30'], Fri: ['09:30','10:00','10:30','11:00','14:00','14:30'] } },
];

const PATIENTS = [
  { name: 'Priya Sharma', email: 'patient@mednexus.demo', phone: '+91 98765 43210', dob: '1998-03-15', gender: 'Female', bloodGroup: 'O+', address: '123 Green Park, Bangalore, Karnataka - 560001' },
  { name: 'Diya Sharma', email: 'diya.sharma@example.demo', phone: '+1-555-0102', dob: '1985-09-25', gender: 'Female', bloodGroup: 'A+', address: '14 Cedar Lane, Riverside' },
  { name: 'Ishaan Verma', email: 'ishaan.verma@example.demo', phone: '+1-555-0103', dob: '1978-01-30', gender: 'Male', bloodGroup: 'B+', address: '8 Birch Avenue, Lakeside' },
  { name: 'Ananya Singh', email: 'ananya.singh@example.demo', phone: '+1-555-0104', dob: '1995-11-08', gender: 'Female', bloodGroup: 'AB+', address: '77 Oak Road, Hillcrest' },
  { name: 'Kabir Malhotra', email: 'kabir.malhotra@example.demo', phone: '+1-555-0105', dob: '2001-06-17', gender: 'Male', bloodGroup: 'O-', address: '5 Pine Court, Brookfield' },
  { name: 'Myra Kapoor', email: 'myra.kapoor@example.demo', phone: '+1-555-0106', dob: '1968-03-03', gender: 'Female', bloodGroup: 'A-', address: '31 Elm Street, Fairview' },
  { name: 'Vihaan Gupta', email: 'vihaan.gupta@example.demo', phone: '+1-555-0107', dob: '1992-07-21', gender: 'Male', bloodGroup: 'B-', address: '9 Willow Way, Greenfield' },
  { name: 'Saanvi Reddy', email: 'saanvi.reddy@example.demo', phone: '+1-555-0108', dob: '1988-12-02', gender: 'Female', bloodGroup: 'O+', address: '120 Aspen Drive, Milan' },
  { name: 'Advait Joshi', email: 'advait.joshi@example.demo', phone: '+1-555-0109', dob: '1975-05-19', gender: 'Male', bloodGroup: 'A+', address: '43 Cherry Blvd, Newtown' },
  { name: 'Kiara Menon', email: 'kiara.menon@example.demo', phone: '+1-555-0110', dob: '1999-02-14', gender: 'Female', bloodGroup: 'AB-', address: '16 Poplar Close, Easton' },
  { name: 'Reyansh Khan', email: 'reyansh.khan@example.demo', phone: '+1-555-0111', dob: '1983-08-09', gender: 'Male', bloodGroup: 'O+', address: '88 Sycamore Ave, Weston' },
  { name: 'Aadhya Iyer', email: 'aadhya.iyer@example.demo', phone: '+1-555-0112', dob: '1993-10-27', gender: 'Female', bloodGroup: 'A+', address: '3 Chestnut St, Brookhaven' },
  { name: 'Arnav Desai', email: 'arnav.desai@example.demo', phone: '+1-555-0113', dob: '1970-09-01', gender: 'Male', bloodGroup: 'B+', address: '59 Dogwood Rd, Kingsport' },
  { name: 'Pari Kulkarni', email: 'pari.kulkarni@example.demo', phone: '+1-555-0114', dob: '1997-04-05', gender: 'Female', bloodGroup: 'O-', address: '21 Magnolia Ave, Riverton' },
  { name: 'Dhruv Saxena', email: 'dhruv.saxena@example.demo', phone: '+1-555-0115', dob: '1986-06-23', gender: 'Male', bloodGroup: 'A-', address: '70 Juniper Lane, Oakdale' },
  { name: 'Navya Pillai', email: 'navya.pillai@example.demo', phone: '+1-555-0116', dob: '1991-01-16', gender: 'Female', bloodGroup: 'B+', address: '37 Hawthorn St, Ashford' },
  { name: 'Yash Thakur', email: 'yash.thakur@example.demo', phone: '+1-555-0117', dob: '1980-11-11', gender: 'Male', bloodGroup: 'AB+', address: '11 Cypress Dr, Summerton' },
  { name: 'Tara Bose', email: 'tara.bose@example.demo', phone: '+1-555-0118', dob: '1994-03-28', gender: 'Female', bloodGroup: 'O+', address: '64 Laurel Blvd, Clarksville' },
  { name: 'Kian Chawla', email: 'kian.chawla@example.demo', phone: '+1-555-0119', dob: '2003-07-07', gender: 'Male', bloodGroup: 'A+', address: '28 Chestnut Ct, Milton' },
  { name: 'Zara Mishra', email: 'zara.mishra@example.demo', phone: '+1-555-0120', dob: '1989-09-15', gender: 'Female', bloodGroup: 'B-', address: '52 Palm Ave, Georgetown' },
  { name: 'Neel Rana', email: 'neel.rana@example.demo', phone: '+1-555-0121', dob: '1976-02-26', gender: 'Male', bloodGroup: 'O+', address: '7 Redwood Rd, Lakewood' },
  { name: 'Ira Chatterjee', email: 'ira.chatterjee@example.demo', phone: '+1-555-0122', dob: '1996-08-30', gender: 'Female', bloodGroup: 'AB+', address: '19 Cedar Way, Brentwood' },
];

const REASONS = [
  'Routine annual check-up',
  'Follow-up on previous consultation',
  'Skin irritation on hands',
  'Child vaccination reminder visit',
  'Recurring headaches evaluation',
  'Knee pain after exercise',
  'Blood pressure review',
  'Seasonal allergy flare-up',
  'Eye strain and blurred vision',
  'Thyroid function review',
  'Back pain consultation',
  'General weakness and fatigue',
];

const DIAGNOSES = [
  { category: 'history', diagnosis: 'Seasonal Allergy', prescription: 'Dummy Medication A — 1 tablet daily for 5 days (synthetic)', notes: 'Synthetic test consultation. Advised rest and hydration.' },
  { category: 'prescription', diagnosis: 'Mild Hypertension (synthetic)', prescription: 'Dummy Medication B — as per synthetic schedule', notes: 'Demo record only. Follow-up in 4 weeks (synthetic guidance).' },
  { category: 'prescription', diagnosis: 'Contact Dermatitis (demo)', prescription: 'Dummy Topical Cream C — twice daily', notes: 'Synthetic case for demonstration purposes.' },
  { category: 'lab', diagnosis: 'Vitamin D Deficiency (sample)', prescription: 'Dummy Supplement D — weekly', notes: 'Synthetic lab panel: 25-OH Vitamin D 18 ng/mL (demo value).' },
  { category: 'lab', diagnosis: 'Complete Blood Count (demo panel)', prescription: 'None', notes: 'Synthetic CBC: Hb 13.2 g/dL, WBC 6.1k, Platelets 2.4L — all within demo normal range.' },
  { category: 'lab', diagnosis: 'Chest X-Ray (demo imaging)', prescription: 'None', notes: 'Synthetic imaging report: lungs clear, no abnormalities (demo).' },
  { category: 'note', diagnosis: 'Tension Headache (example)', prescription: 'None — lifestyle guidance (demo)', notes: 'Synthetic consultation record.' },
  { category: 'history', diagnosis: 'Routine Wellness Visit', prescription: 'None', notes: 'No findings. Synthetic record for demo.' },
  { category: 'prescription', diagnosis: 'Knee Strain (demo case)', prescription: 'Dummy Analgesic E — if needed', notes: 'Example physiotherapy referral noted (synthetic).' },
  { category: 'prescription', diagnosis: 'Acid Reflux (sample)', prescription: 'Dummy Antacid F — before meals', notes: 'Synthetic dietary advice recorded for demo.' },
  { category: 'note', diagnosis: 'Lifestyle Counselling (demo)', prescription: 'None', notes: 'Synthetic note: discussed sleep hygiene and hydration goals (demo only).' },
  { category: 'note', diagnosis: 'Follow-up Note (demo)', prescription: 'None', notes: 'Synthetic progress note: symptoms improving, continue current plan (demo).' },
];

module.exports = { DEPARTMENTS, DOCTORS, PATIENTS, REASONS, DIAGNOSES };
