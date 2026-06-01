export type SecuredMeeting = {
  id: string;
  leadName: string;
  company: string;
  role: string;
  meetingDate: string;
  calendarUrl: string;
};

export const securedMeetings: SecuredMeeting[] = [
  {
    id: "1",
    leadName: "Elena Vasquez",
    company: "Northwind Systems",
    role: "VP Revenue Operations",
    meetingDate: "Jun 4, 2026 · 10:00 AM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "2",
    leadName: "Marcus Chen",
    company: "Helix Analytics",
    role: "Chief Commercial Officer",
    meetingDate: "Jun 6, 2026 · 2:30 PM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "3",
    leadName: "Priya Nair",
    company: "Cartesian Labs",
    role: "Head of Growth",
    meetingDate: "Jun 9, 2026 · 11:15 AM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "4",
    leadName: "James Okonkwo",
    company: "Meridian Capital Partners",
    role: "Managing Director",
    meetingDate: "Jun 11, 2026 · 9:00 AM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "5",
    leadName: "Sofia Lindström",
    company: "Aurora Freight",
    role: "Director of Enterprise Sales",
    meetingDate: "Jun 13, 2026 · 4:00 PM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "6",
    leadName: "David Whitmore",
    company: "Signalpath Security",
    role: "CEO",
    meetingDate: "Jun 17, 2026 · 1:00 PM BST",
    calendarUrl: "https://calendar.google.com/",
  },
  {
    id: "7",
    leadName: "Amara Osei",
    company: "Vertex Compliance",
    role: "COO",
    meetingDate: "Jun 19, 2026 · 3:45 PM BST",
    calendarUrl: "https://calendar.google.com/",
  },
];
