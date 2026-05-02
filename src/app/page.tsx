"use client";

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Users, Download, Plus, 
  ChevronRight, ChevronLeft, Save, Home, CheckCircle2,
  Trash2, AlertCircle, Cloud
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase 초기화 ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'default-app-id';

// --- 데이터 모델 및 초기 상태 ---
const initialFormState = {
  id: '',
  createdAt: '',
  consent: false,
  // 0. 면접 기록
  visit1: { date: '', ampm: '오전', time: '', result: '' },
  visit2: { date: '', ampm: '오전', time: '', result: '' },
  visit3: { date: '', ampm: '오전', time: '', result: '' },
  respondentRelation: '', interviewerName: '', interviewerPhone: '',
  
  // 1. 일반현황
  name: '', age: '', addressVillage: '', addressDetail: '', address: '', residenceYears: '',
  housing: '', housingOther: '',
  householdType: '', householdFamilyCount: '', householdOther: '',
  monthlyExpense: '', avgExpenseAmount: '',
  maxExpenseItems: [], maxExpenseItemsOther: '',
  incomeSources: [], incomeOther: '',
  healthStatus: '',
  diseaseStatus: '', diseaseDetail: '', pastDiseaseDetail: '',
  medicationStatus: '',
  disabilityStatus: '', disabilityDetail: '',
  mealCount: '', mealCountOther: '', mealUnder3Reason: [],
  mealHelpNeeded: '', mealSolution: [], mealSolutionOther: '',
  residenceTime: '', residenceTimeOther: '',
  dailyMorning: '', dailyAfternoon: '',

  // 2. 가족
  residentFamilies: [{ relation: '', age: '', health: '', disease: '', disability: '', note: '' }], 
  nonResidentFamilies: [{ relation: '', age: '', residence: '', contact: '', note: '' }],

  // 3. 사회복지 서비스
  welfareSatisfaction: '',
  welfareBasic: [], welfareBasicOther: '', 
  welfareChild: [], 
  welfareAdolescent: [], welfareAdolescentOther: '',
  welfareYouthSpecial: [], welfareYouthSpecialOther: '', // 청소년특별지원 세부항목
  welfareSingleParent: [], welfareSingleParentOther: '', 
  welfareDisabled: [], welfareDisabledOther: '',
  welfareElderly: [], welfareElderlyOther: '', 
  welfareVoucher: [], welfareVoucherOther: '',
  welfareMisc: [], welfareMiscOther: '',

  // 4. 생활서비스 공급 시설 (배열: { category, facilityName, location, transport })
  lifeFacilities: [],

  // 5. 지역현안 (생활만족도 및 범죄)
  lifeSatisfaction: '', urgentNeeds: [], urgentNeedsFacilityDetail: '', urgentNeedsOther: '',
  crimeAnxiety: '', crimeEnvSatisfaction: '', crimeFactors: [], crimeFactorsOther: '',
  crimeTypes: [], crimeTypesOther: '',

  // 6. 지역현안 (재난)
  disasterAnxiety: '', disasterFactors: [], disasterFactorsOther: '',
  disasterExpType: '', disasterExpDamage: '', disasterExpAction: '',
  helpFrom: [], helpFromFamilyDetail: '', helpFromNeighborDetail: '', helpFromOtherDetail: '',

  // 7. 주민참여 및 지역이슈
  communityActivity: '', participationIntent: '', jobIntent: '',
  certifications: '', experience: '',
  concerns: '', storyVillage: '', storyRegeneration: '', specialNote: ''
};

