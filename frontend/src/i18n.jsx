import { createContext, useContext, useEffect, useState } from 'react';

const STR = {
  app: { mr: 'पोलीस भरती सराव परीक्षा', en: 'Police Bharti Mock Test' },
  tagline: { mr: 'महाराष्ट्र पोलीस भरती – 100 गुण · 90 मिनिटे', en: 'Maharashtra Police Bharti – 100 marks · 90 minutes' },
  home: { mr: 'मुख्यपृष्ठ', en: 'Home' }, results: { mr: 'निकाल', en: 'Results' }, analytics: { mr: 'विश्लेषण', en: 'Analytics' },
  logout: { mr: 'बाहेर पडा', en: 'Logout' }, login: { mr: 'लॉगिन', en: 'Login' },
  fullName: { mr: 'पूर्ण नाव', en: 'Full name' }, email: { mr: 'ईमेल', en: 'Email' }, password: { mr: 'पासवर्ड (किमान 6 अक्षरे)', en: 'Password (min 6 characters)' },
  createAcc: { mr: 'खाते तयार करा', en: 'Create account' }, wait: { mr: 'कृपया थांबा…', en: 'Please wait…' },
  newHere: { mr: 'नवीन आहात? खाते तयार करा', en: 'New here? Create an account' }, haveAcc: { mr: 'आधीच नोंदणी केली आहे? लॉगिन करा', en: 'Already registered? Login' },
  welcome: { mr: 'नमस्कार', en: 'Welcome' },
  fullMock: { mr: 'पूर्ण सराव चाचणी', en: 'Full Mock Test' },
  fullDesc: { mr: '100 प्रश्न · 100 गुण · 90 मिनिटे · प्रत्येकी 25: अंकगणित, बुद्धिमत्ता चाचणी, सामान्य ज्ञान व चालू घडामोडी, मराठी व्याकरण. नकारात्मक गुणदान नाही.', en: '100 questions · 100 marks · 90 minutes · 25 each: Arithmetic, Reasoning, GK & Current Affairs, Marathi Grammar. No negative marking.' },
  startFull: { mr: 'पूर्ण चाचणी सुरू करा', en: 'Start Full Mock' },
  subjPractice: { mr: 'विषयानुसार सराव', en: 'Subject practice' },
  inBank: { mr: 'प्रश्न उपलब्ध', en: 'questions in bank' }, practice15: { mr: '15 प्रश्न सोडवा', en: 'Practice 15 Qs' },
  recent: { mr: 'अलीकडील निकाल', en: 'Recent results' }, noTests: { mr: 'अजून एकही चाचणी नाही — पहिली सराव चाचणी द्या!', en: 'No tests yet — take your first mock!' },
  myResults: { mr: 'माझे निकाल', en: 'My results' }, noDone: { mr: 'अजून एकही चाचणी पूर्ण झालेली नाही.', en: 'No completed tests yet.' },
  question: { mr: 'प्रश्न', en: 'Question' }, of: { mr: 'पैकी', en: 'of' },
  prev: { mr: '← मागील', en: '← Prev' }, next: { mr: 'पुढील →', en: 'Next →' }, clear: { mr: 'पुसा', en: 'Clear' }, review: { mr: '⚑ पुनरावलोकन', en: '⚑ Review' },
  submitTest: { mr: 'चाचणी सबमिट करा', en: 'Submit test' }, submitQ: { mr: 'चाचणी सबमिट करायची?', en: 'Submit test?' },
  answered: { mr: 'सोडवलेले', en: 'Answered' }, unanswered: { mr: 'न सोडवलेले', en: 'Unanswered' }, marked: { mr: 'पुनरावलोकनासाठी', en: 'Marked' },
  contTest: { mr: 'चाचणी सुरू ठेवा', en: 'Continue test' }, yesSubmit: { mr: 'होय, सबमिट करा', en: 'Yes, submit' }, submitting: { mr: 'सबमिट होत आहे…', en: 'Submitting…' },
  examGone: { mr: 'ही परीक्षा सत्र या उपकरणावर आता उपलब्ध नाही.', en: 'This exam session is no longer available on this device.' }, back: { mr: 'मुख्यपृष्ठावर जा', en: 'Back to home' },
  result: { mr: 'निकाल', en: 'Result' }, score: { mr: 'गुण', en: 'Score' }, correct: { mr: 'बरोबर', en: 'Correct' }, wrong: { mr: 'चूक', en: 'Wrong' }, skipped: { mr: 'सोडलेले', en: 'Skipped' },
  timeTaken: { mr: 'लागलेला वेळ', en: 'Time taken' }, subjectWise: { mr: 'विषयानुसार निकाल', en: 'Subject-wise' },
  seeAnalytics: { mr: 'एकूण विश्लेषण व सुधारणा पहा →', en: 'See overall analytics & what to improve →' },
  reviewAns: { mr: 'उत्तरांचा आढावा', en: 'Review answers' },
  f_all: { mr: 'सर्व', en: 'All' }, f_wrong: { mr: 'चूक', en: 'Wrong' }, f_skipped: { mr: 'सोडलेले', en: 'Skipped' }, f_correct: { mr: 'बरोबर', en: 'Correct' },
  yourAns: { mr: '(तुमचे उत्तर)', en: '(your answer)' }, notAttempted: { mr: 'सोडवले नाही', en: 'Not attempted' },
  perfAnalytics: { mr: 'कामगिरी विश्लेषण', en: 'Performance analytics' },
  testsTaken: { mr: 'दिलेल्या चाचण्या', en: 'Tests taken' }, overallAcc: { mr: 'एकूण अचूकता', en: 'Overall accuracy' },
  lastFull: { mr: 'शेवटची पूर्ण चाचणी', en: 'Last full mock' }, bestFull: { mr: 'सर्वोत्तम पूर्ण चाचणी', en: 'Best full mock' }, qsAttempted: { mr: 'सोडवलेले प्रश्न', en: 'Questions attempted' },
  improve: { mr: '🎯 अंतिम परीक्षेपूर्वी काय सुधारावे', en: '🎯 What to improve before the final exam' },
  targetNote: { mr: 'लक्ष्य टक्केवारी मागील कट-ऑफवर आधारित अंदाजे मार्गदर्शन आहे; प्रत्यक्ष कट-ऑफ जिल्हा, प्रवर्ग आणि पेपरच्या काठिण्यपातळीनुसार बदलतो.', en: 'The target is an approximate guide based on past cut-offs; actual cut-offs vary by district, category and paper difficulty.' },
  target: { mr: 'लक्ष्य', en: 'Target' },
  trend: { mr: 'गुणांची प्रगती', en: 'Score trend' }, testNo: { mr: 'चाचणी क्र.', en: 'Test #' },
  subjAcc: { mr: 'विषयानुसार अचूकता', en: 'Subject accuracy' }, topicWise: { mr: 'घटकानुसार (कमजोर प्रथम)', en: 'Topic-wise (weakest first)' },
  subject: { mr: 'विषय', en: 'Subject' }, topic: { mr: 'घटक', en: 'Topic' }, accuracy: { mr: 'अचूकता', en: 'Accuracy' },
  strong: { mr: '💪 मजबूत घटक', en: '💪 Strong topics' }, keepPractising: { mr: 'ताकद वाढवण्यासाठी सराव सुरू ठेवा.', en: 'Keep practising to build strengths.' },
  byDiff: { mr: 'काठिण्यपातळीनुसार', en: 'By difficulty' }, qs: { mr: 'प्रश्न', en: 'Qs' },
  d1: { mr: 'सोपे', en: 'Easy' }, d2: { mr: 'मध्यम', en: 'Medium' }, d3: { mr: 'कठीण', en: 'Hard' },
  noData: { mr: 'विश्लेषण पाहण्यासाठी किमान एक चाचणी द्या.', en: 'Take at least one test to see your analytics.' }, startTest: { mr: 'चाचणी सुरू करा', en: 'Start a test' },
  print: { mr: '🖨 अहवाल प्रिंट / PDF', en: '🖨 Print / Save PDF' }, loading: { mr: 'लोड होत आहे…', en: 'Loading…' },
  reportTitle: { mr: 'पोलीस भरती सराव परीक्षा – अहवाल', en: 'Police Bharti Mock Test – Report' }, candidate: { mr: 'परीक्षार्थी', en: 'Candidate' },
  subj_Arithmetic: { mr: 'अंकगणित', en: 'Arithmetic' }, subj_Reasoning: { mr: 'बुद्धिमत्ता चाचणी', en: 'Reasoning' },
  'subj_GK & Current Affairs': { mr: 'सामान्य ज्ञान व चालू घडामोडी', en: 'GK & Current Affairs' }, 'subj_Marathi Grammar': { mr: 'मराठी व्याकरण', en: 'Marathi Grammar' },
  admin: { mr: 'प्रशासन', en: 'Admin' }, adminTitle: { mr: 'प्रशासन – प्रश्न व्यवस्थापन', en: 'Admin – Question management' },
  tabImport: { mr: 'प्रश्न आयात', en: 'Import questions' }, tabList: { mr: 'सर्व प्रश्न', en: 'All questions' },
  totalQs: { mr: 'एकूण प्रश्न', en: 'Total questions' }, students: { mr: 'विद्यार्थी', en: 'Students' }, testsDone: { mr: 'पूर्ण चाचण्या', en: 'Completed tests' },
  impStep1: { mr: '1. टेम्प्लेट डाउनलोड करा आणि Excel मध्ये भरा (CSV UTF-8 म्हणून सेव्ह करा). JSON फाईल देखील चालते.', en: '1. Download the template and fill it in Excel (save as CSV UTF-8). A JSON file also works.' },
  impStep2: { mr: '2. फाईल निवडा (किंवा खाली पेस्ट करा) आणि तपासा.', en: '2. Choose the file (or paste below) and validate.' },
  impStep3: { mr: '3. त्रुटी नसतील तर आयात करा.', en: '3. Import when there are no errors.' },
  dlTemplate: { mr: '⬇ टेम्प्लेट डाउनलोड (CSV)', en: '⬇ Download template (CSV)' }, chooseFile: { mr: 'CSV / JSON फाईल निवडा', en: 'Choose CSV / JSON file' },
  orPaste: { mr: 'किंवा येथे पेस्ट करा', en: 'or paste here' }, validate: { mr: '✔ तपासा (Dry run)', en: '✔ Validate (dry run)' },
  importNow: { mr: 'वैध प्रश्न आयात करा', en: 'Import valid questions' }, imported: { mr: 'आयात झाले', en: 'Imported' },
  valid: { mr: 'वैध', en: 'Valid' }, invalid: { mr: 'चुकीचे', en: 'Invalid' }, duplicates: { mr: 'पुनरावृत्ती', en: 'Duplicates' }, rowNo: { mr: 'ओळ', en: 'Row' },
  status: { mr: 'स्थिती', en: 'Status' }, issues: { mr: 'तपशील', en: 'Details' }, question_: { mr: 'प्रश्न', en: 'Question' },
  st_valid: { mr: 'वैध', en: 'valid' }, st_invalid: { mr: 'चुकीचे', en: 'invalid' }, st_duplicate: { mr: 'आधीच आहे', en: 'duplicate' },
  allSubjects: { mr: 'सर्व विषय', en: 'All subjects' }, search: { mr: 'शोधा…', en: 'Search…' }, del: { mr: 'हटवा', en: 'Delete' },
  confirmDel: { mr: 'हा प्रश्न हटवायचा?', en: 'Delete this question?' }, diff: { mr: 'काठिण्य', en: 'Level' }, answer: { mr: 'उत्तर', en: 'Answer' },
  pageOf: { mr: 'पृष्ठ', en: 'Page' }, noAdmin: { mr: 'तुम्हाला प्रशासक प्रवेश नाही.', en: 'You do not have admin access.' },
  impDone: { mr: 'आयात पूर्ण', en: 'Import complete' },
  custom: { mr: 'माझा प्रश्नसंच', en: 'Custom' },
  customTitle: { mr: 'माझा स्वतःचा प्रश्नसंच', en: 'My custom question banks' },
  customIntro: { mr: 'तुमचे स्वतःचे प्रश्न PDF, फोटो किंवा टेक्स्ट स्वरूपात अपलोड करा आणि त्यावर चाचणी द्या. विश्लेषण नेहमीप्रमाणेच मिळेल.', en: 'Upload your own questions as a PDF, photo or text and test yourself. You get the same analytics as the official tests.' },
  cuUpload: { mr: 'नवीन प्रश्नसंच अपलोड करा', en: 'Upload a new question bank' },
  cuName: { mr: 'प्रश्नसंचाचे नाव (उदा. माझे नोट्स)', en: 'Bank name (e.g. My notes)' },
  cuFiles: { mr: 'PDF / फोटो / टेक्स्ट फाईल निवडा', en: 'Choose PDF / photo / text file(s)' },
  cuPaste: { mr: 'किंवा प्रश्न येथे पेस्ट करा', en: 'or paste the questions here' },
  cuExtract: { mr: 'प्रश्न वाचा', en: 'Read questions' }, cuReading: { mr: 'वाचत आहे… (अर्धा मिनिट लागू शकतो)', en: 'Reading… (can take up to a minute)' },
  cuNoAi: { mr: 'PDF / फोटो वाचण्यासाठी AI वाचक सर्व्हरवर सुरू नाही. साधा टेक्स्ट अपलोड/पेस्ट करता येतो.', en: 'The AI reader for PDF/photos is not set up on this server. Plain text upload/paste still works.' },
  cuLayout: { mr: 'टेक्स्ट स्वरूप: 1. प्रश्न / A) … D) … / Answer: B', en: 'Text layout: 1. question / A) … D) … / Answer: B' },
  cuFound: { mr: 'प्रश्न सापडले', en: 'questions found' },
  cuCheck: { mr: 'प्रश्नांची उत्तरे AI ने ठरवली आहेत किंवा फाईलमध्ये नव्हती — जतन करण्यापूर्वी खालील उत्तरे तपासा.', en: 'For some questions the answer was worked out by AI or was missing — please check the answers below before saving.' },
  cuAiAns: { mr: 'AI उत्तर', en: 'AI answer' }, cuNoAns: { mr: 'उत्तर निवडा', en: 'pick answer' },
  cuSave: { mr: 'प्रश्नसंच जतन करा', en: 'Save question bank' }, cuSaved: { mr: 'जतन झाले', en: 'Saved' }, cuAdded: { mr: 'प्रश्न जोडले', en: 'questions added' },
  cuRemove: { mr: 'काढा', en: 'Remove' }, cuNeedAns: { mr: 'सर्व प्रश्नांसाठी उत्तर निवडा.', en: 'Pick an answer for every question first.' },
  cuMyBanks: { mr: 'माझे प्रश्नसंच', en: 'My banks' }, cuNone: { mr: 'अजून एकही प्रश्नसंच नाही.', en: 'No banks yet.' },
  cuTest: { mr: 'चाचणी सुरू करा', en: 'Start test' }, cuCount: { mr: 'प्रश्न संख्या', en: 'Questions' },
  cuAnalytics: { mr: 'विश्लेषण', en: 'Analytics' }, cuDelete: { mr: 'प्रश्नसंच हटवा', en: 'Delete bank' },
  cuConfirmDel: { mr: 'हा प्रश्नसंच आणि त्यावरील सर्व निकाल हटवायचे?', en: 'Delete this bank and all results taken on it?' },
  cuAllSubjects: { mr: 'सर्व विषय', en: 'All subjects' }, cuOfficial: { mr: 'अधिकृत चाचण्या', en: 'Official tests' },
  cuCustomCard: { mr: 'स्वतःचे प्रश्न अपलोड करून त्यावर चाचणी द्या (PDF / फोटो / टेक्स्ट).', en: 'Upload your own questions (PDF / photo / text) and test yourself.' },
  cuOpen: { mr: 'माझा प्रश्नसंच उघडा', en: 'Open my banks' }, cuPrivate: { mr: 'हे प्रश्न फक्त तुम्हालाच दिसतात.', en: 'These questions are visible only to you.' },
  timeLeft: { mr: 'उरलेला वेळ', en: 'Time Left' }, saveNext: { mr: 'सेव्ह करा व पुढे', en: 'Save & Next' }, markNext: { mr: 'पुनरावलोकनासाठी चिन्हांकित करा व पुढे', en: 'Mark for Review & Next' },
  clearResp: { mr: 'उत्तर पुसा', en: 'Clear Response' }, notVisited: { mr: 'पाहिलेले नाही', en: 'Not Visited' }, notAnswered: { mr: 'उत्तर दिले नाही', en: 'Not Answered' },
  markedLbl: { mr: 'पुनरावलोकनासाठी', en: 'Marked for Review' }, ansMarked: { mr: 'उत्तर दिले व पुनरावलोकनासाठी', en: 'Answered & Marked for Review' },
  qNo: { mr: 'प्रश्न क्र.', en: 'Question No.' }, sections: { mr: 'विभाग', en: 'Sections' }, paletteOf: { mr: 'प्रश्न पॅलेट', en: 'Question Palette' },
  netErr: { mr: 'सर्व्हरशी संपर्क होऊ शकला नाही. इंटरनेट / API पत्ता तपासा.', en: 'Cannot reach the server. Check your connection / API address.' },
};

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'mr');
  useEffect(() => { localStorage.setItem('lang', lang); document.documentElement.lang = lang; }, [lang]);
  const t = (k) => STR[k]?.[lang] ?? k;
  const L = (bi) => (bi ? bi[lang] ?? bi.en : '');          // pick from an API { mr, en } value
  const subj = (key) => STR['subj_' + key]?.[lang] ?? key;   // subject key -> localised name (custom subjects fall back to the key)
  // Title of a finished attempt: full mock, custom bank (with optional subject), or an official subject.
  const attemptLabel = (r) => r.mode === 'full' ? t('fullMock') : r.mode === 'custom' ? (r.bankName || t('custom')) + (r.subject ? ' · ' + r.subject : '') : subj(r.subject);
  const dt = (iso) => new Date(iso + 'Z').toLocaleString(lang === 'mr' ? 'mr-IN' : 'en-IN');
  return <Ctx.Provider value={{ lang, setLang, t, L, subj, dt, attemptLabel }}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <span className="langtoggle" role="group" aria-label="Language">
      <button className={lang === 'mr' ? 'on' : ''} onClick={() => setLang('mr')}>मराठी</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
    </span>
  );
}
