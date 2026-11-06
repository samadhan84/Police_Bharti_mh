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
  netErr: { mr: 'सर्व्हरशी संपर्क होऊ शकला नाही. इंटरनेट / API पत्ता तपासा.', en: 'Cannot reach the server. Check your connection / API address.' },
};

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'mr');
  useEffect(() => { localStorage.setItem('lang', lang); document.documentElement.lang = lang; }, [lang]);
  const t = (k) => STR[k]?.[lang] ?? k;
  const L = (bi) => (bi ? bi[lang] ?? bi.en : '');          // pick from an API { mr, en } value
  const subj = (key) => t('subj_' + key);                   // subject key -> localised name
  const dt = (iso) => new Date(iso + 'Z').toLocaleString(lang === 'mr' ? 'mr-IN' : 'en-IN');
  return <Ctx.Provider value={{ lang, setLang, t, L, subj, dt }}>{children}</Ctx.Provider>;
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
