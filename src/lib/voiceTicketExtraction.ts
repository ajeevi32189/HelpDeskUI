export interface VoiceSlaOption {
  id: string
  name: string
  resolutionTimeInMinutes?: number
}

export interface VoiceDeviceOption {
  id: string
  names: string[]
}

export interface VoiceTicketExtraction {
  title?: string
  category?: string
  subCategory?: string
  ticketType?: string
  priority?: string
  severity?: string
  slaId?: string
  deviceId?: string
  projectName?: string
  landmark?: string
  confirmationRequired?: ('category' | 'priority' | 'slaId')[]
}

interface VoiceExtractionOptions {
  slaOptions: VoiceSlaOption[]
  priorityOptions: string[]
  severityOptions: string[]
  ticketTypeOptions: string[]
  categoryOptions?: string[]
  subcategoryOptions?: Record<string, string[]>
  deviceOptions?: VoiceDeviceOption[]
}

const categoryRules: { category: string; keywords: RegExp }[] = [
  { category: 'Hardware', keywords: /\b(laptop|notebook|keyboard|mouse|printer|hardware|device|monitor|screen|computer|desktop|server|charger|battery|headphone|scanner)\b|लैपटॉप|कीबोर्ड|माउस|प्रिंटर|कंप्यूटर|सर्वर/i },
  { category: 'Network', keywords: /\b(wi[\s-]?fi|internet|lan|network|connectivity|connection|router|ethernet|vpn)\b|इंटरनेट|वाई.?फाई|नेटवर्क/i },
  { category: 'Access Management', keywords: /\b(login|log in|sign[\s-]?in|password|account access|account|locked out|user access|permission)\b|लॉग.?इन|पासवर्ड|अकाउंट/i },
  { category: 'Software', keywords: /\b(application|app|software|crash|install|installation|program|outlook|browser|microsoft 365)\b|सॉफ्टवेयर|ऐप|एप्लिकेशन|क्रैश|इंस्टॉल/i },
]

function detectPriority(transcript: string): { value?: string; ambiguous: boolean } {
  const rules = [
    { value: 'Critical', pattern: /\b(critical|urgent|emergency|highest priority|priority critical)\b|बहुत ज़रूरी|बहुत जरूरी|तुरंत|क्रिटिकल/i },
    { value: 'High', pattern: /\b(high[\s-]+priority|priority high)\b|हाई प्रायोरिटी|उच्च प्राथमिकता/i },
    { value: 'Medium', pattern: /\b(medium[\s-]+priority|priority medium)\b|मीडियम प्रायोरिटी|मध्यम प्राथमिकता/i },
    { value: 'Low', pattern: /\b(low[\s-]+priority|priority low)\b|लो प्रायोरिटी|कम प्राथमिकता/i },
  ]
  const matches = rules.filter(({ pattern }) => pattern.test(transcript))
  return matches.length === 1
    ? { value: matches[0].value, ambiguous: false }
    : { ambiguous: matches.length > 1 }
}

function detectSeverity(transcript: string): string | undefined {
  const match = transcript.match(/\bseverity(?:\s+is)?\s+(critical|high|medium|low)\b|गंभीरता\s+(critical|high|medium|low)/i)
  const severity = match?.[1] ?? match?.[2]
  return severity ? severity[0].toUpperCase() + severity.slice(1).toLowerCase() : undefined
}

function detectTicketType(transcript: string): string | undefined {
  if (/\b(work[\s-]?order|maintenance request)\b|वर्क ऑर्डर|मेंटेनेंस रिक्वेस्ट/i.test(transcript)) return 'Work Order'
  if (/\b(service request|request for|please provide|need a new|need access to)\b|सर्विस रिक्वेस्ट|नई सेवा/i.test(transcript)) return 'Service Request'
  if (/\b(change request|change management)\b|चेंज रिक्वेस्ट/i.test(transcript)) return 'ChangeRequest'
  if (/\bmaintenance\b|मेंटेनेंस/i.test(transcript)) return 'Maintenance'
  if (/\b(incident|issue|not working|failure|broken|error)\b|काम नहीं कर|काम नही कर|नहीं चल|नही चल|नहीं हो रहा|नही हो रहा|खराब|समस्या/i.test(transcript)) return 'Incident'
  return undefined
}

