"use client";

import Link from "next/link";

/**
 * Public marketing landing page shown at "/" for signed-out visitors.
 * Account creation is not open yet, so every "Create Account" control is
 * rendered disabled — sign-in is the only live action.
 */

// ─── tiny inline icon set (no icon dependency) ───────────────────────────────

function Icon({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  hand: "M12 21a9 9 0 0 0 9-9 2 2 0 0 0-4 0 M12 21a9 9 0 0 1-9-9V7a2 2 0 0 1 4 0v5 M7 7V4a2 2 0 0 1 4 0v8 M11 5a2 2 0 0 1 4 0v7 M15 7a2 2 0 0 1 4 0v5",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  chart: "M3 3v18h18 M7 14l4-4 3 3 5-6",
  team: "M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7 M5 20a7 7 0 0 1 14 0 M19 8a2.5 2.5 0 1 0 0-5 M22 15a5 5 0 0 0-3-3.5 M5 8a2.5 2.5 0 1 1 0-5 M2 15a5 5 0 0 1 3-3.5",
  layers: "M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  spark: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z",
  check: "M20 6 9 17l-5-5",
} as const;

// ─── shared bits ──────────────────────────────────────────────────────────────

function CreateAccountButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="Account creation is coming soon — contact us to get started"
      className={`cursor-not-allowed rounded-lg bg-emerald px-5 py-2.5 text-sm font-semibold text-white opacity-60 ${className}`}
    >
      Create Account
    </button>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">{kicker}</p>
      <h2 className="mt-2 text-3xl font-semibold text-emerald md:text-4xl">{title}</h2>
    </div>
  );
}

// ─── decorative hero dashboard preview (pure CSS, no data) ───────────────────