// 생활서비스 시설 카테고리
const facilityCategories = {
  '의료': ['의원', '병원(응급실 운영)', '약국', '보건진료소', '보건지소', '보건소'],
  '돌봄': ['마을회관', '경로당, 노인정', '어린이집', '장애인복지관', '노인복지관', '아동복지관'],
  '교육': ['유치원', '초등학교', '중학교', '고등학교', '학원', '평생학습관'],
  '행정': ['읍면동사무소', '마을회관', '농어촌지원센터', '우체국', '경찰서', '소방서'],
  '교통': ['버스정류장', '버스터미널', '여객선터미널'],
  '생활편의': ['슈퍼마켓, 편의점', '식료품점', '이·미용실', '세탁소', '음식점', '다방, 카페', '철물점', '문구점', '목욕탕', '전통시장', '중·대형 마트', '백화점', '은행', '쇼핑몰', '종교시설', '자동차수리', '농어업자재상', '어선수리'],
  '체육': ['근린공원', '놀이터', '체력단련장', '체육관', '수영장'],
  '문화': ['작은도서관', '도서관', '영화관', '박물관', '미술관', '문화원'],
  '업무': ['어촌계사무실', '마을공동작업장', '국가어항', '지방어항', '어촌정주어항', '소규모어항', '수협', '농협, 축협, 신협', '위판장']
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>(initialFormState);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedFacilityCategory, setSelectedFacilityCategory] = useState('');

  // --- Firebase Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'surveys'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSurveys(data);
    }, (error) => {
      console.error("Firestore error:", error);
      alert("데이터를 불러오는 데 실패했습니다: " + error.message);
    });
    return () => unsubscribe();
  }, [user]);

  // --- 기본 핸들러 ---
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleArrayChange = (e, arrayName) => {
    const { value, checked } = e.target;
    let newArray = [...formData[arrayName]];
    if (checked) {
      newArray.push(value);
    } else {
      newArray = newArray.filter(item => item !== value);
    }
    setFormData({ ...formData, [arrayName]: newArray });
  };

  const handleNestedChange = (objName, fieldName, value) => {
    setFormData({
      ...formData,
      [objName]: { ...formData[objName], [fieldName]: value }
    });
  };

  const handleAdminLogin = () => {
    const id = prompt("관리자 아이디를 입력하세요.");
    if (id !== 'admin') {
      if (id) alert("아이디가 틀렸습니다.");
      return;
    }
    const pw = prompt("관리자 비밀번호를 입력하세요.");
    if (pw === '123456') {
      setIsAdminLoggedIn(true);
      alert("관리자로 로그인되었습니다.");
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  const editSurvey = (survey: any) => {
    setFormData(survey);
    setCurrentView('survey');
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'surveys', id));
      alert("삭제되었습니다.");
    } catch (error: any) {
      alert("삭제 실패: " + error.message);
    }
  };

  const startNewSurvey = () => {
    setFormData({ ...initialFormState, id: `S-${Date.now()}`, createdAt: new Date().toISOString() });
    setCurrentStep(0);
    setSelectedFacilityCategory('');
    setCurrentView('survey');
  };

  const submitSurvey = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'surveys', formData.id), formData);
      alert('수고하셨습니다. 정상적으로 저장되었습니다.');
      setCurrentView('dashboard');
    } catch (error) {
      console.error("Save error:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
    setIsSaving(false);
  };

  const downloadCSV = async () => {
    try {
      if (surveys.length === 0) {
        alert("다운로드할 데이터가 없습니다.");
        return;
      }

    // 1. 전체 문항 헤더 정의 (약 90여 개 항목)
    const headers = [
      "데이터ID", "생성일시", "개인정보동의",
      "1차방문_일자", "1차방문_오전오후", "1차방문_시간", "1차방문_결과",
      "2차방문_일자", "2차방문_오전오후", "2차방문_시간", "2차방문_결과",
      "3차방문_일자", "3차방문_오전오후", "3차방문_시간", "3차방문_결과",
      "세대주관계", "면접원성명", "면접원연락처",
      "응답자성명", "연령", "주소", "거주기간(년)", "주거상태", "주거상태_기타",
      "세대유형", "세대유형_가족수", "세대유형_기타", "월생활비", "월평균지출액",
      "최대지출항목", "최대지출항목_기타", "주요수입원", "주요수입원_기타",
      "건강상태", "질병유무", "주요질병내용", "예전병력내용", "약복용여부",
      "장애유무", "장애상세(유형및등급)", "식사횟수", "식사횟수_기타", "3끼니이하_사유",
      "식사도움필요여부", "식사해결방법", "식사해결방법_기타",
      "마 마을정주시간", "마을정주시간_기타", "주요일과_오전", "주요일과_오후",
      "동거가족_전체기록", "비동거가족_전체기록",
      "사회서비스_전반적만족도", "기초생활보장", "기초생활보장_기타", "영유아보육",
      "아동청소년복지", "아동청소년_기타", "청소년특별지원_세부", "청소년특별지원_기타",
      "한부모가족", "한부모가족_기타", "장애인복지", "장애인복지_기타",
      "노인복지", "노인복지_기타", "사회복지이용권", "사회복지이용권_기타", "기타서비스", "기타서비스_상세",
      "생활서비스_이용시설_전체기록",
      "전반적생활만족도", "시급해결사항", "시급해결_근린시설상세", "시급해결_기타",
      "범죄불안정도", "범죄예방환경만족도", "범죄불안요인", "범죄불안요인_기타", "불안한범죄유형", "범죄유형_기타",
      "재난불안정도", "재난불안요인", "재난불안요인_기타", "재난경험_종류", "재난경험_피해상황", "재난경험_대피및대처",
      "위험시도움요청대상", "도움요청_가족상세", "도움요청_이웃상세", "도움요청_공공및기타상세",
      "마을공동체활동여부", "주민모임참여의사", "마을일자리참여의사",
      "보유자격증및면허", "직업및활동경력", "사업추진우려사항", "마을에하고싶은이야기", "재생사업에관하여하고싶은이야기", "면접원_특이사항"
    ];

    // CSV 데이터 안전 이스케이프 함수 (콤마나 줄바꿈이 있는 텍스트 보호)
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 배열을 콤마(,) 구분 문자열로 변환
    const formatArray = (arr) => Array.isArray(arr) ? arr.join(', ') : '';

    // 복잡한 가족 데이터 배열을 하나의 요약된 문자열 텍스트로 직렬화
    const formatResidentFams = (fams) => Array.isArray(fams) ? fams.map(f => `[${f.relation}: ${f.age}세, 건강:${f.health}, 질병:${f.disease}, 장애:${f.disability}, 비고:${f.note}]`).join(' | ') : '';
    const formatNonResidentFams = (fams) => Array.isArray(fams) ? fams.map(f => `[${f.relation}: ${f.age}세, 거주지:${f.residence}, 연락:${f.contact}, 비고:${f.reason}]`).join(' | ') : '';
    // 복잡한 시설 데이터 배열을 직렬화
    const formatFacilities = (facs) => Array.isArray(facs) ? facs.map(f => `[${f.category} - ${f.facilityName}: 주소(${f.location}), 이동(${f.transport})]`).join(' | ') : '';

    // 2. 전체 Row 데이터 매핑
    const rows = surveys.map(s => [
      s.id, s.createdAt, s.consent ? '동의함' : '미동의',
      s.visit1?.date, s.visit1?.ampm, s.visit1?.time, s.visit1?.result,
      s.visit2?.date, s.visit2?.ampm, s.visit2?.time, s.visit2?.result,
      s.visit3?.date, s.visit3?.ampm, s.visit3?.time, s.visit3?.result,
      s.respondentRelation, s.interviewerName, s.interviewerPhone,
      s.name, s.age, `${s.addressVillage || ''} ${s.addressDetail || ''}`.trim() || s.address, s.residenceYears, s.housing, s.housingOther,
      s.householdType, s.householdFamilyCount, s.householdOther, s.monthlyExpense, s.avgExpenseAmount,
      formatArray(s.maxExpenseItems), s.maxExpenseItemsOther, formatArray(s.incomeSources), s.incomeOther,
      s.healthStatus, s.diseaseStatus, s.diseaseDetail, s.pastDiseaseDetail, s.medicationStatus,
      s.disabilityStatus, s.disabilityDetail, s.mealCount, s.mealCountOther, formatArray(s.mealUnder3Reason),
      s.mealHelpNeeded, formatArray(s.mealSolution), s.mealSolutionOther,
      s.residenceTime, s.residenceTimeOther, s.dailyMorning, s.dailyAfternoon,
      formatResidentFams(s.residentFamilies), formatNonResidentFams(s.nonResidentFamilies),
      s.welfareSatisfaction, formatArray(s.welfareBasic), s.welfareBasicOther, formatArray(s.welfareChild),
      formatArray(s.welfareAdolescent), s.welfareAdolescentOther, formatArray(s.welfareYouthSpecial), s.welfareYouthSpecialOther,
      formatArray(s.welfareSingleParent), s.welfareSingleParentOther, formatArray(s.welfareDisabled), s.welfareDisabledOther,
      formatArray(s.welfareElderly), s.welfareElderlyOther, formatArray(s.welfareVoucher), s.welfareVoucherOther, formatArray(s.welfareMisc), s.welfareMiscOther,
      formatFacilities(s.lifeFacilities),
      s.lifeSatisfaction, formatArray(s.urgentNeeds), s.urgentNeedsFacilityDetail, s.urgentNeedsOther,
      s.crimeAnxiety, s.crimeEnvSatisfaction, formatArray(s.crimeFactors), s.crimeFactorsOther, formatArray(s.crimeTypes), s.crimeTypesOther,
      s.disasterAnxiety, formatArray(s.disasterFactors), s.disasterFactorsOther, s.disasterExpType, s.disasterExpDamage, s.disasterExpAction,
      formatArray(s.helpFrom), s.helpFromFamilyDetail, s.helpFromNeighborDetail, s.helpFromOtherDetail,
      s.communityActivity, s.participationIntent, s.jobIntent,
      s.certifications, s.experience, s.concerns, s.storyVillage, s.storyRegeneration, s.specialNote
    ].map(escapeCSV)); // 모든 셀에 CSV 이스케이프 적용

    // 3. Blob을 이용한 안전한 파일 생성 및 다운로드 (대용량 지원)
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const defaultFileName = `무안_도원내동항_주민전수조사_전체결과_${new Date().toISOString().split('T')[0]}.csv`;
    
    // File System Access API 지원 시 사용 (저장 폴더 지정)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [{
            description: 'CSV File',
            accept: { 'text/csv': ['.csv'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        alert("엑셀 파일이 지정하신 폴더에 성공적으로 저장되었습니다.");
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // 취소한 경우
        console.error("SaveFilePicker Error:", err);
        // 오류 발생 시 기존 방식으로 폴백
      }
    }

    // 기존 방식 폴백 (브라우저 기본 다운로드 폴더)
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", defaultFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // 메모리 해제
    } catch (e) {
      console.error("CSV Download Error:", e);
      alert("다운로드 중 오류가 발생했습니다: " + e.message);
    }
  };

  // --- 가족 관련 핸들러 ---
  const addFamily = (type) => {
    const listName = type === 'resident' ? 'residentFamilies' : 'nonResidentFamilies';
    const newMember = type === 'resident' 
      ? { relation: '', age: '', health: '', disease: '', disability: '', note: '' }
      : { relation: '', age: '', residence: '', contact: '', reason: '' };
    setFormData({ ...formData, [listName]: [...formData[listName], newMember] });
  };
  const updateFamily = (type, index, field, value) => {
    const listName = type === 'resident' ? 'residentFamilies' : 'nonResidentFamilies';
    const updated = [...formData[listName]];
    updated[index][field] = value;
    setFormData({ ...formData, [listName]: updated });
  };
  const removeFamily = (type, index) => {
    const listName = type === 'resident' ? 'residentFamilies' : 'nonResidentFamilies';
    const updated = formData[listName].filter((_, i) => i !== index);
    setFormData({ ...formData, [listName]: updated });
  };

  // --- 생활서비스 시설 핸들러 ---
  const toggleFacility = (category, facilityName, isChecked) => {
    if (isChecked) {
      setFormData({ 
        ...formData, 
        lifeFacilities: [...formData.lifeFacilities, { category, facilityName, location: '', transport: '' }] 
      });
    } else {
      setFormData({ 
        ...formData, 
        lifeFacilities: formData.lifeFacilities.filter(f => !(f.category === category && f.facilityName === facilityName)) 
      });
    }
  };

  const updateFacilityData = (category, facilityName, field, value) => {
    const updated = formData.lifeFacilities.map(f => {
      if (f.category === category && f.facilityName === facilityName) {
        return { ...f, [field]: value };
      }
      return f;
    });
    setFormData({ ...formData, lifeFacilities: updated });
  };

  // ==========================================
  // 원형 숫자 & UI 헬퍼
  // ==========================================
  const getCircleNumber = (index) => {
    if (index < 20) return String.fromCharCode(9312 + index); 
    return `(${index + 1})`;
  };

  const renderCheckboxGroup = (options, arrayName, inline = false, extraFieldMap = {}) => (
    <div className={`gap-3 ${inline ? 'flex flex-wrap' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
      {options.map((opt, idx) => {
        const isChecked = formData[arrayName].includes(opt);
        const extraField = extraFieldMap[opt];
        return (
          <div key={opt} className={`flex flex-col p-3 border rounded-xl transition-all ${isChecked ? 'bg-blue-50 border-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}>
            <label className="flex items-start cursor-pointer w-full">
              <input type="checkbox" name={arrayName} value={opt} checked={isChecked} onChange={(e) => handleArrayChange(e, arrayName)} className="mt-1 w-5 h-5 text-blue-600 rounded flex-shrink-0"/>
              <span className="ml-3 text-sm text-slate-700 font-medium leading-tight">{getCircleNumber(idx)} {opt}</span>
            </label>
            {isChecked && extraField && (
              <input type="text" name={extraField} value={formData[extraField] || ''} onChange={handleInputChange} placeholder={`${opt} 상세 내용 입력`} className="mt-3 w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"/>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderRadioGroup = (options, fieldName, inline = false, extraFieldMap = {}) => (
    <div className={`gap-3 ${inline ? 'flex flex-wrap' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
      {options.map((opt, idx) => {
        const isChecked = formData[fieldName] === opt;
        const extraField = extraFieldMap[opt];
        return (
          <div key={opt} className={`flex flex-col p-3 border rounded-xl transition-all ${isChecked ? 'bg-blue-50 border-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}>
            <label className="flex items-center cursor-pointer w-full">
              <input type="radio" name={fieldName} value={opt} checked={isChecked} onChange={handleInputChange} className="w-5 h-5 text-blue-600 flex-shrink-0"/>
              <span className="ml-3 text-sm font-medium">{getCircleNumber(idx)} {opt}</span>
            </label>
            {isChecked && extraField && (
              <input type="text" name={extraField} value={formData[extraField] || ''} onChange={handleInputChange} placeholder={`${opt} 상세 내용 입력`} className="mt-3 w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"/>
            )}
          </div>
        );
      })}
    </div>
  );

  // ==========================================
  // RENDER SECTIONS
  // ==========================================

  const renderDashboard = () => (
    <div className="h-full overflow-y-auto w-full p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="text-center space-y-2 mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-900 tracking-tight">무안군 도원·내동항 서비스 수요 및 자원활용 조사</h1>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-6">
            <div className="bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100 text-sm font-medium text-slate-700">
              <span className="font-bold text-blue-800 mr-2">[주관]</span> 해양수산부, 무안군, 한국농어촌공사 전남지역본부
            </div>
            <div className="bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100 text-sm font-medium text-slate-700">
              <span className="font-bold text-blue-800 mr-2">[조사기관]</span> ㈜선재, 국립목포대 조경학과 표현연구실
            </div>
          </div>
          <div className="max-w-3xl mx-auto mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 text-center leading-relaxed">
            본 조사는 어촌뉴딜3.0 사업의 일환으로 도원·내동항 주민들의 생활 실태와 불편사항, 향후 바램 등을 파악하여 실효성 있는 사업 계획 수립의 기초 자료로 활용하고자 실시됩니다.
          </div>
          <div className="flex justify-center items-center mt-4 text-sm text-emerald-600 font-semibold">
            <Cloud size={16} className="mr-1" /> 클라우드 연동 됨
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-xl flex-shrink-0">
              <Users size={32} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500 font-medium mb-1">총 조사 완료</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold text-slate-800">{surveys.length}건</p>
                <div className="flex flex-col text-xs font-medium text-slate-500 border-l-2 pl-3 border-slate-100">
                  <div className="flex justify-between gap-2">
                    <span className="text-blue-600 font-bold">성내리</span> 
                    <span>{surveys.filter(s => s.addressVillage === '성내리(도원항)').length}건</span>
                  </div>
                  <div className="flex justify-between gap-2 mt-0.5">
                    <span className="text-emerald-600 font-bold">내리</span> 
                    <span>{surveys.filter(s => s.addressVillage === '내리(내동항)').length}건</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button onClick={startNewSurvey} className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-2xl shadow-sm transition-all flex flex-col items-center justify-center space-y-3 group active:scale-95">
            <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
              <Plus size={32} />
            </div>
            <span className="font-semibold text-lg">조사 시작 / 종이설문 입력</span>
          </button>

          <div className="flex flex-col gap-4">
            <button onClick={downloadCSV} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center space-x-2 transition-colors active:scale-95">
              <Download size={20} className="text-emerald-500"/>
              <span className="font-bold">엑셀(CSV) 다운로드</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="font-bold text-slate-700 flex items-center">
              <ClipboardList className="mr-2 text-slate-500" size={20}/> 실시간 조사 목록
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" placeholder="이름 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-lg text-sm flex-1 md:w-48" />
              {!isAdminLoggedIn ? (
                <button onClick={handleAdminLogin} className="text-xs bg-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-300 whitespace-nowrap">관리자 로그인</button>
              ) : (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg font-bold whitespace-nowrap flex items-center">관리자 모드</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {surveys.length === 0 ? (
              <div className="p-12 text-center text-slate-400">데이터가 없습니다.</div>
            ) : (
              surveys.filter(s => !searchTerm || s.name?.includes(searchTerm)).slice(0, 10).map((s, idx) => (
                <div key={idx} className="p-4 flex flex-col md:flex-row justify-between items-center hover:bg-slate-50 gap-4">
                  <div className="text-center md:text-left">
                    <p className="font-bold text-slate-800">{s.name || '미입력'} <span className="text-sm text-slate-500 font-normal">({`${s.addressVillage || ''} ${s.addressDetail || ''}`.trim() || s.address || '주소 미상'})</span></p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(s.createdAt).toLocaleString()} | 면접원: {s.interviewerName || '미상'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdminLoggedIn && (
                      <div className="flex gap-2">
                        <button onClick={() => editSurvey(s)} className="text-xs text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">수정</button>
                        <button onClick={() => deleteSurvey(s.id)} className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">삭제</button>
                      </div>
                    )}
                    <div className="text-emerald-500 flex items-center text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full whitespace-nowrap">
                      <CheckCircle2 size={16} className="mr-1"/> 완료
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSurveyForm = () => {
    // 각 카테고리의 제목과 취지 명시
    const steps = [
      { 
        title: "조사개요 및 면접기록", 
        desc: "본 조사의 개요 및 개인정보 수집 동의, 그리고 종이 설문지 등을 통한 면접 기록을 남기는 단계입니다." 
      },
      { 
        title: "응답자 일반현황", 
        desc: "응답자의 기본 인적사항, 경제 상태 및 건강 상태 등 전반적인 생활 상황을 파악합니다." 
      },
      { 
        title: "가족 현황", 
        desc: "응답자와 함께 거주하는 동거 가족과 따로 거주하는 비동거 가족의 현황을 파악합니다." 
      },
      { 
        title: "사회복지 서비스", 
        desc: "지역주민이 주로 이용하고 있는 사회복지 서비스의 현황을 파악하여, 마을단위 사회복지 서비스 공급현황을 분석하기 위함입니다." 
      },
      { 
        title: "생활서비스 공급 시설 현황", 
        desc: "응답자가 평소 이용하는 생활서비스 시설의 명칭과 주소를 파악하여, 해당 마을의 생활서비스 공간범위를 파악하기 위함입니다." 
      },
      { 
        title: "지역사회 주요현안", 
        desc: "전반적인 생활만족도, 시급하게 해결되어야 할 사항 및 범죄예방 등 지역사회 현안을 파악합니다." 
      },
      { 
        title: "재난예방 환경", 
        desc: "해양오염, 태풍, 화재 등 재난에 대한 불안요인과 과거 재난 경험을 조사합니다." 
      },
      { 
        title: "주민활동 참여의사 및 이슈", 
        desc: "마을 공동체 활동 현황 및 향후 주민모임 참여의사, 어촌뉴딜3.0 사업에 대한 의견을 청취합니다." 
      }
    ];

    return (
      <div className="h-full flex flex-col bg-slate-100 w-full relative">
        {/* 상단 헤더 (고정 크기) */}
        <div className="bg-white shadow-sm z-10 shrink-0">
          <div className="max-w-4xl mx-auto px-4 py-3 border-b flex items-center justify-between">
            <button onClick={() => setCurrentView('dashboard')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
              <Home size={22} />
            </button>
            <div className="text-center">
              <span className="font-bold text-slate-800 text-sm md:text-base">어촌뉴딜3.0 설문조사</span>
              <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">{currentStep + 1} / {steps.length}</span>
            </div>
            <div className="w-10"></div>
          </div>
          {/* 프로그레스 바 */}
          <div className="max-w-4xl mx-auto h-1.5 bg-slate-200">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
          </div>
        </div>

        {/* 스크롤 가능한 메인 영역 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8 mb-6 animate-in fade-in">
            
            {/* 각 파트별 카테고리 명칭(큰 글씨) 및 취지(작은 글씨) 출력 */}
            <div className="mb-6 border-b-2 border-slate-100 pb-5">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">{steps[currentStep].title}</h2>
              <p className="text-sm md:text-base text-slate-500 mt-2 leading-relaxed break-keep">{steps[currentStep].desc}</p>
            </div>

            {/* ================= STEP 0 ================= */}
            {currentStep === 0 && (
              <div className="space-y-8">
                {/* 1페이지 표지 정보 (제목, 주관, 조사기관) */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-4">
                  <h1 className="text-2xl md:text-3xl font-black text-blue-900 break-keep leading-snug">
                    무안군 도원·내동항 서비스 수요 및 자원활용 조사
                  </h1>
                  <div className="flex flex-col md:flex-row justify-center gap-4 text-sm text-blue-800 mt-4">
                    <div className="bg-white/60 px-4 py-2 rounded-xl">
                      <span className="font-bold mr-2 text-blue-900">[주관]</span>
                      해양수산부, 무안군, 한국농어촌공사 전남지역본부
                    </div>
                    <div className="bg-white/60 px-4 py-2 rounded-xl">
                      <span className="font-bold mr-2 text-blue-900">[조사기관]</span>
                      ㈜선재, 국립목포대 조경학과 표현연구실
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed font-medium">
                  안녕하십니까? <br/>
                  본 조사는 성내리(도원항)·내리(내동항) 주민들의 삶의 질 회복과 어촌지역의 지속가능성을 높이기 위해 진행되는 어촌뉴딜3.0사업(어촌회복형) 계획 수립을 위한 조사입니다. 선생님이 응답하신 모든 내용은 「통계법」 제33조 및 제34조에 의해 통계 목적으로만 사용되며, 엄격히 보호됩니다.
                </div>
                
                <label className="flex items-start space-x-3 p-5 border-2 border-blue-200 bg-blue-50/50 rounded-xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                  <input type="checkbox" name="consent" checked={formData.consent} onChange={handleInputChange} className="mt-0.5 w-6 h-6 text-blue-600 rounded"/>
                  <span className="text-slate-800 font-bold">개인정보 수집 및 제3자 제공에 동의합니다. (필수)</span>
                </label>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-bold text-lg text-slate-800 mb-2">면접 후 기록 (면접원이 기록)</h3>
                  <p className="text-xs text-slate-500 mb-4">※ 종이 설문지 결과를 사후 입력하는 경우, 해당 설문이 진행된 실제 날짜와 시간을 기록해주세요.</p>
                  
                  {[1, 2, 3].map(num => (
                    <div key={num} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="md:col-span-4 font-bold text-slate-700">{num}차 방문</div>
                      <input type="date" value={formData[`visit${num}`].date} onChange={(e) => handleNestedChange(`visit${num}`, 'date', e.target.value)} className="p-2 border rounded-lg bg-white"/>
                      <select value={formData[`visit${num}`].ampm} onChange={(e) => handleNestedChange(`visit${num}`, 'ampm', e.target.value)} className="p-2 border rounded-lg bg-white">
                        <option>오전</option><option>오후</option>
                      </select>
                      <input type="time" value={formData[`visit${num}`].time} onChange={(e) => handleNestedChange(`visit${num}`, 'time', e.target.value)} className="p-2 border rounded-lg bg-white"/>
                      <select value={formData[`visit${num}`].result} onChange={(e) => handleNestedChange(`visit${num}`, 'result', e.target.value)} className="p-2 border rounded-lg bg-white">
                        <option value="">결과 선택</option><option>조사완료</option><option>부재중</option><option>응답거부</option><option>미완성</option>
                      </select>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                    <div><label className="block text-sm font-bold mb-2">응답자 성명</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                    <div><label className="block text-sm font-bold mb-2">응답자 세대주관계</label><input type="text" name="respondentRelation" value={formData.respondentRelation} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                    <div><label className="block text-sm font-bold mb-2">면접원 성명</label><input type="text" name="interviewerName" value={formData.interviewerName} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                    <div><label className="block text-sm font-bold mb-2">면접원 연락처</label><input type="tel" name="interviewerPhone" value={formData.interviewerPhone} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 1 ================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">응답자 성명</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                  <div><label className="block text-sm font-bold mb-2">연령 (만 세)</label><input type="number" name="age" value={formData.age || ''} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-bold mb-2">주소</label>
                    <div className="flex gap-2">
                      <select name="addressVillage" value={formData.addressVillage || ''} onChange={handleInputChange} className="w-1/2 p-3 border rounded-xl bg-white">
                        <option value="">마을 선택</option>
                        <option value="성내리(도원항)">성내리(도원항)</option>
                        <option value="내리(내동항)">내리(내동항)</option>
                      </select>
                      <input type="text" name="addressDetail" value={formData.addressDetail || ''} onChange={handleInputChange} className="w-1/2 p-3 border rounded-xl" placeholder="상세주소"/>
                    </div>
                  </div>
                  <div><label className="block text-sm font-bold mb-2">마을거주기간 (년)</label><input type="number" name="residenceYears" value={formData.residenceYears || ''} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">주거상태</label>
                  {renderRadioGroup(['자가', '전세', '반전세', '월세', '기타'], 'housing', false, {'기타': 'housingOther'})}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">세대 유형</label>
                  {renderRadioGroup(['단독가구', '부부가구', '가족가구', '기타'], 'householdType', false, {'가족가구': 'householdFamilyCount', '기타': 'householdOther'})}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">월 생활비 (단위: 만원)</label>
                    <select name="monthlyExpense" value={formData.monthlyExpense} onChange={handleInputChange} className="w-full p-3 border rounded-xl bg-white">
                      <option value="">선택하세요</option>
                      {['100 미만', '100~150', '150~200', '200~250', '250~300', '300 이상'].map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">월 평균 지출액 (만원)</label>
                    <input type="number" name="avgExpenseAmount" value={formData.avgExpenseAmount} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">최대 지출 항목 (중복가능)</label>
                  {renderCheckboxGroup(['식비', '의료비', '교육비', '주거비', '교통비', '공과금', '통신비', '기타'], 'maxExpenseItems', false, {'기타': 'maxExpenseItemsOther'})}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">주요 수입원 (중복가능)</label>
                  {renderCheckboxGroup(['정부지원금', '각종연금', '경제활동', '자녀 용돈', '기타'], 'incomeSources', false, {'기타': 'incomeOther'})}
                </div>

                <div className="border-t pt-6">
                  <label className="block text-sm font-bold mb-2">평소 건강 상태</label>
                  {renderRadioGroup(['양호함', '양호하지 않음'], 'healthStatus')}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">질병 유무</label>
                  {renderRadioGroup(['있음', '없음', '예전 병력'], 'diseaseStatus', false, {'있음': 'diseaseDetail', '예전 병력': 'pastDiseaseDetail'})}
                </div>

                {formData.diseaseStatus === '있음' && (
                  <div>
                    <label className="block text-sm font-bold mb-2">질병이 있을 경우 약 복용 여부</label>
                    {renderRadioGroup(['질병으로 약을 복용하고 있음', '질병은 있으나 약을 복용하지는 않음'], 'medicationStatus', true)}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold mb-2">장애 유무</label>
                  {renderRadioGroup(['있음', '없음'], 'disabilityStatus', false, {'있음': 'disabilityDetail'})}
                </div>

                <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">식사 횟수</label>
                    {renderRadioGroup(['1끼니', '2끼니', '3끼니', '기타'], 'mealCount', true, {'기타': 'mealCountOther'})}
                  </div>
                  {['1끼니', '2끼니'].includes(formData.mealCount) && (
                    <div>
                      <label className="block text-sm font-bold mb-2">3끼니 이하 사유</label>
                      {renderCheckboxGroup(['배우자 부재', '전기, 가스료 절약', '건강 상 이유'], 'mealUnder3Reason', true)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">식사 도움 필요 여부</label>
                  {renderRadioGroup(['식사를 준비할 때 다른 사람의 도움이 필요함', '식사를 준비할 때 다른 사람 도움이 필요없음'], 'mealHelpNeeded')}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">식사 해결 방법</label>
                  {renderCheckboxGroup(['집에서 자체 해결', '외식으로 해결', '도시락 또는 반찬 서비스', '기타'], 'mealSolution', false, {'기타': 'mealSolutionOther'})}
                </div>

                <div className="border-t pt-6">
                  <label className="block text-sm font-bold mb-2">마 마을 정주 시간</label>
                  {renderRadioGroup(['매일', '평일', '주말', '비정기적 방문', '기타'], 'residenceTime', false, {'기타': 'residenceTimeOther'})}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-2">주요일과 (오전)</label><input type="text" name="dailyMorning" value={formData.dailyMorning} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                  <div><label className="block text-sm font-bold mb-2">주요일과 (오후)</label><input type="text" name="dailyAfternoon" value={formData.dailyAfternoon} onChange={handleInputChange} className="w-full p-3 border rounded-xl"/></div>
                </div>
              </div>
            )}

            {/* ================= STEP 2 ================= */}
            {currentStep === 2 && (
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-bold text-lg text-slate-800">동거 가족</h3>
                    <button onClick={() => addFamily('resident')} className="flex items-center text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      <Plus size={16} className="mr-1"/> 추가
                    </button>
                  </div>
                  {formData.residentFamilies.length === 0 ? <p className="text-slate-400 text-sm py-4">등록된 동거 가족이 없습니다.</p> : (
                    <div className="space-y-4">
                      {formData.residentFamilies.map((fam, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border relative">
                          <button onClick={() => removeFamily('resident', idx)} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mr-6">
                            <input type="text" placeholder="응답자와의 관계" value={fam.relation} onChange={(e)=>updateFamily('resident',idx,'relation',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="number" placeholder="연령(만)" value={fam.age} onChange={(e)=>updateFamily('resident',idx,'age',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="건강상태" value={fam.health} onChange={(e)=>updateFamily('resident',idx,'health',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="질병" value={fam.disease} onChange={(e)=>updateFamily('resident',idx,'disease',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="장애" value={fam.disability} onChange={(e)=>updateFamily('resident',idx,'disability',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="비고" value={fam.note} onChange={(e)=>updateFamily('resident',idx,'note',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-bold text-lg text-slate-800">비동거 가족</h3>
                    <button onClick={() => addFamily('nonResident')} className="flex items-center text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      <Plus size={16} className="mr-1"/> 추가
                    </button>
                  </div>
                  {formData.nonResidentFamilies.length === 0 ? <p className="text-slate-400 text-sm py-4">등록된 비동거 가족이 없습니다.</p> : (
                    <div className="space-y-4">
                      {formData.nonResidentFamilies.map((fam, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border relative">
                          <button onClick={() => removeFamily('nonResident', idx)} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mr-6">
                            <input type="text" placeholder="응답자와의 관계" value={fam.relation} onChange={(e)=>updateFamily('nonResident',idx,'relation',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="number" placeholder="연령(만)" value={fam.age} onChange={(e)=>updateFamily('nonResident',idx,'age',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="거주지" value={fam.residence} onChange={(e)=>updateFamily('nonResident',idx,'residence',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="평소 연락 유무" value={fam.contact} onChange={(e)=>updateFamily('nonResident',idx,'contact',e.target.value)} className="p-2 border rounded-lg text-sm"/>
                            <input type="text" placeholder="비고(비동거 사유)" value={fam.reason} onChange={(e)=>updateFamily('nonResident',idx,'reason',e.target.value)} className="md:col-span-2 p-2 border rounded-lg text-sm"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= STEP 3 ================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-bold mb-3">사회서비스 전반적 만족도</label>
                  {renderRadioGroup(['매우 불만족', '불만족', '보통', '만족', '매우 만족'], 'welfareSatisfaction', true)}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">기초생활 보장</h4>
                  {renderCheckboxGroup(['생계급여', '교육급여(학비)', '의료급여', '주거급여(현금/현물)', '자활급여(차상위)', '기타'], 'welfareBasic', false, {'기타':'welfareBasicOther'})}
                </div>
                
                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">영유아보육</h4>
                  {renderCheckboxGroup(['양육수당', '보육료 지원(i-사랑카드)'], 'welfareChild', false)}
                </div>

                {/* 아동·청소년 + 특별지원 세부항목 */}
                <div className="p-4 border rounded-xl bg-slate-50 relative">
                  <h4 className="font-bold text-slate-800 mb-3">아동·청소년</h4>
                  {renderCheckboxGroup(['소년소녀가정보호비', '그룹홈·가정위탁보호비', '청소년특별지원', '기타'], 'welfareAdolescent', false, {'기타':'welfareAdolescentOther'})}
                  
                  {/* 청소년특별지원 체크 시 나타나는 하위 메뉴 */}
                  {formData.welfareAdolescent.includes('청소년특별지원') && (
                    <div className="mt-4 ml-0 md:ml-4 p-5 border-2 border-blue-200 bg-blue-50/50 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <h5 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                        <ChevronRight size={16} className="mr-1"/> 청소년특별지원 세부항목 (다중선택)
                      </h5>
                      {renderCheckboxGroup(
                        ['생활지원', '건강지원', '학업지원', '자립지원', '상담지원', '법률지원', '활동지원', '기타지원'], 
                        'welfareYouthSpecial', 
                        false, 
                        {'기타지원': 'welfareYouthSpecialOther'}
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">한부모가족</h4>
                  {renderCheckboxGroup(['아동양육비', '학비', '방과후 돌봄', '기타'], 'welfareSingleParent', false, {'기타':'welfareSingleParentOther'})}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">장애인복지</h4>
                  {renderCheckboxGroup(['장애수당', '장애아동수당', '학비', '의료비', '농어촌장애인주택개조사업', '장애아가족 양육지원', '기타'], 'welfareDisabled', false, {'기타':'welfareDisabledOther'})}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">노인복지</h4>
                  {renderCheckboxGroup(['기초노령연금(배우자동시신청)', '기타'], 'welfareElderly', false, {'기타':'welfareElderlyOther'})}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">사회복지서비스 이용권</h4>
                  {renderCheckboxGroup(['노인돌봄종합서비스', '가사간병방문서비스', '장애인활동보조지원', '장애아동재활치료', '산모신생아도우미', '지역사회서비스투자사업', '기타'], 'welfareVoucher', false, {'기타':'welfareVoucherOther', '지역사회서비스투자사업':'welfareVoucherOther'})}
                </div>

                <div className="p-4 border rounded-xl bg-slate-50">
                  <h4 className="font-bold text-slate-800 mb-3">기타 서비스</h4>
                  {renderCheckboxGroup(['생계지원', '의료·재활서비스', '주거지원', '취업지원', '상담·후원서비스', '시설이용·입소', '타법 의료급여', '정부양곡', '기타'], 'welfareMisc', false, {'타법 의료급여':'welfareMiscOther', '정부양곡':'welfareMiscOther', '기타':'welfareMiscOther'})}
                </div>
              </div>
            )}

            {/* ================= STEP 4: 생활서비스 공급 시설 ================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-emerald-50 p-4 rounded-xl text-emerald-900 text-sm border border-emerald-100 flex items-start">
                  <AlertCircle size={20} className="mr-2 mt-0.5 flex-shrink-0"/>
                  <div>평소 이용하는 생활서비스 시설의 <strong>구분</strong>을 선택하면 하단에 시설명 목록이 표시됩니다. 시설을 <strong>체크</strong>하여 위치와 이동수단을 입력해주세요.</div>
                </div>

                <div className="space-y-6">
                  {Object.keys(facilityCategories).map(cat => (
                    <div key={cat} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-md text-slate-800 mb-3 flex items-center">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-2">{cat}</span>
                        시설 목록
                      </h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {facilityCategories[cat].map(facName => {
                          const facilityData = formData.lifeFacilities.find(f => f.category === cat && f.facilityName === facName);
                          const isChecked = !!facilityData;

                          return (
                            <div key={facName} className={`p-2 border rounded-lg transition-all ${isChecked ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                              <label className="flex items-start cursor-pointer w-full">
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={(e) => toggleFacility(cat, facName, e.target.checked)} 
                                  className="mt-1 mr-2 w-4 h-4 text-blue-600 rounded flex-shrink-0"
                                />
                                <span className={`text-sm font-bold leading-tight ${isChecked ? 'text-blue-800' : 'text-slate-700'}`}>{facName}</span>
                              </label>

                              {isChecked && (
                                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                                  <input 
                                    type="text" 
                                    placeholder="시설명/주소" 
                                    value={facilityData.location} 
                                    onChange={(e) => updateFacilityData(cat, facName, 'location', e.target.value)} 
                                    className="w-full p-1.5 border rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                  />
                                  <select 
                                    value={facilityData.transport} 
                                    onChange={(e) => updateFacilityData(cat, facName, 'transport', e.target.value)} 
                                    className="w-full p-1.5 border rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                  >
                                    <option value="">이동 수단</option>
                                    <option>도보</option><option>자가용</option><option>버스</option><option>택시</option>
                                    <option>수요응답형 택시</option><option>지인차량</option><option>오토바이</option>
                                    <option>자전거</option><option>기타</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.lifeFacilities.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-slate-500 mb-2">현재 선택된 전체 시설 요약</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.lifeFacilities.map((f, idx) => (
                        <span key={idx} className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                          {f.category} - {f.facilityName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================= STEP 5 ================= */}
            {currentStep === 5 && (
              <div className="space-y-8">
                <div>
                  <label className="block text-base font-bold mb-3">전반적인 생활만족도</label>
                  {renderRadioGroup(['매우 불만족', '불만족', '보통', '만족', '매우 만족'], 'lifeSatisfaction', true)}
                </div>

                <div>
                  <label className="block text-base font-bold mb-3">생활여건 개선을 위해서 시급하게 해결되어야 할 내용 (다중선택)</label>
                  {renderCheckboxGroup([
                    '오래되고 낡은 빈집 정리', '주차장 시설 확대', '주민휴식 공간(꽃길 조성) 마련',
                    '주민복지시설 설립(마을회관/도서관/어린이집 등)', '주민문화체육시설 설립',
                    '편의점, 목욕탕 등 생활편의시설', '대중교통 횟수 증가', '의료시설(약국/병원/보건지소) 설치',
                    '복지관(노인,장애인,아동) 및 이용시설', '근린생활시설(슈퍼마켓/목욕탕/미용실 등)부족',
                    '찾아오는 복지서비스(노인분야 재가서비스, 돌봄서비스 등)', '찾아오는 복지서비스(시간제 보육 등 아동서비스)',
                    '생활쓰레기 처리', '어패류 부산물 및 어업쓰레기 처리', '불안한 지형지물(펜스, 옹벽 등)',
                    '도로 정비(어항 진입로, 해안변 도로 등)', '농어업 인력부족(외국인 노동자)',
                    '배달 서비스(우편, 택배 등)', '마을경관정비(담장, 지붕 등)', '어항시설 정비(방파제, 선착장 등)',
                    '일자리 확보', '기타'
                  ], 'urgentNeeds', false, {
                    '근린생활시설(슈퍼마켓/목욕탕/미용실 등)부족': 'urgentNeedsFacilityDetail', 
                    '기타': 'urgentNeedsOther'
                  })}
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-bold mb-4 text-slate-800">범죄예방 환경</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold mb-2">범죄 불안정도</label>
                      {renderRadioGroup(['매우 불안함', '불안한 편임', '보통', '불안하지 않은 편임', '전혀 불안하지 않음'], 'crimeAnxiety', true)}
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">범죄예방환경 만족정도</label>
                      {renderRadioGroup(['매우 불만족', '불만족', '보통', '만족', '매우 만족'], 'crimeEnvSatisfaction', true)}
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">범죄문제 불안요인 (다중선택)</label>
                      {renderCheckboxGroup([
                        '골목길과 주거환경노후', '비좁고 복잡한 골목길', '어둡고 깜깜한 골목길',
                        '야간에 방치된 휴게 공간', 'CCTV 등의 방범시설 부족', '취객소란 및 싸움',
                        '불량청소년 모임 공간', '친한 이웃 부재', '경찰 및 자율방범대 치안활동부족', '없음', '기타'
                      ], 'crimeFactors', false, {'기타': 'crimeFactorsOther'})}
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">평소 가장 불안한 범죄유형 (다중선택)</label>
                      {renderCheckboxGroup([
                        '침입/절도', '살인/강도/방화', '유괴납치', '폭행', '성범죄', '차량훼손',
                        '자전거 도난/훼손', '기물 도난/훼손', '소매치기·날치기', '없음', '기타'
                      ], 'crimeTypes', false, {'기타': 'crimeTypesOther'})}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 6 ================= */}
            {currentStep === 6 && (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold mb-2">재난 불안정도</label>
                  {renderRadioGroup(['매우 불안함', '불안한 편임', '보통', '불안하지 않은 편임', '전혀 불안하지 않음'], 'disasterAnxiety', true)}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">재난 불안요인</label>
                  {renderCheckboxGroup(['화재', '태풍', '해양오염', '기타'], 'disasterFactors', false, {'기타': 'disasterFactorsOther'})}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border space-y-4">
                  <h4 className="font-bold text-slate-700 border-b pb-2">재난 경험</h4>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">재난의 종류</label><input type="text" name="disasterExpType" value={formData.disasterExpType} onChange={handleInputChange} className="w-full p-2.5 border rounded-xl"/></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">당시의 피해 상황</label><input type="text" name="disasterExpDamage" value={formData.disasterExpDamage} onChange={handleInputChange} className="w-full p-2.5 border rounded-xl"/></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">당시의 대피장소 또는 대처 방법</label><input type="text" name="disasterExpAction" value={formData.disasterExpAction} onChange={handleInputChange} className="w-full p-2.5 border rounded-xl"/></div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">위험할 때 도움을 청하는(청하고 싶은) 사람 (다중선택)</label>
                  {renderCheckboxGroup(['가족', '이웃', '공공기관', '기타'], 'helpFrom', false, {
                    '가족': 'helpFromFamilyDetail', 
                    '이웃': 'helpFromNeighborDetail', 
                    '기타': 'helpFromOtherDetail'
                  })}
                </div>
              </div>
            )}

            {/* ================= STEP 7 ================= */}
            {currentStep === 7 && (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold mb-2">마을 공동체 활동 여부</label>
                  {renderRadioGroup(['있음', '없음'], 'communityActivity', true)}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">향후 마을 문제 해결을 위한 주민모임 참여의사</label>
                  {renderRadioGroup(['있음', '상황에 따라 판단', '없음'], 'participationIntent', true)}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">소일거리, 용돈벌이 정도의 마을일자리 참여의사</label>
                  {renderRadioGroup(['있음', '상황에 따라 판단', '없음'], 'jobIntent', true)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">보유하고 있는 자격증/면허</label>
                    <textarea name="certifications" value={formData.certifications} onChange={handleInputChange} rows={2} className="w-full p-3 border rounded-xl resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">직업 및 활동 경력(경험)</label>
                    <textarea name="experience" value={formData.experience} onChange={handleInputChange} rows={2} className="w-full p-3 border rounded-xl resize-none"></textarea>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-bold text-lg text-slate-800">어촌뉴딜3.0사업 이슈 및 의견</h3>
                  <div>
                    <label className="block text-sm font-bold mb-2">사업 추진 시 우려되는 사항</label>
                    <textarea name="concerns" value={formData.concerns} onChange={handleInputChange} rows={2} className="w-full p-3 border rounded-xl resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">마을에 대해 하고 싶은 이야기 (유래, 문화재, 자랑거리 등)</label>
                    <textarea name="storyVillage" value={formData.storyVillage} onChange={handleInputChange} rows={2} className="w-full p-3 border rounded-xl resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">어촌·어항재생사업에 관하여 하고 싶은 이야기</label>
                    <textarea name="storyRegeneration" value={formData.storyRegeneration} onChange={handleInputChange} rows={2} className="w-full p-3 border rounded-xl resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 text-indigo-600">특이사항 (면접원이 조사 이후 기재)</label>
                    <textarea name="specialNote" value={formData.specialNote} onChange={handleInputChange} rows={3} className="w-full p-3 border-2 border-indigo-200 bg-indigo-50/30 rounded-xl resize-none"></textarea>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 하단 네비게이션 (플렉스 하단 고정) */}
        <div className="bg-white border-t p-4 z-20 shrink-0 shadow-[0_-10px_20px_-10px_rgb(0,0,0,0.1)]">
          <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
            {currentStep > 0 ? (
              <button onClick={() => setCurrentStep(prev => prev - 1)} className="flex items-center px-5 py-3 text-slate-600 bg-slate-100 rounded-xl font-bold active:bg-slate-200 transition-colors">
                <ChevronLeft size={20} className="mr-1" /> 이전
              </button>
            ) : <div className="w-24"></div>}

            {currentStep < steps.length - 1 ? (
              <button 
                onClick={() => setCurrentStep(prev => prev + 1)} 
                disabled={currentStep === 0 && !formData.consent}
                className={`flex items-center px-8 py-3 rounded-xl font-bold text-white shadow-md transition-all ${currentStep === 0 && !formData.consent ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
              >
                다음 단계 <ChevronRight size={20} className="ml-1" />
              </button>
            ) : (
              <button 
                onClick={submitSurvey} 
                disabled={isSaving}
                className={`flex items-center px-8 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold shadow-md transition-all ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
              >
                <Save size={20} className="mr-2" /> {isSaving ? '저장 중...' : '클라우드에 최종 저장'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 selection:bg-blue-200">
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'survey' && renderSurveyForm()}
    </div>
  );
}
