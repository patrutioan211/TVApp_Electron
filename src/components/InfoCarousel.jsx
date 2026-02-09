import React, { useState, useEffect, useRef } from 'react';

const COOLDOWN_MS = 20 * 1000; // 20 sec for testing (use 5 * 60 * 1000 for production)

const NEW_COLLEAGUES = [
  { name: 'Maria Popescu', role: 'Software Engineer', funFact: 'Loves hiking and board games' },
  { name: 'Andrei Ionescu', role: 'Product Designer', funFact: 'Former jazz pianist' },
  { name: 'Elena Vasilescu', role: 'QA Lead', funFact: 'Runs marathons' },
  { name: 'David Moldovan', role: 'DevOps Engineer', funFact: 'Collects vintage keyboards' },
  { name: 'Raluca Stan', role: 'Frontend Developer', funFact: 'Photography and coffee enthusiast' },
  { name: 'Bogdan Nistor', role: 'Data Analyst', funFact: 'Plays guitar in a band' }
];

const BIRTHDAY_MESSAGES = [
  'Happy birthday! Wishing you a fantastic year ahead!',
  'Have a wonderful birthday and an amazing year!',
  'Cheers to you on your special day!',
  'Wishing you joy and success! Happy birthday!',
  'Hope your day is as great as you are!',
  'Happy birthday from the whole team!'
];

const WORK_ANNIVERSARY_MESSAGES = [
  'Thank you for your dedication. Here\'s to many more years!',
  'We appreciate everything you do. Congratulations!',
  'Proud to have you on the team. Well done!',
  'Thank you and keep up the great work!',
  'Your commitment inspires us all. Cheers!'
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBirthday(month, day) {
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/** Returns the next occurrence of (month, day) on or after refDate (time stripped). */
function nextBirthdayDate(refDate, month, day) {
  const year = refDate.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < refDate) next = new Date(year + 1, month - 1, day);
  return next;
}

/** True if the next occurrence of this birthday is today or in the next 3 days. */
function isBirthdayInNextDays(refDate, month, day) {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const end = new Date(today);
  end.setDate(end.getDate() + 3);
  const next = nextBirthdayDate(today, month, day);
  return next >= today && next <= end;
}

/** Build example birthdays: 4 people with today, today+1, today+2, today+3; 1 with a date far away. */
function getBirthdayExamples(refDate) {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const names = ['Ioana Radu', 'Mihai Stoica', 'Ana Dumitrescu', 'Alexandru Neagu', 'Cristina Enache'];
  const examples = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    examples.push({ name: names[i], month: d.getMonth() + 1, day: d.getDate() });
  }
  examples.push({ name: names[4], month: 6, day: 15 }); // far away, will be filtered out
  return examples;
}

/** Build example work anniversaries: 4 with join date this month (various years), 1 with another month (filtered out). */
function getWorkAnniversaryExamples(refDate) {
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth() + 1; // 1-12
  const names = ['Laura Popa', 'George Mihai', 'Simona Marin', 'Radu Constantinescu', 'Diana Ionescu'];
  const examples = [
    { name: names[0], joinMonth: currentMonth, joinYear: currentYear - 5 },
    { name: names[1], joinMonth: currentMonth, joinYear: currentYear - 3 },
    { name: names[2], joinMonth: currentMonth, joinYear: currentYear - 7 },
    { name: names[3], joinMonth: currentMonth, joinYear: currentYear - 2 },
    { name: names[4], joinMonth: currentMonth === 12 ? 1 : currentMonth + 1, joinYear: currentYear - 4 }
  ];
  return examples;
}

const EMPLOYEE_OF_MONTH_APPRECIATION = [
  'Outstanding contribution this month. Thank you!',
  'Your hard work doesn\'t go unnoticed. Bravo!',
  'Team player and always goes the extra mile.',
  'A true role model. We appreciate you!',
  'Exceptional work. Congratulations!'
];

const EMPLOYEES_OF_MONTH = [
  { name: 'Stefan Preda', job: 'Backend Developer' },
  { name: 'Adina Georgescu', job: 'UX Researcher' },
  { name: 'Vlad Munteanu', job: 'Project Manager' }
];