function HeroPreview() {
  const bars = [35, 55, 42, 70, 58, 85, 78];
  return (
    <div className="relative mx-auto w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl shadow-emerald/10">
      <div className="flex items-center gap-2 border-b border-black/5 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
        <span className="font-serif text-lg font-semibold text-emerald">Donorly</span>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald">
          Campaign Dashboard
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Raised", "$126,540"],
          ["Pledged", "$48,200"],
          ["Donors", "1,348"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-cream px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-black/40">{label}</p>
            <p className="text-sm font-bold text-emerald">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-black/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-black/60">Monthly contributions</p>
          <p className="text-[10px] font-semibold text-gold-dark">+18% this quarter</p>
        </div>
        <div className="mt-2 flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-t ${i === bars.length - 2 ? "bg-gold" : "bg-emerald/80"}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          ["New pledge — Building Fund", "$2,500"],
          ["Gala dinner RSVP confirmed", "42 guests"],
        ].map(([text, amount]) => (
          <div key={text} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
            <span className="text-[11px] font-medium text-emerald-dark">{text}</span>
            <span className="text-[11px] font-bold text-emerald">{amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  ["About", "#about"],
  ["Features", "#features"],
  ["How It Works", "#how-it-works"],
  ["Contact", "#contact"],
] as const;

const VALUE_COLUMNS = [
  {
    icon: ICONS.layers,
    title: "Practical",
    body:
      "Manage donors, campaigns, events, pledges, contributions, follow-ups, and reports from one organized platform. " +
      "Reduce manual work, duplicate records, missed commitments, and time spent searching for information.",
  },
  {
    icon: ICONS.heart,
    title: "Emotional",
    body:
      "Every contribution represents trust. Donorly helps organizations honor that trust by staying connected with " +
      "supporters, recognizing their generosity, and showing how their contributions move the mission forward.",
  },
  {
    icon: ICONS.chart,
    title: "Logical",
    body:
      "Better organization leads to better decisions. With structured records, clear reporting, and consistent " +
      "processes, leadership teams can understand progress, identify opportunities, and plan with confidence.",
  },
];

const BENEFITS = [
  {
    icon: ICONS.users,
    title: "Centralized Donor Records",
    body: "Organized donor profiles with contact information, contribution history, communication notes, and engagement details.",
  },
  {
    icon: ICONS.flag,
    title: "Campaign Management",
    body: "Create and manage fundraising campaigns with clear goals, timelines, progress tracking, and responsible team members.",
  },
  {
    icon: ICONS.calendar,
    title: "Event Coordination",
    body: "Organize benefit dinners, fundraising events, community programs, guest lists, invitations, and follow-up activities.",
  },
  {
    icon: ICONS.hand,
    title: "Pledge & Contribution Tracking",
    body: "Track commitments, completed donations, pending balances, payment methods, and campaign allocations.",
  },
  {
    icon: ICONS.message,
    title: "Meaningful Communication",
    body: "Help your team follow up with donors respectfully and consistently, without losing important conversations.",
  },
  {
    icon: ICONS.chart,
    title: "Clear Reporting",
    body: "Give leadership a reliable view of campaign performance, donor participation, contribution progress, and operational needs.",
  },
  {
    icon: ICONS.team,
    title: "Team Collaboration",
    body: "Authorized team members work together with clear roles, responsibilities, and access controls.",
  },
  {
    icon: ICONS.spark,
    title: "Less Administrative Work",
    body: "Replace disconnected spreadsheets and manual processes with a structured system designed for long-term use.",
  },
];

const AUDIENCES = [
  "Nonprofit organizations",
  "Mosques, churches, temples, and religious institutions",
  "Schools and educational organizations",
  "Community centers",
  "Charitable foundations",
  "Social-service organizations",
  "Fundraising committees",
  "Volunteer-led initiatives",
  "Construction and expansion campaigns",
  "Emergency and humanitarian campaigns",
];

const STEPS = [
  {
    title: "Create Your Organization",
    body: "Set up your organization, team members, roles, and fundraising information.",
  },
  {
    title: "Build Your Donor Community",
    body: "Add donors, families, businesses, volunteers, and supporters to one organized directory.",
  },
  {
    title: "Launch Campaigns and Events",
    body: "Create fundraising campaigns, define goals, organize events, and assign responsibilities.",
  },
  {
    title: "Track Progress",
    body: "Monitor contributions, pledges, follow-ups, campaign performance, and outstanding actions.",
  },
  {
    title: "Strengthen Relationships",
    body: "Use reliable donor history and engagement information to communicate thoughtfully and build long-term trust.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-cream text-[#1c2b26]">
      {/* ── top navigation ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-cream/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
          <a href="#top" className="font-serif text-2xl font-bold text-emerald">
            Donorly
          </a>
          <div className="hidden items-center gap-6 text-sm font-medium text-black/60 md:flex">
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href} className="hover:text-emerald">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-emerald px-5 py-2.5 text-sm font-semibold text-emerald hover:bg-emerald-50"
            >
              Log In
            </Link>
            <CreateAccountButton className="hidden sm:block" />
          </div>
        </nav>
      </header>

      {/* ── hero ───────────────────────────────────────────────────────── */}
      <section id="top" className="mx-auto max-w-6xl px-4 pb-16 pt-12 md:px-6 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-emerald md:text-5xl">
              Fundraising Should Bring People Together&#8212;Not Create More Administrative Work
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-black/60 md:text-lg">
              Donorly helps nonprofit organizations, community groups, religious institutions, and
              fundraising teams organize donors, campaigns, events, communications, and contributions
              in one secure and easy-to-use platform.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-black/60">
              Spend less time managing spreadsheets and paperwork&#8212;and more time building
              relationships, strengthening your community, and advancing the mission that matters most.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#features"
                className="rounded-lg bg-emerald px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald/20 hover:bg-emerald-light"
              >
                Start Fundraising Smarter
              </a>
              <Link
                href="/login"
                className="rounded-lg border border-emerald px-6 py-3 text-sm font-semibold text-emerald hover:bg-emerald-50"
              >
                Log In
              </Link>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* ── supporting message ─────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <SectionHeading kicker="Why Donorly" title="Your Mission Deserves Better Tools" />
          <p className="mt-6 text-base leading-relaxed text-black/60">
            Behind every donation is a person who believes in your cause. Behind every campaign is a
            team giving its time, energy, and heart to make a difference. But too often, important
            information is scattered across spreadsheets, messages, emails, payment records, and
            handwritten notes&#8212;creating extra work, missed follow-ups, unclear reporting, and less
            time for meaningful community engagement.
          </p>
          <p className="mt-4 text-base leading-relaxed text-black/60">
            Donorly simplifies that process. It gives organizations a structured and transparent way to
            manage their fundraising activities while keeping donors, volunteers, leadership teams, and
            campaigns connected.
          </p>
        </div>
      </section>

      {/* ── about ──────────────────────────────────────────────────────── */}
      <section id="about" className="py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading kicker="About Donorly" title="Built for Organizations That Serve People" />
          <div className="mx-auto mt-6 max-w-3xl text-center">
            <p className="text-base leading-relaxed text-black/60">
              Donorly is a fundraising and donor-management platform created for organizations that may
              have limited staff, limited technical resources, and growing operational needs. Our goal
              is simple:
            </p>
            <p className="mt-4 font-serif text-xl font-semibold text-emerald">
              Make professional fundraising tools accessible, practical, and easy to use for every
              organization.
            </p>
            <p className="mt-4 text-base leading-relaxed text-black/60">
              Whether you are raising funds for a construction project, community program, educational
              institution, emergency campaign, annual dinner, or charitable initiative, Donorly brings
              your fundraising information into one organized system&#8212;so your team can work from one
              centralized platform instead of switching between spreadsheets, payment records,
              communication tools, and event documents.
            </p>
          </div>

          {/* practical / emotional / logical */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {VALUE_COLUMNS.map(({ icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald">
                  <Icon d={icon} />
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-emerald">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── features ───────────────────────────────────────────────────── */}
      <section id="features" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading
            kicker="Key Benefits"
            title="Everything Your Fundraising Team Needs in One Place"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-black/5 bg-cream p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald shadow-sm">
                  <Icon d={icon} className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-sans text-sm font-bold text-emerald-dark">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-black/55">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── who it's for ───────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <SectionHeading kicker="Who Donorly Is For" title="Designed for Mission-Driven Organizations" />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {AUDIENCES.map((a) => (
              <span
                key={a}
                className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-dark"
              >
                {a}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed text-black/60">
            Whether your organization is managed by a large team or a small group of dedicated
            volunteers, Donorly is designed to help you operate with greater clarity and confidence.
          </p>
        </div>
      </section>

      {/* ── how it works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading kicker="How It Works" title="Simple to Start. Easy to Manage." />
          <ol className="mt-12 grid gap-6 md:grid-cols-5">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="relative rounded-2xl border border-black/5 bg-cream p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald font-serif text-lg font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-sans text-sm font-bold text-emerald-dark">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-black/55">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── trust + vision ─────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2 md:px-6">
          <div className="rounded-2xl border border-emerald-100 bg-white p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald">
              <Icon d={ICONS.shield} />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-emerald">
              Built Around Responsibility and Trust
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-black/60">
              Organizations are trusted with more than donations&#8212;they are trusted with personal
              information, financial records, commitments, and community expectations. Donorly is
              designed with responsible data management, controlled access, organized reporting, and
              transparency in mind. The goal is not only to help organizations raise more funds, but to
              help them manage those funds and relationships with greater accountability.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-dark">
              <Icon d={ICONS.spark} />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-emerald">
              Technology That Supports the Mission&#8212;Not Distracts From It
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-black/60">
              Many organizations have passionate people but limited administrative capacity. Donorly
              exists to close that gap. We believe technology should make fundraising easier, strengthen
              donor relationships, improve transparency, and reduce the burden placed on volunteers and
              staff&#8212;from the first conversation with a supporter to the successful completion of a
              meaningful project.
            </p>
          </div>
        </div>
      </section>

      {/* ── final call to action ───────────────────────────────────────── */}
      <section className="px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-emerald px-8 py-14 text-center shadow-xl shadow-emerald/20">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-white md:text-4xl">
            Focus on Your Mission. Let Donorly Help Organize the Journey.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
            Bring your donors, campaigns, events, contributions, and team activities into one connected
            platform. Build stronger relationships. Improve transparency. Reduce administrative work.
            Create a lasting impact.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled
              title="Account creation is coming soon — contact us to get started"
              className="cursor-not-allowed rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald opacity-70"
            >
              Create Your Donorly Account
            </button>
            <Link
              href="/login"
              className="rounded-lg border border-white/50 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ── footer ─────────────────────────────────────────────────────── */}
      <footer id="contact" className="border-t border-black/5 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="font-serif text-xl font-bold text-emerald">Donorly</p>
            <p className="max-w-2xl text-sm leading-relaxed text-black/50">
              Donorly helps mission-driven organizations manage donors, fundraising campaigns, events,
              contributions, and community relationships through one organized and accessible platform.
            </p>
            <div className="flex gap-6 text-sm font-medium text-black/50">
              <span className="cursor-default">Privacy Policy</span>
              <span className="cursor-default">Terms of Service</span>
              <span className="cursor-default">Contact Us</span>
            </div>
            <p className="text-xs text-black/40">
              &copy; {new Date().getFullYear()} Donorly. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