function detectSubcategory(transcript: string, category?: string): string | undefined {
  if (!category) return undefined
  const rules: Record<string, { value: string; pattern: RegExp }[]> = {
    Hardware: [
      { value: 'Laptop', pattern: /\b(laptop|notebook)\b/i },
      { value: 'Laptop', pattern: /लैपटॉप/i },
      { value: 'Keyboard', pattern: /\bkeyboard\b|कीबोर्ड/i },
      { value: 'Mouse', pattern: /\bmouse\b|माउस/i },
      { value: 'Printer', pattern: /\bprinter\b|प्रिंटर/i },
      { value: 'Monitor', pattern: /\b(monitor|screen|display)\b/i },
      { value: 'Desktop', pattern: /\b(desktop|computer|pc)\b/i },
      { value: 'Battery', pattern: /\b(battery|charger|charging)\b/i },
      { value: 'Scanner', pattern: /\bscanner\b/i },
    ],
    Network: [
      { value: 'Wi-Fi', pattern: /\bwi[\s-]?fi\b|वाई.?फाई/i },
      { value: 'Internet', pattern: /\binternet\b|इंटरनेट/i },
      { value: 'VPN', pattern: /\bvpn\b/i },
      { value: 'LAN', pattern: /\b(lan|ethernet)\b/i },
      { value: 'Router', pattern: /\brouter\b/i },
    ],
    'Access Management': [
      { value: 'Login', pattern: /\b(login|log in|sign[\s-]?in)\b|लॉग.?इन/i },
      { value: 'Password', pattern: /\bpassword\b|पासवर्ड/i },
      { value: 'Account Access', pattern: /\b(account|locked out|permission)\b/i },
    ],
    Software: [
      { value: 'Installation', pattern: /\b(install|installation)\b|इंस्टॉल/i },
      { value: 'Application Error', pattern: /\b(error|crash|crashing|not opening)\b/i },
      { value: 'Email', pattern: /\b(outlook|email)\b/i },
    ],
  }
  const matches = new Set((rules[category] ?? [])
    .filter(({ pattern }) => pattern.test(transcript))
    .map(({ value }) => value))
  return matches.size === 1 ? [...matches][0] : undefined
}

