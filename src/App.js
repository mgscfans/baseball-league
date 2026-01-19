import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Clock, MapPin, Filter, ChevronLeft, ChevronRight, Search, 
  Download, Printer, FileText, LayoutList, RefreshCcw, Users, ShieldAlert, 
  Settings, Plus, Trash2, Building2, Sun, Anchor, Moon, Save, RefreshCw, 
  AlertCircle, BarChart3, ArrowLeftRight, Home, Info, X, HelpCircle, Cloud
} from 'lucide-react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';

// --- Firebase 초기화 및 환경 변수 설정 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'league-scheduler-2026';

const App = () => {
  // --- 초기 기본 데이터 ---
  const defaultLeagues = {
    '토요2부': ['일신야구단', '다온패널', '원더키디', '핸드피스', '아름다운 웨딩홀', '레이더스', 'JB티쳐스', '마루한', '블루마운틴스', '와갈비 로얄즈', '제피로스'],
    '토요3부': ['무작정', '스노우볼', '파이터스', '버벅스', '전북대병원', '위너스', '레드삭스', '상산', '예수병원', '펀치'],
    '토요4부': ['카이로스', '위풍당당', '진안군청', '전주시청', '뉴앤올드', '동암파써블', 'JB퓨쳐스', '농촌진흥청'],
    '일요2부': ['노송', '다이아몬드', '캡틴', '파이어배트', '짱돌', '파이어폭스', '웰니스산업', '토로스', '헌터스', '곤조'],
    '일요3부': ['해빛한방병원', '공노리당', '승승장구 펀', '리스펙트', '화이트샤크', '경찰청', '나이스가이', '갱스터즈', '빅스', '핑거스'],
    '일요4부': ['풀 카운트', '린나이', '블루마린스', '버스터즈', '두근두근', '프린스', '코드나인', '토네이도', '현대', '으라차차'],
    '일요5부': ['불독스', '임팩트', '미소렌트카', '지니어스', '승승장구 락', '스나이퍼스', '연금이', '라이징스타']
  };

  const initialStadiums = ['효자', '솔내', '필연', '진안'];
  const summerTimeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00'];
  const standardTimeSlots = ['09:00', '11:00', '13:00', '15:00'];
  const months = [3, 4, 5, 6, 7, 8, 9, 10, 11];

  const stadiumColors = {
    '효자': 'bg-blue-100 text-blue-700 border-blue-200',
    '솔내': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    '필연': 'bg-amber-100 text-amber-700 border-amber-200',
    '진안': 'bg-slate-800 text-white border-slate-700',
    '기본': 'bg-slate-100 text-slate-600 border-slate-200'
  };

  const stadiumProgressColors = {
    '효자': 'bg-blue-500',
    '솔내': 'bg-emerald-500',
    '필연': 'bg-amber-500',
    '진안': 'bg-slate-500',
    '기본': 'bg-slate-400'
  };

  // --- 상태 관리 ---
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState(defaultLeagues);
  const [stadiums, setStadiums] = useState(initialStadiums);
  const [firstGameFixedTeams, setFirstGameFixedTeams] = useState(new Set());
  const [lastGameFixedTeams, setLastGameFixedTeams] = useState(new Set()); 
  
  const [activeView, setActiveView] = useState('schedule');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState('전체');
  const [selectedStadium, setSelectedStadium] = useState('전체');
  const [selectedTeam, setSelectedTeam] = useState('전체');
  const [selectedMonth, setSelectedMonth] = useState('전체');
  
  const [newTeamNames, setNewTeamNames] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Firebase 인증 및 데이터 로딩 ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 클라우드에서 설정 데이터를 실시간으로 가져옴
    const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.leagues) setLeagues(data.leagues);
        if (data.stadiums) setStadiums(data.stadiums);
        if (data.firstGameFixedTeams) setFirstGameFixedTeams(new Set(data.firstGameFixedTeams));
        if (data.lastGameFixedTeams) setLastGameFixedTeams(new Set(data.lastGameFixedTeams));
      }
    }, (err) => {
      console.error("Firestore loading error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // --- 유틸리티 및 데이터 가공 ---
  const isAfterSunsetThreshold = (month, day) => {
    if (month > 3 && month < 9) return true;
    if (month === 3 && day >= 20) return true;
    if (month === 9 && day <= 15) return true;
    return false;
  };

  const teamOptions = useMemo(() => {
    const options = [];
    Object.entries(leagues).forEach(([leagueName, teams]) => {
      teams.forEach(team => options.push({ league: leagueName, team: team }));
    });
    return options.sort((a, b) => a.league !== b.league ? a.league.localeCompare(b.league) : a.team.localeCompare(b.team));
  }, [leagues]);

  // --- 통합 배정 알고리즘 ---
  const generateSchedule = useMemo(() => {
    let rawPairsByDate = {}; 
    const baseDate = new Date(2026, 2, 21);
    const matchupCounter = {};

    Object.keys(leagues).forEach((leagueName) => {
      const teams = leagues[leagueName];
      if (!teams || teams.length === 0) return;
      const isSaturday = leagueName.includes('토요');
      const tempTeams = [...teams];
      if (tempTeams.length % 2 !== 0) tempTeams.push('휴식');
      const n = tempTeams.length;
      
      let totalRounds = (leagueName === '토요4부' || leagueName === '일요5부') ? (n - 1) * 3 : 
                        (['토요3부', '일요2부', '일요3부', '일요4부'].includes(leagueName)) ? 20 : (n - 1) * 2;

      for (let r = 0; r < totalRounds; r++) {
        const matchDate = new Date(baseDate);
        matchDate.setDate(baseDate.getDate() + (r * 7) + (isSaturday ? 0 : 1));
        const dateStr = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}-${String(matchDate.getDate()).padStart(2, '0')}`;
        if (!rawPairsByDate[dateStr]) rawPairsByDate[dateStr] = [];
        for (let i = 0; i < n / 2; i++) {
          const home = tempTeams[i];
          const away = tempTeams[n - 1 - i];
          if (home !== '휴식' && away !== '휴식') rawPairsByDate[dateStr].push({ home, away, league: leagueName });
        }
        tempTeams.splice(1, 0, tempTeams.pop());
      }
    });

    const finalMatches = [];
    const dateKeys = Object.keys(rawPairsByDate).sort();

    dateKeys.forEach((dateStr) => {
      const dayPairs = rawPairsByDate[dateStr];
      const isSaturday = dayPairs[0].league.includes('토요');
      const [year, month, day] = dateStr.split('-').map(Number);
      const useSummer = isAfterSunsetThreshold(month, day);
      const weekIdx = Math.floor((new Date(dateStr) - baseDate) / (7 * 24 * 60 * 60 * 1000));
      const dayLeagueList = Array.from(new Set(dayPairs.map(p => p.league))).sort();

      let availableSlots = [];
      const mainStadiums = stadiums.filter(s => s !== '진안');
      const jinanStadium = stadiums.find(s => s === '진안');
      for (let tIdx = 0; tIdx < 5; tIdx++) {
        mainStadiums.forEach(sName => {
          const limit = useSummer ? 5 : 4;
          if (tIdx < limit) availableSlots.push({ stadium: sName, time: useSummer ? summerTimeSlots[tIdx] : standardTimeSlots[tIdx] });
        });
        if (jinanStadium && tIdx < 4) availableSlots.push({ stadium: jinanStadium, time: standardTimeSlots[tIdx] });
      }

      dayPairs.sort((a, b) => {
        const getWeight = (m) => {
          const pairKey = [m.home, m.away].sort().join('_');
          const count = matchupCounter[pairKey] || 0;
          if ((firstGameFixedTeams.has(m.home) || firstGameFixedTeams.has(m.away)) && (lastGameFixedTeams.has(m.home) || lastGameFixedTeams.has(m.away))) return count % 2 === 0 ? -1000 : 1000;
          if (firstGameFixedTeams.has(m.home) || firstGameFixedTeams.has(m.away)) return -1000;
          if (lastGameFixedTeams.has(m.home) || lastGameFixedTeams.has(m.away)) return 1000;
          return 0;
        };
        const wd = getWeight(a) - getWeight(b);
        if (wd !== 0) return wd;
        return ((dayLeagueList.indexOf(a.league) + weekIdx) % dayLeagueList.length) - ((dayLeagueList.indexOf(b.league) + weekIdx) % dayLeagueList.length);
      });

      dayPairs.forEach(m => {
        const pk = [m.home, m.away].sort().join('_');
        matchupCounter[pk] = (matchupCounter[pk] || 0) + 1;
      });

      const assignedDayMatches = new Array(availableSlots.length).fill(null);
      const firsts = dayPairs.filter(m => {
        const pk = [m.home, m.away].sort().join('_');
        const count = matchupCounter[pk] - 1;
        if((firstGameFixedTeams.has(m.home) || firstGameFixedTeams.has(m.away)) && (lastGameFixedTeams.has(m.home) || lastGameFixedTeams.has(m.away))) return count % 2 === 0;
        return firstGameFixedTeams.has(m.home) || firstGameFixedTeams.has(m.away);
      });
      const lasts = dayPairs.filter(m => {
        const pk = [m.home, m.away].sort().join('_');
        const count = matchupCounter[pk] - 1;
        if((firstGameFixedTeams.has(m.home) || firstGameFixedTeams.has(m.away)) && (lastGameFixedTeams.has(m.home) || lastGameFixedTeams.has(m.away))) return count % 2 !== 0;
        return lastGameFixedTeams.has(m.home) || lastGameFixedTeams.has(m.away);
      });
      const normals = dayPairs.filter(m => !firsts.includes(m) && !lasts.includes(m));

      let fIdx = 0; firsts.forEach(m => { if(fIdx < assignedDayMatches.length) assignedDayMatches[fIdx++] = m; });
      let lIdx = assignedDayMatches.length - 1; lasts.reverse().forEach(m => { while(lIdx >= 0 && assignedDayMatches[lIdx] !== null) lIdx--; if(lIdx >= 0) assignedDayMatches[lIdx] = m; });
      let nIdx = 0; normals.forEach(m => { while(nIdx < assignedDayMatches.length && assignedDayMatches[nIdx] !== null) nIdx++; if(nIdx < assignedDayMatches.length) assignedDayMatches[nIdx] = m; });

      assignedDayMatches.forEach((match, idx) => {
        if (match) {
          const slot = availableSlots[idx];
          finalMatches.push({
            ...match,
            date: dateStr,
            dayName: isSaturday ? '토' : '일',
            month,
            stadium: slot.stadium,
            time: slot.time,
            isSummerTime: useSummer && slot.stadium !== '진안',
            isConcessionMatch: (firstGameFixedTeams.has(match.home) || firstGameFixedTeams.has(match.away)) && (lastGameFixedTeams.has(match.home) || lastGameFixedTeams.has(match.away)),
            fixType: firstGameFixedTeams.has(match.home) || firstGameFixedTeams.has(match.away) ? 'first' :
                     lastGameFixedTeams.has(match.home) || lastGameFixedTeams.has(match.away) ? 'last' : 'none'
          });
        }
      });
    });

    return finalMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [leagues, stadiums, firstGameFixedTeams, lastGameFixedTeams, refreshTrigger]);

  const stadiumStats = useMemo(() => {
    const stats = {};
    generateSchedule.forEach(m => {
      if (!stats[m.league]) stats[m.league] = {};
      stats[m.league][m.stadium] = (stats[m.league][m.stadium] || 0) + 1;
    });
    return stats;
  }, [generateSchedule]);

  const matchCountData = useMemo(() => {
    const counts = {};
    generateSchedule.forEach(m => {
      counts[m.home] = (counts[m.home] || 0) + 1;
      counts[m.away] = (counts[m.away] || 0) + 1;
    });
    return counts;
  }, [generateSchedule]);

  const filteredMatches = useMemo(() => {
    return generateSchedule.filter(m => {
      const matchLeague = selectedLeague === '전체' || m.league === selectedLeague;
      const matchStadium = selectedStadium === '전체' || m.stadium === selectedStadium;
      const matchTeam = selectedTeam === '전체' || m.home === selectedTeam || m.away === selectedTeam;
      const matchMonth = selectedMonth === '전체' || m.month === parseInt(selectedMonth);
      return matchLeague && matchStadium && matchTeam && matchMonth;
    });
  }, [selectedLeague, selectedStadium, selectedTeam, selectedMonth, generateSchedule]);

  // --- 액션 핸들러 ---
  const resetToHome = () => {
    setActiveView('schedule');
    setSelectedLeague('전체');
    setSelectedStadium('전체');
    setSelectedTeam('전체');
    setSelectedMonth('전체');
  };

  // [수정] Firestore 클라우드 저장 기능
  const saveToCloud = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
      await setDoc(configDocRef, {
        leagues: leagues,
        stadiums: stadiums,
        firstGameFixedTeams: Array.from(firstGameFixedTeams),
        lastGameFixedTeams: Array.from(lastGameFixedTeams),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Save to Cloud failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // 설정을 저장하고 일정을 새로고침함
    await saveToCloud();
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
      setIsRefreshing(false);
      if (activeView === 'manage') setActiveView('schedule');
    }, 500);
  };

  const addTeam = (leagueName) => {
    const name = newTeamNames[leagueName]?.trim();
    if (!name || leagues[leagueName].includes(name)) return;
    setLeagues(prev => ({ ...prev, [leagueName]: [...prev[leagueName], name] }));
    setNewTeamNames(prev => ({ ...prev, [leagueName]: '' }));
  };

  const updateTeamName = (leagueName, oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    setLeagues(prev => ({ ...prev, [leagueName]: prev[leagueName].map(t => t === oldName ? trimmed : t) }));
    if (firstGameFixedTeams.has(oldName)) {
      const nf = new Set(firstGameFixedTeams); nf.delete(oldName); nf.add(trimmed); setFirstGameFixedTeams(nf);
    }
    if (lastGameFixedTeams.has(oldName)) {
      const nl = new Set(lastGameFixedTeams); nl.delete(oldName); nl.add(trimmed); setLastGameFixedTeams(nl);
    }
  };

  const removeTeam = (leagueName, teamName) => {
    if (!window.confirm(`'${teamName}' 팀을 삭제하시겠습니까?`)) return;
    setLeagues(prev => ({ ...prev, [leagueName]: prev[leagueName].filter(t => t !== teamName) }));
    const nf = new Set(firstGameFixedTeams); nf.delete(teamName); setFirstGameFixedTeams(nf);
    const nl = new Set(lastGameFixedTeams); nl.delete(teamName); setLastGameFixedTeams(nl);
  };

  const exportToExcelFormatted = () => {
    const sheetName = "2026 야구 일정표";
    let docTitle = `2026 전주 사회인 야구 리그 일정표`;
    const filterInfo = [];
    if (selectedLeague !== '전체') filterInfo.push(selectedLeague);
    if (selectedMonth !== '전체') filterInfo.push(`${selectedMonth}월`);
    if (selectedStadium !== '전체') filterInfo.push(selectedStadium);
    if (selectedTeam !== '전체') filterInfo.push(selectedTeam);
    if (filterInfo.length > 0) docTitle += ` [${filterInfo.join(', ')}]`;

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; table-layout: fixed; width: 550pt; }
          .title-row { font-size: 18pt; font-weight: bold; height: 45pt; text-align: center; vertical-align: middle; }
          th { background: #1e293b; color: #ffffff; border: 1px solid #000000; padding: 10px 5px; font-weight: bold; }
          td { border: 1px solid #000000; text-align: center; padding: 8px 4px; font-size: 9pt; height: 25pt; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr><th colspan="9" class="title-row">${docTitle}</th></tr>
            <tr><th>No</th><th>날짜</th><th>요일</th><th>시간</th><th>리그</th><th>구장</th><th>홈팀</th><th>구분</th><th>어웨이팀</th></tr>
          </thead>
          <tbody>
            ${filteredMatches.map((m, i) => `
              <tr><td>${i+1}</td><td>${m.date}</td><td>${m.dayName}</td><td>${m.time}</td><td>${m.league}</td><td>${m.stadium}</td><td style="text-align: right;">${m.home}</td><td style="color: #94a3b8;">VS</td><td style="text-align: left;">${m.away}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const link = document.createElement("a");
    link.href = 'data:application/vnd.ms-excel;base64,' + window.btoa(unescape(encodeURIComponent(template)));
    link.download = `2026_전주야구_일정표.xls`;
    link.click();
  };

  return (
    <div key={refreshTrigger} className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 leading-tight selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 섹션 */}
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all overflow-hidden relative">
          <div className="flex items-center gap-3">
            <button 
              onClick={resetToHome}
              className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
              title="홈으로 가기"
            >
              <Home size={24} />
            </button>
            <div>
              <h1 
                onClick={resetToHome}
                className="text-2xl font-black text-slate-800 cursor-pointer flex items-center gap-2 tracking-tight group"
              >
                2026 전주 야구 통합 시스템
                <LayoutList className="text-blue-600 group-hover:scale-110 transition-transform" />
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">League Engine v2.5</p>
                {user && (
                  <div className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black border border-emerald-100">
                    <Cloud size={10} /> CLOUD SYNC ON
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto no-print">
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
            >
              <HelpCircle size={14} /> 사용법
            </button>
            <button onClick={handleRefresh} disabled={isRefreshing || isSaving} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:bg-blue-700 active:scale-95 ${(isRefreshing || isSaving) ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {(isRefreshing || isSaving) ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} 
              {activeView === 'manage' ? (isSaving ? '클라우드 저장 중...' : '설정 저장 및 일정 재배치') : '데이터 동기화'}
            </button>
            <button onClick={() => setActiveView(activeView === 'schedule' ? 'manage' : 'schedule')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeView === 'manage' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
              <Settings size={14} /> {activeView === 'schedule' ? '고정 설정 관리' : '일정표 보기'}
            </button>
            <button onClick={exportToExcelFormatted} className="flex-1 md:flex-none p-2.5 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 transition-all active:scale-95" title="엑셀 다운로드"><Download size={18} /></button>
          </div>
        </header>

        {/* 사용 설명서 모달 */}
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-200">
              <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Info className="text-blue-400" />
                  <h2 className="text-lg font-black tracking-tight">시스템 사용 설명서 (클라우드 동기화)</h2>
                </div>
                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <section className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <h3 className="text-blue-700 font-black text-sm mb-2 flex items-center gap-2"><Cloud size={16}/> 클라우드 자동 저장 기능</h3>
                  <p className="text-blue-800 text-xs leading-relaxed font-bold">
                    이제 변경한 모든 설정(팀명, 리그 구성, 고정 팀)은 클라우드에 자동으로 기록됩니다. 
                    브라우저를 새로고침하거나 다른 기기에서 접속해도 이전에 작업한 내용을 그대로 이어서 관리할 수 있습니다.
                  </p>
                </section>
                <section>
                  <h3 className="text-blue-600 font-black text-sm mb-3 flex items-center gap-2">1. 기본 일정 확인</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">
                    • 상단의 필터를 사용하여 원하는 일정만 골라볼 수 있습니다.<br/>
                    • 각 구장은 <span className="text-blue-500 font-bold">효자</span>, <span className="text-emerald-500 font-bold">솔내</span>, <span className="text-amber-500 font-bold">필연</span>, <span className="text-slate-800 font-bold">진안</span> 고유의 색상으로 구분됩니다.
                  </p>
                </section>
                <section>
                  <h3 className="text-blue-600 font-black text-sm mb-3 flex items-center gap-2">2. 팀 및 리그 관리</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">
                    • <span className="bg-slate-100 px-1 rounded font-black text-slate-800">[고정 설정 관리]</span> 버튼을 눌러 관리 모드로 진입하세요.<br/>
                    • 팀 이름을 직접 클릭하여 수정하거나, 휴지통 아이콘으로 삭제가 가능합니다.
                  </p>
                </section>
                <section>
                  <h3 className="text-blue-600 font-black text-sm mb-3 flex items-center gap-2">3. 시간대 고정 (⚓ / 🌙)</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">
                    • <span className="text-blue-600 font-bold">⚓ 첫 경기 고정</span>: 해당 날짜의 가장 빠른 시간대 배정.<br/>
                    • <span className="text-purple-600 font-bold">🌙 마지막 경기 고정</span>: 해당 날짜의 가장 늦은 시간대 배정.
                  </p>
                </section>
                <section className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <h3 className="text-amber-700 font-black text-sm mb-2 flex items-center gap-2"><ArrowLeftRight size={16}/> 4. 상호 양보 규칙</h3>
                  <p className="text-amber-800 text-xs leading-relaxed font-bold">
                    첫 경기 고정팀과 마지막 경기 고정팀이 만날 경우, 시즌 중 한 번은 아침에, 한 번은 마지막 타임에 경기를 하도록 자동 교차 배정합니다.
                  </p>
                </section>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <button onClick={() => setShowGuide(false)} className="w-full py-3 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg">확인했습니다</button>
              </div>
            </div>
          </div>
        )}

        {activeView === 'schedule' ? (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 no-print">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">League Filter</label>
                <select value={selectedLeague} onChange={(e) => setSelectedLeague(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg p-2 text-sm font-bold outline-none cursor-pointer">
                  <option value="전체">모든 리그</option>
                  {Object.keys(leagues).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">Stadium Filter</label>
                <select value={selectedStadium} onChange={(e) => setSelectedStadium(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg p-2 text-sm font-bold outline-none cursor-pointer">
                  <option value="전체">모든 구장</option>
                  {stadiums.map(s => <option key={s} value={s}>{s}구장</option>)}
                </select>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">Team Search</label>
                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg p-2 text-sm font-bold outline-none cursor-pointer">
                  <option value="전체">전체 팀 선택</option>
                  {teamOptions.map((t, idx) => (
                    <option key={idx} value={t.team}>[{t.league}] {t.team}</option>
                  ))}
                </select>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">Season Month</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg p-2 text-sm font-bold outline-none cursor-pointer">
                  <option value="전체">전체 시즌</option>
                  {months.map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
              </div>
            </section>

            <main className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${isRefreshing ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-800 text-white font-bold sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-center w-12 text-[10px] opacity-60 font-black">No</th>
                      <th className="px-4 py-4 text-center min-w-[120px]">날짜 (요일)</th>
                      <th className="px-4 py-4 text-center w-24 tracking-tighter">시간</th>
                      <th className="px-4 py-4 text-center w-24">리그</th>
                      <th className="px-4 py-4 text-center w-24 font-black">구장</th>
                      <th className="px-4 py-4 text-right pr-8 min-w-[150px]">홈팀</th>
                      <th className="px-4 py-4 text-center w-10 text-slate-500 font-black">VS</th>
                      <th className="px-4 py-4 text-left pl-8 min-w-[150px]">어웨이팀</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredMatches.length > 0 ? (
                      filteredMatches.map((match, idx) => {
                        const isSunday = match.dayName === '일';
                        const stadiumClass = stadiumColors[match.stadium] || stadiumColors['기본'];
                        return (
                          <tr key={idx} className={`hover:bg-slate-50 transition-colors group ${match.fixType !== 'none' ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-4 py-4 text-center text-slate-300 font-bold text-xs bg-slate-50 group-hover:bg-blue-50 transition-colors">{idx + 1}</td>
                            <td className={`px-4 py-4 text-center font-bold ${isSunday ? 'text-red-500' : 'text-slate-700'}`}>{match.date} ({match.dayName})</td>
                            <td className="px-4 py-4 text-center font-black text-slate-800 tracking-tighter">
                              <div className="flex items-center justify-center gap-1">
                                {match.isSummerTime && <Sun size={12} className="text-orange-400" />}
                                {match.time}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center"><span className={`text-[10px] font-black px-2 py-0.5 rounded ${match.league.includes('토요') ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{match.league}</span></td>
                            <td className="px-4 py-4 text-center">
                                <div className={`inline-flex items-center gap-1 font-black text-[11px] px-3 py-1 rounded-full shadow-sm border ${stadiumClass}`}>
                                    <MapPin size={10} className={match.stadium === '진안' ? 'text-blue-400' : 'text-current opacity-70'} /> {match.stadium}
                                </div>
                            </td>
                            <td className={`px-4 py-4 text-right font-black pr-8 text-base transition-all ${firstGameFixedTeams.has(match.home) ? 'text-blue-600' : lastGameFixedTeams.has(match.home) ? 'text-purple-600' : 'text-slate-900'}`}><span className="flex items-center justify-end gap-1">{match.home} {match.isConcessionMatch && <ArrowLeftRight size={12} className="text-amber-500" />} {firstGameFixedTeams.has(match.home) && <Anchor size={12} className="text-blue-500" />} {lastGameFixedTeams.has(match.home) && <Moon size={12} className="text-purple-500" />}</span></td>
                            <td className="px-4 py-4 text-center text-[10px] font-black text-slate-200">VS</td>
                            <td className={`px-4 py-4 text-left font-black pl-8 text-base transition-all ${firstGameFixedTeams.has(match.away) ? 'text-blue-600' : lastGameFixedTeams.has(match.away) ? 'text-purple-600' : 'text-slate-900'}`}><span className="flex items-center justify-start gap-1">{firstGameFixedTeams.has(match.away) && <Anchor size={12} className="text-blue-500" />} {lastGameFixedTeams.has(match.away) && <Moon size={12} className="text-purple-500" />} {match.isConcessionMatch && <ArrowLeftRight size={12} className="text-amber-500" />} {match.away}</span></td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan="9" className="px-4 py-32 text-center text-slate-400 italic font-medium">조회된 경기 결과가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </main>
          </>
        ) : (
          <div className="space-y-8 no-print pb-24">
            {/* 구장별 배정 통계 섹션 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6"><BarChart3 size={20} className="text-blue-600" /><h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Stadium Distribution Stats</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.keys(leagues).map(leagueName => (
                  <div key={leagueName} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col">
                    <p className="text-xs font-black text-slate-400 mb-3 border-b border-slate-200 pb-2 uppercase tracking-widest">{leagueName}</p>
                    {stadiums.map(s => {
                      const count = stadiumStats[leagueName]?.[s] || 0;
                      const total = Object.values(stadiumStats[leagueName] || {}).reduce((a,b)=>a+b, 0) || 1;
                      const percent = (count / total) * 100;
                      return (
                        <div key={s} className="mb-2">
                          <div className="flex justify-between text-[11px] font-bold mb-1"><span className="text-slate-500">{s}</span><span className="text-slate-800 font-black">{count}회</span></div>
                          <div className="w-full bg-white h-2 rounded-full overflow-hidden shadow-inner border border-slate-100">
                            <div className={`h-full ${stadiumProgressColors[s]}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            {/* 팀 관리 및 고정 설정 섹션 */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(leagues).map(([leagueName, teams]) => (
                <div key={leagueName} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-slate-800 p-5 text-white flex justify-between items-center">
                    <h3 className="font-black text-base">{leagueName}</h3>
                    <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{teams.length} Teams</span>
                  </div>
                  <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[350px] bg-slate-50/20">
                    {teams.map((team, idx) => (
                      <div key={idx} className={`flex items-center justify-between gap-2 p-3 rounded-2xl group transition-all border ${(firstGameFixedTeams.has(team) || lastGameFixedTeams.has(team)) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200'}`}>
                        <div className="flex-1">
                          <input 
                            className="bg-transparent border-none outline-none font-bold text-sm text-slate-700 w-full focus:ring-0 cursor-text" 
                            defaultValue={team} 
                            onBlur={(e) => updateTeamName(leagueName, team, e.target.value)} 
                          />
                          <div className="text-[9px] text-slate-400 font-black mt-0.5">총 {matchCountData[team] || 0}경기 배정</div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { const s = new Set(firstGameFixedTeams); if(s.has(team)) s.delete(team); else { s.add(team); lastGameFixedTeams.delete(team); } setFirstGameFixedTeams(s); setLastGameFixedTeams(new Set(lastGameFixedTeams)); }} title="첫 경기 고정" className={`p-2 rounded-xl transition-all ${firstGameFixedTeams.has(team) ? 'text-blue-600 bg-blue-100 ring-2 ring-blue-200' : 'text-slate-300 hover:text-blue-400 bg-slate-50'}`}><Anchor size={16} /></button>
                          <button onClick={() => { const s = new Set(lastGameFixedTeams); if(s.has(team)) s.delete(team); else { s.add(team); firstGameFixedTeams.delete(team); } setLastGameFixedTeams(s); setFirstGameFixedTeams(new Set(firstGameFixedTeams)); }} title="마지막 경기 고정" className={`p-2 rounded-xl transition-all ${lastGameFixedTeams.has(team) ? 'text-purple-600 bg-purple-100 ring-2 ring-purple-200' : 'text-slate-300 hover:text-purple-400 bg-slate-50'}`}><Moon size={16} /></button>
                          <button onClick={() => removeTeam(leagueName, team)} className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl hover:bg-red-50 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-5 bg-white border-t border-slate-100">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="새로운 팀 이름 추가..." 
                        value={newTeamNames[leagueName] || ''} 
                        onChange={(e) => setNewTeamNames({ ...newTeamNames, [leagueName]: e.target.value })} 
                        onKeyDown={(e) => { if(e.key === 'Enter') addTeam(leagueName); }} 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                      />
                      <button onClick={() => addTeam(leagueName)} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 shadow-md transition-transform active:scale-95"><Plus size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
              <button onClick={handleRefresh} disabled={isRefreshing || isSaving} className="flex items-center gap-3 bg-blue-600 text-white px-10 py-5 rounded-full text-base font-black shadow-2xl hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.4)] ring-4 ring-white">
                {(isRefreshing || isSaving) ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />} 
                {isSaving ? '클라우드에 저장 중...' : '모든 설정 클라우드 저장 및 일정 재구성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
