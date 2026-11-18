import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  FileText,
  Laptop,
  Search,
  ShieldCheck,
  Ticket,
  Wifi,
} from 'lucide-react'
import { Button, Card, Input, cx } from '../components/ui'
import { SupportAgentFigure } from '../components/SupportAgentFigure'

const faqItems = [
  {
    category: 'Tickets',
    question: 'How do I create a support ticket?',
    answer: 'Open Tickets and select Create Ticket. Add a short title, describe what happened, and complete the required SLA ID. Your reporter account is filled in automatically. Add a device, project, or landmark when it helps the support team investigate.',
  },
  {
    category: 'Tickets',
    question: 'What information should I include?',
    answer: 'Describe the issue, when it started, who or what is affected, and the steps that reproduce it. Include any error message and the relevant device or location. Avoid putting passwords, access tokens, or other secrets in a ticket.',
  },
  {
    category: 'Tickets',
    question: 'How can I check my ticket status?',
    answer: 'Open Tickets to see ticket status, priority, assignment, and SLA indicator. Select a ticket to view its details, assignment history, audit trail, and attachments.',
  },
  {
    category: 'Tickets',
    question: 'Can I add a file to my ticket?',
    answer: 'Yes. Open the ticket, go to Attachments, choose a file, optionally add a description, and select Upload. Files already attached to the ticket can be downloaded from the same tab.',
  },
  {
    category: 'Tickets',
    question: 'What do the ticket statuses mean?',
    answer: 'Open means the ticket is awaiting work. Assigned means it has an owner. Escalated means it has been raised for additional attention. Resolved means a resolution was recorded; Closed means the ticket was closed.',
  },
  {
    category: 'Tickets',
    question: 'What is the difference between an incident and a service request?',
    answer: 'An incident reports an interruption or problem with an existing service. A service request asks for something new or a routine action, such as access, an installation, or equipment. Choose the closest available ticket type when creating a ticket.',
  },
  {
    category: 'SLA & Priority',
    question: 'What does SLA mean?',
    answer: 'An SLA (Service Level Agreement) defines the target time for handling or resolving a request. The ticket shows its SLA status when that information is provided by the service.',
  },
  {
    category: 'SLA & Priority',
    question: 'What should I do if a ticket is marked SLA breached?',
    answer: 'The breach flag means the ticket service has marked its SLA as missed. Check the ticket details and contact your support administrator if you believe the SLA or ticket data is incorrect.',
  },
  {
    category: 'SLA & Priority',
    question: 'How should I choose a priority?',
    answer: 'Choose Critical for a severe, widespread outage; High for major impact or an urgent blocker; Medium for normal work; and Low for a minor issue with a workaround. The support team may adjust priority after reviewing impact.',
  },
  {
    category: 'Devices & Assets',
    question: 'How do I link a device to a ticket?',
    answer: 'When creating or editing a ticket, choose the relevant device from the Device name dropdown. Device selection is optional. If the device is missing, check with your administrator or asset team.',
  },
  {
    category: 'Devices & Assets',
    question: 'Why can’t I find my device?',
    answer: 'The dropdown only lists devices returned by the device directory. Confirm the device has been registered and is available to your account, then contact your administrator if it is still missing.',
  },
  {
    category: 'Account & Access',
    question: 'I can’t sign in. What can I try?',
    answer: 'Check your username and password, enter the current CAPTCHA, and refresh the CAPTCHA if it is hard to read. If sign-in still fails or your account is locked, contact your administrator.',
  },
  {
    category: 'Account & Access',
    question: 'Why can’t I see a settings page or perform an action?',
    answer: 'Settings and ticket actions are restricted by your assigned role and permissions. Ask your administrator to review your access. Do not share your login credentials with another person.',
  },
  {
    category: 'Approvals & Changes',
    question: 'How does a change request get approved?',
    answer: 'Submit the request using the available change ticket type and include its impact, timing, and any relevant details. An authorized approver can review the ticket and approve or reject it with notes.',
  },
  {
    category: 'Approvals & Changes',
    question: 'How do I request an update on an assigned ticket?',
    answer: 'Open the ticket to check its current status, assignee, and activity history. If more information is needed, add it to the ticket or create a follow-up ticket so the context stays recorded.',
  },
]

const categories = [
  { name: 'Account & Access', description: 'Sign-in, CAPTCHA, and permissions', icon: ShieldCheck, tone: 'blue' },
  { name: 'Tickets', description: 'Create, track, and update requests', icon: Ticket, tone: 'violet' },
  { name: 'SLA & Priority', description: 'Deadlines, urgency, and breaches', icon: CheckCircle2, tone: 'amber' },
  { name: 'Devices & Assets', description: 'Link and find registered devices', icon: Laptop, tone: 'green' },
  { name: 'Approvals & Changes', description: 'Change requests and decisions', icon: Wifi, tone: 'indigo' },
]

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
}

