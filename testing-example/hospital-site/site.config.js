/* ============================================================================
   site.config.js — THE ONLY FILE YOU NEED TO EDIT
   ----------------------------------------------------------------------------
   All hospital information AND all interface wording live here, in two parallel
   languages. Change a value, save, refresh — the whole page updates. No build
   step, no dependencies, no code editing.

   content.en / content.ur  = hospital data, one object per language
   ui.en      / ui.ur       = buttons, labels, section headings, notes

   ⚠️  URDU COPY NEEDS A NATIVE REVIEW before this goes live for a real hospital.
   The wording below is standard, literal Urdu, but it is written by the web
   designer, not by the hospital. Have your father or a staff member read every
   line — especially department names, qualifications and the emergency line.

   BEFORE GOING LIVE:
     1. Replace every [ bracketed ] value with real, verified information.
     2. Set demo: false — removes draft markings, enables real phone / WhatsApp /
        map links, and emits MedicalOrganization JSON-LD for Google.
        (In demo mode contact buttons are inert so nobody dials a placeholder.)
     3. Set siteUrl to the final https:// domain and add an og:image.
     4. Name / address / phone here must be written EXACTLY as on the Google
        Business Profile. Google treats mismatches as a trust problem.

   DO NOT invent doctor qualifications, bed counts, success rates, awards or
   patient photos. For a hospital, factual accuracy is the whole brand.
   Also: avoid the red cross / red crescent as a logo — both are protected
   emblems. The wordmark here uses neither.
   ========================================================================== */

