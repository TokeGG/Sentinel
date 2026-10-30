// Free courses that give a certificate or badge, in the order a beginner should take them
// (networking -> security basics -> Linux -> vendor fundamentals -> first real cert -> hands-on).
// Added once to an empty-or-not Courses list (skips names already there); links point at each
// provider's own page and were not fetched from here, so check them before relying on the details.
export interface FreeCourse { name: string; provider: string; url: string; total: number; next: string; notes: string }
export const FREE_COURSES: FreeCourse[] = [
  { name: "1. Networking Basics", provider: "Cisco Networking Academy", url: "https://www.netacad.com/courses/networking-basics", total: 10, next: "Module 1: Communication in a connected world", notes: "Free; digital badge on completion. How networks, IP addresses and ports work: the base for everything else." },
  { name: "2. Introduction to Cybersecurity", provider: "Cisco Networking Academy", url: "https://www.netacad.com/courses/introduction-to-cybersecurity", total: 6, next: "Module 1: The need for cybersecurity", notes: "Free; badge. Threats, attacks and how people defend against them." },
  { name: "3. Linux Unhatched", provider: "Cisco Networking Academy / NDG", url: "https://www.netacad.com/courses/linux-unhatched", total: 8, next: "Chapter 1: Introduction", notes: "Free; completion certificate. Basic Linux commands in a browser lab." },
  { name: "4. Fortinet Certified Fundamentals (FCF)", provider: "Fortinet Training Institute", url: "https://training.fortinet.com/", total: 4, next: "Introduction to the Threat Landscape", notes: "Free courses and free exam; Fortinet Certified Fundamentals in Cybersecurity certification." },
  { name: "5. ISC2 Certified in Cybersecurity (CC)", provider: "ISC2", url: "https://www.isc2.org/certifications/cc", total: 5, next: "Domain 1: Security principles", notes: "ISC2 has offered free official training and a free exam voucher (One Million Certified in Cybersecurity); check the page for the current offer. A real entry-level certification." },
  { name: "6. Information Security", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/information-security/", total: 5, next: "Information Security with HelmetJS", notes: "Free certification after the projects. Securing web apps (Node.js) and basic Python pentest scripting." },
  { name: "7. Ethical Hacker", provider: "Cisco Networking Academy", url: "https://www.netacad.com/courses/ethical-hacker", total: 10, next: "Module 1: Introduction to ethical hacking", notes: "Free; badge. Pentest process, tools and reporting with labs: do this one last." },
];

type Raw = { name: string };
/** New course objects for every free course whose name is not already in the list (keeps the order). */
export function missingFree(existing: Raw[]): FreeCourse[] {
  const have = new Set(existing.map((c) => c.name.toLowerCase()));
  return FREE_COURSES.filter((c) => !have.has(c.name.toLowerCase()));
}