export default function FaqPage() {
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const search = searchText.trim().toLowerCase()

  const filteredFaqs = useMemo(() => faqItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.category === selectedCategory
    const matchesSearch = !search || `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(search)
    return matchesCategory && matchesSearch
  }), [search, selectedCategory])

  return (
    <div className="page-enter space-y-6">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl border border-indigo-200/70 p-5 dark:border-indigo-400/15 sm:p-7 lg:p-9">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Ajeevi HelpDesk · Help center</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How can we help you today?</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-subtle">Find quick answers about tickets, account access, SLAs, and devices—or ask the support team for help.</p>
            <div className="mt-5 flex max-w-2xl gap-2">
              <Input
                icon={<Search className="size-4" />}
                placeholder="Search questions and answers…"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                aria-label="Search FAQs"
              />
              {searchText && <Button variant="outline" onClick={() => setSearchText('')}>Clear</Button>}
            </div>
          </div>
          <SupportAgentFigure className="hidden h-32 w-56 shrink-0 sm:block sm:h-40 sm:w-72 lg:h-48 lg:w-[380px]" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold">Browse by category</h2><p className="mt-1 text-sm text-subtle">Choose a topic to narrow down the answers.</p></div>
          {selectedCategory && <button type="button" onClick={() => setSelectedCategory(null)} className="text-sm font-medium text-brand hover:underline">Show all topics</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {categories.map(({ name, description, icon: Icon, tone }) => {
            const active = selectedCategory === name
            const count = faqItems.filter((item) => item.category === name).length
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedCategory(active ? null : name)}
                aria-pressed={active}
                className={cx(
                  'rounded-2xl border bg-surface p-4 text-left shadow-[0_8px_30px_-22px_rgba(24,36,59,0.28)] transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md',
                  active ? 'border-brand ring-2 ring-brand/15' : 'border-line',
                )}
              >
                <span className={cx('grid size-10 place-items-center rounded-xl', toneClasses[tone])}><Icon className="size-5" /></span>
                <span className="mt-3 block text-sm font-semibold">{name}</span>
                <span className="mt-1 block text-xs leading-5 text-subtle">{description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">{count} answers <ArrowRight className="size-3.5" /></span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
            <div><h2 className="font-semibold">{search || selectedCategory ? 'Matching answers' : 'Popular questions'}</h2><p className="mt-1 text-sm text-subtle">{filteredFaqs.length} helpful {filteredFaqs.length === 1 ? 'answer' : 'answers'}</p></div>
            <BookOpen className="size-5 text-brand" />
          </div>
          <div className="divide-y divide-line">
            {filteredFaqs.map((item, index) => (
              <details key={item.question} className="group px-5">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-sm font-medium marker:hidden hover:text-brand [&::-webkit-details-marker]:hidden">
                  <CircleHelp className="size-4 shrink-0 text-brand" />
                  <span className="flex-1">{item.question}</span>
                  <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-medium text-subtle">{item.category}</span>
                  <span className="text-lg leading-none text-subtle transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-4 pl-7 pr-8 text-sm leading-6 text-subtle">{item.answer}</p>
              </details>
            ))}
            {!filteredFaqs.length && <div className="px-6 py-14 text-center"><Search className="mx-auto size-8 text-subtle" /><p className="mt-3 font-medium">No answers found</p><p className="mt-1 text-sm text-subtle">Try another keyword or choose a different category.</p></div>}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="dashboard-hero border-indigo-200/70 p-5 dark:border-indigo-400/15">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-100 text-brand dark:bg-indigo-500/15"><FileText className="size-5" /></span>
            <h2 className="mt-4 font-semibold">Still need help?</h2>
            <p className="mt-1.5 text-sm leading-6 text-subtle">Create a support ticket and include the details our team needs to investigate.</p>
            <Link to="/tickets/new" className="mt-4 inline-flex"><Button><Ticket className="size-4" />Create a ticket</Button></Link>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Helpful links</h2>
            <div className="mt-3 space-y-1">
              <Link to="/tickets" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-subtle transition hover:bg-soft hover:text-brand">Tickets<ArrowRight className="size-4" /></Link>
              <Link to="/dashboard" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-subtle transition hover:bg-soft hover:text-brand">Dashboard<ArrowRight className="size-4" /></Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