window.HOSPITAL_CONFIG = {
  demo: true,
  siteUrl: "",                       // e.g. "https://yourhospital.com"

  contact: {
    phoneDisplay: "+92 300 0000000",
    phoneDial: "",                   // digits only, e.g. "923001234567"
    whatsapp: "",                    // digits only, with country code, no "+"
    email: "",
    emergencyDisplay: "+92 300 0000000",
    emergencyDial: ""
  },

  /* Google Maps: the exact address. When filled, the embedded map and the
     "Get directions" button activate automatically. */
  mapQuery: "",

  /* ---------------------------------------------------------------- ui ---- */
  ui: {
    en: {
      skip: "Skip to content", utilityEmergency: "Emergency open 24/7", draft: "DRAFT",
      navDepartments: "Departments", navDoctors: "Doctors", navVisit: "Visit", navAbout: "About",
      menu: "Menu", callNow: "Call now", call: "Call", est: "Est.",
      whatsapp: "Message on WhatsApp", atAGlance: "AT A GLANCE",
      factEmergency: "Emergency", always: "24 hours, 7 days",
      factOpd: "Outpatient (OPD)", factLocation: "Location",
      getDirections: "Get directions", emergencyLabel: "EMERGENCY",
      emergencyBefore: "For an emergency, call",
      emergencyAfter: "— the emergency department is open 24 hours, every day.",
      deptKicker: "01 / DEPARTMENTS", deptTitle: "Departments & services",
      deptNote: "What the hospital offers. Open a row to see the services listed under each department.",
      deptDraft: "Example list — replace with the hospital's actual departments in <code>site.config.js</code>.",
      doctorsKicker: "02 / DOCTORS", doctorsTitle: "Consultants",
      doctorsNote: "Names, specialities and qualifications are supplied by the hospital.",
      doctorsDraft: "Bracketed cards are blank slots — no doctor details have been invented.",
      consultant: "CONSULTANT",
      visitKicker: "03 / VISIT", visitTitle: "Finding us", addressTitle: "Address",
      directionsBtn: "Get directions on Google Maps", hoursTitle: "Opening hours",
      mapTitle: "Map goes here",
      mapCopy: "Add the exact address to <code>mapQuery</code> in <code>site.config.js</code>. The embedded map and directions button then switch on automatically.",
      mapCoord: "LOCATION PENDING", beforeKicker: "BEFORE YOU VISIT",
      aboutKicker: "04 / ABOUT", aboutTitle: "About the hospital",
      founded: "Founded", registrationLabel: "Registration", contactLabel: "Contact",
      footerCall: "Call", footerWhatsapp: "WhatsApp", footerDirections: "Directions",
      footerDepartments: "Departments",
      draftNotice: "Draft site — placeholder content. Set <code>demo: false</code> before publishing.",
      toastDemo: "Draft site — add the real details in site.config.js, then set demo: false.",
      toastEmpty: "This detail is still empty in site.config.js.",
      noscript: "This page needs JavaScript to show the latest details. Contact information lives in <code>site.config.js</code>.",
      navAria: "Main navigation", homeAria: "Home", keyInfoAria: "Key information",
      mapAria: "Map showing the hospital location", quickAria: "Quick actions",
      langAria: "Switch language",
      titleTpl: "{name} — {descriptor} in {city}, {country}",
      descTpl: "{tagline} {address}. Call {phone}."
    },

    ur: {
      skip: "مواد پر جائیں", utilityEmergency: "ایمرجنسی 24/7 کھلی ہے", draft: "مسودہ",
      navDepartments: "شعبے", navDoctors: "معالجین", navVisit: "مقام", navAbout: "تعارف",
      menu: "مینو", callNow: "اب کال کریں", call: "کال", est: "سنہ قیام",
      whatsapp: "واٹس ایپ پر پیغام", atAGlance: "ایک نظر میں",
      factEmergency: "ایمرجنسی", always: "چوبیس گھنٹے، ساتوں دن",
      factOpd: "بیرونی مریض (او پی ڈی)", factLocation: "پتہ",
      getDirections: "راستہ دیکھیں", emergencyLabel: "ایمرجنسی",
      emergencyBefore: "ایمرجنسی کی صورت میں",
      emergencyAfter: "پر کال کریں — ایمرجنسی شعبہ چوبیس گھنٹے، ہر روز کھلا رہتا ہے۔",
      deptKicker: "01 / شعبے", deptTitle: "شعبے اور خدمات",
      deptNote: "ہسپتال کی خدمات۔ ہر شعبے کی تفصیل دیکھنے کے لیے اسے کھولیں۔",
      deptDraft: "نمونہ فہرست — اصل شعبے <code>site.config.js</code> میں درج کریں۔",
      doctorsKicker: "02 / معالجین", doctorsTitle: "ماہر معالجین",
      doctorsNote: "نام، تخصص اور قابلیت ہسپتال کی دی ہوئی معلومات سے لی جاتی ہے۔",
      doctorsDraft: "یہ کارڈ خالی خانے ہیں؛ کسی معالج کی تفصیل از خود نہیں لکھی گئی۔",
      consultant: "ماہر معالج",
      visitKicker: "03 / آمد", visitTitle: "ہم تک کیسے پہنچیں", addressTitle: "پتہ",
      directionsBtn: "گوگل میپ پر راستہ دیکھیں", hoursTitle: "کھلنے کے اوقات",
      mapTitle: "نقشہ یہاں آئے گا",
      mapCopy: "<code>site.config.js</code> میں درست پتہ <code>mapQuery</code> میں لکھیں؛ نقشہ اور راستہ خود بخود چل جائیں گے۔",
      mapCoord: "مقام درج نہیں", beforeKicker: "آنے سے پہلے",
      aboutKicker: "04 / تعارف", aboutTitle: "ہسپتال کا تعارف",
      founded: "سنہ قیام", registrationLabel: "رجسٹریشن", contactLabel: "رابطہ",
      footerCall: "کال", footerWhatsapp: "واٹس ایپ", footerDirections: "راستہ",
      footerDepartments: "شعبے",
      draftNotice: "مسودہ — جگہ جگہ کی معلومات۔ اشاعت سے پہلے <code>demo: false</code> کریں۔",
      toastDemo: "مسودہ — اصل معلومات site.config.js میں درج کریں، پھر demo: false کریں۔",
      toastEmpty: "یہ معلومات ابھی site.config.js میں خالی ہے۔",
      noscript: "اس صفحے کو تازہ معلومات کے لیے JavaScript چاہیے۔ رابطے کی معلومات <code>site.config.js</code> میں ہے۔",
      navAria: "مرکزی فہرست", homeAria: "صفحہ اول", keyInfoAria: "اہم معلومات",
      mapAria: "ہسپتال کا مقام دکھاتا نقشہ", quickAria: "فوری روابط",
      langAria: "زبان بدلیں",
      titleTpl: "{name} — {descriptor}، {city}، {country}",
      descTpl: "{tagline} {address}۔ {phone} پر کال کریں۔"
    }
  },

  /* ----------------------------------------------------------- content ---- */
  content: {
    en: {
      name: "[ Hospital Name ]", shortName: "[ Hospital ]", descriptor: "General Hospital",
      city: "[ City ]", country: "Pakistan", established: "[ Year ]",
      tagline: "Emergency care, outpatient clinics, diagnostics and pharmacy in [ City ], Pakistan.",
      address: { line1: "[ Street address ]", line2: "[ Area, City ]", country: "Pakistan" },
      hours: [
        { label: "Emergency",        value: "24 hours, 7 days" },
        { label: "Outpatient (OPD)", value: "[ Mon–Sat, 09:00–21:00 ]" },
        { label: "Diagnostics / Lab", value: "[ add hours ]" },
        { label: "Pharmacy",         value: "[ add hours ]" }
      ],
      departments: [
        { name: "Emergency",                summary: "Round-the-clock emergency care.",         services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "General Medicine",         summary: "Consultation and follow-up for adults.", services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "Paediatrics",              summary: "Care for infants, children and adolescents.", services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "Obstetrics & Gynaecology", summary: "Maternity and women's health.",         services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "Orthopaedics",             summary: "Bones, joints and mobility.",           services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "Diagnostics & Laboratory", summary: "Imaging and pathology under one roof.", services: ["[ add services ]", "[ add services ]", "[ add services ]"] },
        { name: "Pharmacy",                 summary: "On-site dispensing.",                   services: ["[ add services ]", "[ add services ]", "[ add services ]"] }
      ],
      doctors: [
        { name: "[ Doctor name ]", role: "[ Speciality ]", qualification: "[ Qualifications ]" },
        { name: "[ Doctor name ]", role: "[ Speciality ]", qualification: "[ Qualifications ]" },
        { name: "[ Doctor name ]", role: "[ Speciality ]", qualification: "[ Qualifications ]" }
      ],
      about: "[ Two or three factual sentences about the hospital: when it was founded, who runs it, what facilities it has, which area it serves. Written by the hospital, not by the web designer. ]",
      registration: "[ Registration / accreditation number, if applicable ]",
      beforeVisit: [
        "Bring a photo ID and any previous prescriptions or test reports.",
        "For an emergency, call ahead if you can so the team can prepare.",
        "Ask the front desk about current visiting hours before coming."
      ]
    },

    ur: {
      name: "[ ہسپتال کا نام ]", shortName: "[ ہسپتال ]", descriptor: "جنرل ہسپتال",
      city: "[ شہر ]", country: "پاکستان", established: "[ سنہ ]",
      tagline: "[ شہر ]، پاکستان میں ایمرجنسی، بیرونی مریضوں کے شعبے، تشخیص اور فارمیسی۔",
      address: { line1: "[ گلی کا پتہ ]", line2: "[ علاقہ، شہر ]", country: "پاکستان" },
      hours: [
        { label: "ایمرجنسی",           value: "چوبیس گھنٹے، ساتوں دن" },
        { label: "بیرونی مریض (او پی ڈی)", value: "[ پیر تا ہفتہ، 09:00–21:00 ]" },
        { label: "تشخیص / لیبارٹری",  value: "[ اوقات درج کریں ]" },
        { label: "فارمیسی",           value: "[ اوقات درج کریں ]" }
      ],
      departments: [
        { name: "ایمرجنسی",            summary: "چوبیس گھنٹے ہنگامی نگہداشت۔",        services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "عمومی طب",            summary: "بالغوں کا معائنہ اور دوبارہ جانچ۔",   services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "اطفال",               summary: "شیر خوار، بچوں اور نوجوانوں کی نگہداشت۔", services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "زچگی و امراض نسواں",  summary: "زچگی اور خواتین کی صحت۔",           services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "ہڈیوں و جوڑوں کا علاج", summary: "ہڈیاں، جوڑ اور حرکت۔",              services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "تشخیص و لیبارٹری",    summary: "ایک ہی جگہ تصویر کشی اور خون کے ٹیسٹ۔", services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] },
        { name: "فارمیسی",             summary: "جگہ پر ہی ادویات کی فراہمی۔",        services: ["[ خدمات درج کریں ]", "[ خدمات درج کریں ]", "[ خدمات درج کریں ]"] }
      ],
      doctors: [
        { name: "[ معالج کا نام ]", role: "[ تخصص ]", qualification: "[ قابلیت ]" },
        { name: "[ معالج کا نام ]", role: "[ تخصص ]", qualification: "[ قابلیت ]" },
        { name: "[ معالج کا نام ]", role: "[ تخصص ]", qualification: "[ قابلیت ]" }
      ],
      about: "[ ہسپتال کے بارے میں دو تین سطریں: کب قائم ہوا، کون چلاتا ہے، کیا سہولیات ہیں، کن علاقوں کو خدمات دیتا ہے۔ یہ متن ہسپتال لکھے، ویب ڈیزائنر نہیں۔ ]",
      registration: "[ رجسٹریشن / منظوری نمبر، اگر ہو ]",
      beforeVisit: [
        "شناختی کارڈ، پرانے نسخے اور ٹیسٹ کی رپورٹیں ساتھ لائیں۔",
        "ایمرجنسی میں اگر ممکن ہو تو پہلے کال کریں تاکہ عملہ تیار ہو جائے۔",
        "آنے سے پہلے استقبالیہ سے ملاقات کے اوقات معلوم کر لیں۔"
      ]
    }
  }
};