const JOB_OPENINGS = [
  { title: 'Senior Frontend Developer', team: 'Product' },
  { title: 'Data Engineer', team: 'Analytics' },
  { title: 'Scrum Master', team: 'Engineering' }
];

const EVENTS = [
  { name: 'Team Building', when: 'Apr 12–13' },
  { name: 'Tech Talk: Security', when: 'Apr 15, 14:00' },
  { name: 'Team Lunch', when: 'Apr 18' },
  { name: 'Beer & Pizza Friday', when: 'Apr 19, 17:00' }
];

function AvatarPlaceholder({ name, className = 'w-12 h-12' }) {
  const initial = name.split(' ').map((n) => n[0]).join('').slice(0, 2);
  return (
    <div className={`${className} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0`}>
      {initial}
    </div>
  );
}

function InfoCarousel() {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [cooldownStart, setCooldownStart] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const categories = [
    'new_colleagues',
    'birthdays',
    'work_anniversary',
    'employee_of_month',
    'job_openings',
    'events'
  ];

  const stateRef = useRef({ categoryIndex: 0, itemIndex: 0 });
  stateRef.current = { categoryIndex, itemIndex };

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const e = now - cooldownStart;
      setElapsed(e);
      if (e >= COOLDOWN_MS) {
        const { categoryIndex: cat, itemIndex: item } = stateRef.current;
        const nowDate = new Date();
        const upcomingB = getBirthdayExamples(nowDate).filter((b) => isBirthdayInNextDays(nowDate, b.month, b.day));
        const currentMonth = nowDate.getMonth() + 1;
        const currentYear = nowDate.getFullYear();
        const upcomingW = getWorkAnniversaryExamples(nowDate)
          .filter((p) => p.joinMonth === currentMonth)
          .map((p) => ({ ...p, years: currentYear - p.joinYear }));
        const pageCounts = [
          Math.ceil(NEW_COLLEAGUES.length / 2),
          upcomingB.length === 0 ? 0 : Math.ceil(upcomingB.length / 2),
          upcomingW.length === 0 ? 0 : Math.ceil(upcomingW.length / 2),
          Math.ceil(EMPLOYEES_OF_MONTH.length / 2),
          Math.ceil(JOB_OPENINGS.length / 2),
          Math.ceil(EVENTS.length / 2)
        ];
        const pages = pageCounts[cat] || 0;
        if (pages > 0 && item + 1 < pages) {
          setItemIndex(item + 1);
        } else {
          setCategoryIndex((i) => (i + 1) % categories.length);
          setItemIndex(0);
        }
        setCooldownStart(now);
        setElapsed(0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownStart]);

  const cooldownPercent = Math.max(0, Math.min(100, 100 - (elapsed / COOLDOWN_MS) * 100));
  const now = new Date();
  const allBirthdays = getBirthdayExamples(now);
  const upcomingBirthdays = allBirthdays.filter((b) => isBirthdayInNextDays(now, b.month, b.day));
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const allWorkAnniversaries = getWorkAnniversaryExamples(now);
  const upcomingWorkAnniversaries = allWorkAnniversaries
    .filter((p) => p.joinMonth === currentMonth)
    .map((p) => ({ ...p, years: currentYear - p.joinYear }));
  const categoryLabel = {
    new_colleagues: 'New colleagues',
    birthdays: 'Birthdays',
    work_anniversary: 'Work anniversary',
    employee_of_month: 'Employee of the month',
    job_openings: 'Job openings',
    events: 'Events'
  }[categories[categoryIndex]];

  const renderContent = () => {
    switch (categories[categoryIndex]) {
      case 'new_colleagues': {
        const take = 2;
        const start = (itemIndex * take) % NEW_COLLEAGUES.length;
        const items = [NEW_COLLEAGUES[start % NEW_COLLEAGUES.length], NEW_COLLEAGUES[(start + 1) % NEW_COLLEAGUES.length]];
        return (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                <AvatarPlaceholder name={p.name} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-600">{p.role}</p>
                  <p className="text-xs text-gray-500 italic mt-0.5">{p.funFact}</p>
                  <p className="text-xs text-accent font-medium mt-1">Good luck!</p>
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'birthdays': {
        if (upcomingBirthdays.length === 0) {
          return (
            <p className="text-sm text-gray-500 py-2">No birthdays in the next few days.</p>
          );
        }
        const start = (itemIndex * 2) % upcomingBirthdays.length;
        const items = upcomingBirthdays.length >= 2
          ? [upcomingBirthdays[start], upcomingBirthdays[(start + 1) % upcomingBirthdays.length]]
          : [upcomingBirthdays[start]];
        return (
          <div className="space-y-3">
            {items.map((person, i) => {
              const msgIdx = (categoryIndex + itemIndex + start + i) % BIRTHDAY_MESSAGES.length;
              const msg = BIRTHDAY_MESSAGES[msgIdx];
              return (
                <div key={person.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <AvatarPlaceholder name={person.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                    <p className="text-xs text-gray-600">Birthday: {formatBirthday(person.month, person.day)}</p>
                    <p className="text-xs text-gray-700 mt-1">{msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'work_anniversary': {
        if (upcomingWorkAnniversaries.length === 0) {
          return (
            <p className="text-sm text-gray-500 py-2">No work anniversaries this month.</p>
          );
        }
        const start = (itemIndex * 2) % upcomingWorkAnniversaries.length;
        const items = upcomingWorkAnniversaries.length >= 2
          ? [upcomingWorkAnniversaries[start], upcomingWorkAnniversaries[(start + 1) % upcomingWorkAnniversaries.length]]
          : [upcomingWorkAnniversaries[start]];
        return (
          <div className="space-y-3">
            {items.map((person, i) => {
              const msgIdx = (categoryIndex + itemIndex + start + i) % WORK_ANNIVERSARY_MESSAGES.length;
              const msg = WORK_ANNIVERSARY_MESSAGES[msgIdx];
              return (
                <div key={person.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <AvatarPlaceholder name={person.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                    <p className="text-xs text-gray-600">{person.years} years in the company this month</p>
                    <p className="text-xs text-gray-700 mt-1">{msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'employee_of_month': {
        const start = (itemIndex * 2) % EMPLOYEES_OF_MONTH.length;
        const items = [EMPLOYEES_OF_MONTH[start], EMPLOYEES_OF_MONTH[(start + 1) % EMPLOYEES_OF_MONTH.length]];
        return (
          <div className="space-y-3">
            {items.map((person, i) => {
              const msgIdx = (categoryIndex + itemIndex + start + i) % EMPLOYEE_OF_MONTH_APPRECIATION.length;
              const msg = EMPLOYEE_OF_MONTH_APPRECIATION[msgIdx];
              return (
                <div key={person.name} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <AvatarPlaceholder name={person.name} className="w-12 h-12" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                    <p className="text-xs text-gray-600">{person.job}</p>
                    <p className="text-xs text-amber-800 mt-1">{msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'job_openings': {
        const start = (itemIndex * 2) % JOB_OPENINGS.length;
        const items = [JOB_OPENINGS[start], JOB_OPENINGS[(start + 1) % JOB_OPENINGS.length]];
        return (
          <div className="space-y-2">
            {items.map((j) => (
              <div key={j.title} className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{j.title}</p>
                <p className="text-xs text-gray-600">{j.team}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'events': {
        const start = (itemIndex * 2) % EVENTS.length;
        const items = [EVENTS[start % EVENTS.length], EVENTS[(start + 1) % EVENTS.length]];
        return (
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.name + e.when} className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                <p className="text-xs text-gray-600">{e.when}</p>
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-gray-600">{categoryLabel}</span>
        <span className="text-[0.6rem] text-gray-400 tabular-nums">{Math.ceil((COOLDOWN_MS - elapsed) / 1000)}s</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${cooldownPercent}%` }}
        />
      </div>
      <div className="min-h-[7rem]">
        {renderContent()}
      </div>
    </div>
  );
}

export default InfoCarousel;