function makeTitle(transcript: string, category?: string): string | undefined {
  const text = transcript.toLowerCase()
  if (/^(?:(?:create|make|open|raise)\s+(?:a\s+)?(?:ticket|this ticket)|create this ticket)\.?$/i.test(transcript.trim())) return undefined
  if (/\bserver\b/i.test(text) && /\b(not responding|unresponsive|unavailable|not reachable|down|offline|not working)\b/i.test(text)) return 'Server Not Responding'
  if (/\bserver\b/i.test(text) && /\b(slow|timeout|timed out)\b/i.test(text)) return 'Server Performance Issue'
  if (/\b(laptop|computer|device)\b/.test(text) && /\b(not starting|won't start|will not start|not booting|won't boot|not turning on|not powering on)\b/.test(text)) return 'Laptop Not Starting'
  if (/लैपटॉप/i.test(transcript) && /शुरू नहीं|चालू नहीं|स्टार्ट नहीं/i.test(transcript)) return 'Laptop Not Starting'
  if (/\b(laptop|notebook)\b/i.test(text) && /\b(start nahi|nahi start|chalu nahi|on nahi ho|boot nahi)\b/i.test(text)) return 'Laptop Not Starting'
  if (/\b(internet|wi[\s-]?fi|lan|network)\b/.test(text) && /\b(not working|down|disconnected|slow|unavailable|problem|issue|cannot connect|can't connect)\b/.test(text)) return 'Internet Connectivity Issue'
  if (/इंटरनेट|वाई.?फाई|नेटवर्क/i.test(transcript) && /नहीं चल|नही चल|काम नहीं|काम नही/i.test(transcript)) return 'Internet Connectivity Issue'
  if (/\b(internet|wi[\s-]?fi|network)\b/i.test(text) && /\b(nahi chal|nahi kam|not working)\b/i.test(text)) return 'Internet Connectivity Issue'
  if (/\b(login|log in|sign[\s-]?in|password|account access|locked out)\b/.test(text) && /\b(cannot|can't|unable|not working|issue|problem|forgot|reset|locked)\b/.test(text)) return 'Login Issue'
  if (/\b(cannot|can't|unable to)\s+(?:access|open|reach)\s+(?:the\s+)?application\b/i.test(text) || /\bapplication\b[^.?!]*\b(inaccessible|unavailable|not opening)\b/i.test(text)) return 'Application Access Issue'
  if (/लॉग.?इन|पासवर्ड|अकाउंट/i.test(transcript) && /नहीं|नही|भूल|समस्या/i.test(transcript)) return 'Login Issue'
  if (/\b(login|log in|password)\b/i.test(text) && /\b(nahi|nahi ho|forgot|bhool)\b/i.test(text)) return 'Login Issue'
  if (/\b(application|app)\b/.test(text) && /\b(crash|crashing|stops responding|not opening)\b/.test(text)) return 'Application Crash'
  if (/\b(software|application|app)\b/.test(text) && /\b(error|install|installation|not working)\b/.test(text)) return 'Software Issue'
  if (/लैपटॉप|कीबोर्ड|माउस|प्रिंटर|कंप्यूटर/i.test(transcript)) return 'Hardware Issue'
  if (/इंटरनेट|वाई.?फाई|नेटवर्क/i.test(transcript)) return 'Internet Connectivity Issue'
  if (/लॉग.?इन|पासवर्ड|अकाउंट/i.test(transcript)) return 'Login Issue'
  if (/सॉफ्टवेयर|ऐप|एप्लिकेशन/i.test(transcript)) return 'Software Issue'
  if (/\bserver\b/i.test(text)) return 'Server Issue'
  if (/\b(laptop|notebook)\b/i.test(text)) return 'Laptop Issue'
  if (/लैपटॉप/i.test(transcript)) return 'Laptop Issue'
  if (/\b(printer)\b/i.test(text)) return 'Printer Issue'
  if (/\b(keyboard)\b/i.test(text)) return 'Keyboard Issue'
  if (/\b(mouse)\b/i.test(text)) return 'Mouse Issue'
  if (/\b(wi[\s-]?fi|internet|network|router|vpn)\b/i.test(text)) return 'Network Connectivity Issue'
  if (category) return `${category} Issue`

  const concise = transcript
    .replace(/\b(please|help me|i have|i am having|i'm having|i need|i want|there is|there's|my|the|a|an|can you|could you|create a ticket for|create this ticket|create ticket)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ')
  return concise ? concise.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) : undefined
}

function configuredValue(value: string | undefined, options: string[]): string | undefined {
  if (!value) return undefined
  return options.find((option) => option.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase())
}

function suggestSlaId(priority: string | undefined, options: VoiceSlaOption[]): string | undefined {
  if (!priority) return undefined
  const expected = priority === 'Critical'
    ? (option: VoiceSlaOption) => /critical|urgent|1\s*hour/i.test(option.name) || option.resolutionTimeInMinutes === 60
    : priority === 'High'
      ? (option: VoiceSlaOption) => /high|4\s*business\s*hours/i.test(option.name) || option.resolutionTimeInMinutes === 240
      : priority === 'Medium'
        ? (option: VoiceSlaOption) => /standard|medium|8\s*business\s*hours/i.test(option.name) || option.resolutionTimeInMinutes === 480
        : (option: VoiceSlaOption) => /standard|low|8\s*business\s*hours/i.test(option.name) || option.resolutionTimeInMinutes === 480
  const matches = options.filter(expected)
  return matches.length === 1 ? matches[0].id : undefined
}

function normalizeSlaText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function findExplicitSlaId(transcript: string, options: VoiceSlaOption[]): string | undefined {
  const normalizedTranscript = normalizeSlaText(transcript)
  const matches = options.filter((option) => {
    const normalizedName = normalizeSlaText(option.name)
    if (!normalizedName) return false
    const namePattern = new RegExp(`(?:^|\\s)${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g')
    let match: RegExpExecArray | null
    while ((match = namePattern.exec(normalizedTranscript))) {
      const prefix = normalizedTranscript.slice(Math.max(0, match.index - 48), match.index)
      const suffix = normalizedTranscript.slice(namePattern.lastIndex, namePattern.lastIndex + 32)
      const identifiedBefore = /\b(?:sla|service level agreement|एसएलए|एसला)\b(?:\s+(?:policy|is|named|called|to|use|select|set|choose|the)){0,3}\s*$/i.test(prefix)
      const identifiedAfter = /^\s+(?:(?:is|as|the)\s+){0,2}(?:sla|policy|policies)\b|^\s+(?:एसएलए|एसला)\b/i.test(suffix)
      if (identifiedBefore || identifiedAfter) return true
    }
    return false
  })
  const uniqueIds = [...new Set(matches.map(({ id }) => id))]
  return uniqueIds.length === 1 ? uniqueIds[0] : undefined
}

function extractLabeledValue(transcript: string, labels: string[], hindiLabels: string[] = []): string | undefined {
  const valuePattern = `\\s*(?:is|named|called|:)?\\s+(.+?)(?=\\s+(?:(?:and|at|in|mein)\\s+)?(?:project(?:\\s+name)?|landmark|location|device(?:\\s+name)?|priority|severity|category|subcategory|ticket type|sla(?: policy)?)\\b|[,!?;.]|$)`
  const englishMatch = transcript.match(new RegExp(`\\b(?:${labels.join('|')})\\b${valuePattern}`, 'i'))
  const hindiMatch = hindiLabels.length
    ? transcript.match(new RegExp(`(?:${hindiLabels.join('|')})${valuePattern}`, 'i'))
    : null
  const value = (englishMatch?.[1] ?? hindiMatch?.[1])?.trim().replace(/^(?:the|a|an)\\s+/i, '')
  return value ? value.replace(/\s+/g, ' ').trim() : undefined
}

function matchDevice(transcript: string, devices: VoiceDeviceOption[]): string | undefined {
  const normalize = (value: string) => ` ${value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
  const normalizedTranscript = normalize(transcript)
  const matching = devices
    .flatMap((device) => device.names.map((name) => ({ id: device.id, name: name.trim() })))
    .filter(({ name }) => name.length > 1 && normalizedTranscript.includes(normalize(name)))
    .sort((left, right) => right.name.length - left.name.length)
  return matching[0]?.id
}

export function extractTicketFields(
  transcript: string,
  {
    slaOptions,
    priorityOptions,
    severityOptions,
    ticketTypeOptions,
    categoryOptions = [],
    subcategoryOptions = {},
    deviceOptions = [],
  }: VoiceExtractionOptions,
): VoiceTicketExtraction {
  const matchingCategories = categoryRules.filter((rule) => rule.keywords.test(transcript))
  const detectedCategory = matchingCategories.length === 1 ? matchingCategories[0].category : undefined
  const category = configuredValue(detectedCategory, categoryOptions)
  const detectedPriority = detectPriority(transcript)
  const priority = configuredValue(detectedPriority.value, priorityOptions)
  const severity = configuredValue(detectSeverity(transcript), severityOptions)
  const detectedSubcategory = detectSubcategory(transcript, detectedCategory)
  const subCategory = category
    ? configuredValue(detectedSubcategory, subcategoryOptions[category] ?? [])
    : undefined
  const explicitSlaId = findExplicitSlaId(transcript, slaOptions)
  const slaId = suggestSlaId(priority, slaOptions)
  const projectName = extractLabeledValue(transcript, ['project(?:\\s+name)?', 'project\\s+naam'], ['प्रोजेक्ट(?:\\s+का\\s+नाम)?'])
  const landmark = extractLabeledValue(transcript, ['landmark', 'location'], ['लैंडमार्क', 'लोकेशन', 'जगह'])
  const deviceId = matchDevice(transcript, deviceOptions)
  const ticketType = configuredValue(detectTicketType(transcript), ticketTypeOptions)
  const confirmationRequired: ('category' | 'priority' | 'slaId')[] = []
  if (matchingCategories.length > 1 || (detectedCategory && !category)) confirmationRequired.push('category')
  if (detectedPriority.ambiguous || (detectedPriority.value && !priority)) confirmationRequired.push('priority')
  if (!explicitSlaId && !slaId) confirmationRequired.push('slaId')

  return {
    title: makeTitle(transcript, category),
    ...(category ? { category } : {}),
    ...(subCategory ? { subCategory } : {}),
    ...(ticketType ? { ticketType } : {}),
    ...(priority ? { priority } : {}),
    ...(severity ? { severity } : {}),
    ...(explicitSlaId ? { slaId: explicitSlaId } : slaId ? { slaId } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(projectName ? { projectName } : {}),
    ...(landmark ? { landmark } : {}),
    ...(confirmationRequired.length ? { confirmationRequired } : {}),
  }
}

export const extractVoiceTicketFields = extractTicketFields
