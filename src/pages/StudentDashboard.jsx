import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2' 

export default function StudentDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home') 
  const [classSubTab, setClassSubTab] = useState('enroll') 
  const [taskFilter, setTaskFilter] = useState('todo') // todo, pending, done
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 🌟 State สำหรับระบบเจาะลึกทีละวิชา (Deep Dive)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseViewTab, setCourseViewTab] = useState('materials') // materials, assignments, quizzes

  const [allCourses, setAllCourses] = useState([])
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [modules, setModules] = useState([]) 
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [quizSubmissions, setQuizSubmissions] = useState([])
  const [announcements, setAnnouncements] = useState([])
  
  const [submitForm, setSubmitForm] = useState({ assign_id: '', type: 'text', text: '', link: '', file: null })
  const [uploadingWork, setUploadingWork] = useState(false)
  
  const [profileForm, setProfileForm] = useState({ 
    full_name: '', nickname: '', phone: '', avatar_url: '', 
    student_code: '', department: '', grade_level: '', telegram_chat_id: ''
  })
  
  const [takingQuiz, setTakingQuiz] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)

  const [showAnnPopup, setShowAnnPopup] = useState(false)
  const [latestAnn, setLatestAnn] = useState(null)

  const takingQuizRef = useRef(null)
  const quizAnswersRef = useRef({})
  const cheatWarningsRef = useRef(0)

  const getYoutubeThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  const sendTelegramNotify = async (chatId, message) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
    if (!chatId || botToken === "YOUR_BOT_TOKEN_HERE") return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });
    } catch (err) { console.error("Telegram Error", err); }
  };

  useEffect(() => {
    if (session?.role === 'student') fetchData()
  }, [session])

  useEffect(() => {
    takingQuizRef.current = takingQuiz;
    quizAnswersRef.current = quizAnswers;
  }, [takingQuiz, quizAnswers]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && takingQuizRef.current) {
        cheatWarningsRef.current += 1;
        if (cheatWarningsRef.current >= 2) {
          Swal.fire({ title: 'หมดสิทธิ์สอบ!', text: 'คุณทำผิดกฎโดยการสลับหน้าจอเกินกำหนด ระบบได้ทำการส่งข้อสอบของคุณอัตโนมัติแล้ว', icon: 'error', confirmButtonText: 'ตกลง', allowOutsideClick: false });
          forceSubmitQuiz(true); 
        } else {
          Swal.fire({ title: '⚠️ คำเตือน!', text: 'ห้ามสลับหน้าจอ เปิดแท็บใหม่ หรือสลับแอปอื่นระหว่างทำข้อสอบ! หากตรวจพบอีกครั้งระบบจะยึดกระดาษคำตอบทันที', icon: 'warning', confirmButtonText: 'รับทราบ', allowOutsideClick: false });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (timeLeft === null || !takingQuiz) return;
    if (timeLeft <= 0) {
      Swal.fire({ title: 'หมดเวลาทำข้อสอบ! ⏳', text: 'ระบบกำลังส่งกระดาษคำตอบของคุณอัตโนมัติ', icon: 'info', showConfirmButton: false, timer: 2500 });
      forceSubmitQuiz(false); 
      return;
    }
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, takingQuiz]);

  const forceSubmitQuiz = async (isCheated = false) => {
    const currentQuiz = takingQuizRef.current;
    const currentAnswers = quizAnswersRef.current;
    if (!currentQuiz) return;
    let score = 0; 
    currentQuiz.questions.forEach((q, index) => { if (currentAnswers[index] === q.correctOption) score++; });
    await supabase.from('quiz_submissions').insert([{ quiz_id: currentQuiz.id, student_id: session.user.id, score: score, total_score: currentQuiz.questions.length, is_cheated: isCheated }]);
    setTakingQuiz(null); setQuizAnswers({}); setTimeLeft(null); cheatWarningsRef.current = 0; fetchData();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchData = async () => {
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pData) {
      setProfileForm({
        full_name: pData.full_name || '', nickname: pData.nickname || '', phone: pData.phone || '', avatar_url: pData.avatar_url || '',
        student_code: pData.student_code || '', department: pData.department || '', grade_level: pData.grade_level || '', telegram_chat_id: pData.telegram_chat_id || ''
      })
    }

    const { data: annData } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (annData) {
      setAnnouncements(annData)
      if (annData.length > 0) {
        const latest = annData[0];
        const isHidden = localStorage.getItem(`hide_ann_${latest.id}`);
        if (!isHidden) { setLatestAnn(latest); setShowAnnPopup(true); }
      }
    }

    const { data: cData } = await supabase.from('courses').select('*, profiles(full_name)').order('created_at', { ascending: false })
    if (cData && pData) {
      const studentDept = pData.department || '';
      const studentLevel = pData.grade_level || '';
      const baseLevel = studentLevel.split('/')[0];
      const myClassCourses = cData.filter(course => {
        const section = course.section || '';
        if (!studentDept) return false;
        return section.includes(studentDept) && (baseLevel ? section.includes(baseLevel) : true);
      });
      setAllCourses(myClassCourses)
    }

    const { data: eData } = await supabase.from('enrollments').select('course_id').eq('student_id', session.user.id)
    const myCourseIds = eData ? eData.map(e => e.course_id) : []
    setEnrolledCourses(myCourseIds)

    if (myCourseIds.length > 0) {
      const { data: modData } = await supabase.from('modules').select('*').in('course_id', myCourseIds)
      if (modData) setModules(modData)

      const { data: aData } = await supabase.from('assignments').select('*, courses(course_name, section, semester, credits)').in('course_id', myCourseIds).order('created_at', { ascending: false })
      if (aData) setAssignments(aData)

      const { data: sData } = await supabase.from('submissions').select('*').eq('student_id', session.user.id)
      if (sData) setSubmissions(sData)

      const { data: mData } = await supabase.from('materials').select('*, courses(course_name, section, semester, credits)').in('course_id', myCourseIds).order('created_at', { ascending: false })
      if (mData) setMaterials(mData)

      const { data: qData } = await supabase.from('quizzes').select('*, courses(course_name, section)').in('course_id', myCourseIds).order('created_at', { ascending: false })
      if (qData) setQuizzes(qData)

      const { data: qsData } = await supabase.from('quiz_submissions').select('*').eq('student_id', session.user.id)
      if (qsData) setQuizSubmissions(qsData)
    }
  }

  const closeAnnPopup = () => setShowAnnPopup(false);
  const hideAnnPopupForever = () => { if (latestAnn) localStorage.setItem(`hide_ann_${latestAnn.id}`, 'true'); setShowAnnPopup(false); };

  const handleTabChange = (tab) => { setActiveTab(tab); setIsMenuOpen(false); setSelectedCourse(null); };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleUploadAvatar = async (e) => {
    try {
      setUploadingAvatar(true); const file = e.target.files[0]; if (!file) return;
      const fileExt = file.name.split('.').pop(); const fileName = `user_${session.user.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfileForm({ ...profileForm, avatar_url: publicUrl });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 3000 });
    } catch (error) { Swal.fire('ข้อผิดพลาด', `ไม่สามารถอัปโหลดรูปได้: ${error.message}`, 'error'); } finally { setUploadingAvatar(false); }
  };

  const handleUpdateProfile = async (e) => { 
    e.preventDefault(); 
    await supabase.from('profiles').update({ full_name: profileForm.full_name, nickname: profileForm.nickname, phone: profileForm.phone, avatar_url: profileForm.avatar_url, telegram_chat_id: profileForm.telegram_chat_id }).eq('id', session.user.id); 
    fetchData(); Swal.fire('สำเร็จ!', 'บันทึกข้อมูลส่วนตัวเรียบร้อย!', 'success');
  }

  const handleEnroll = async (courseId) => {
    const { error } = await supabase.from('enrollments').insert([{ student_id: session.user.id, course_id: courseId }])
    if (error) { 
      if (error.code === '23505' || error.message.includes('duplicate')) Swal.fire('แจ้งเตือน', 'คุณได้ลงทะเบียนวิชานี้ไปแล้ว', 'info'); 
      else Swal.fire('ข้อผิดพลาด', `เกิดข้อผิดพลาด: ${error.message}`, 'error'); 
    } else { fetchData(); Swal.fire('สำเร็จ!', 'ลงทะเบียนวิชานี้เรียบร้อยแล้ว!', 'success'); }
  }

  const handleWorkSubmit = async (e, assignId) => { 
    e.preventDefault(); 
    if (!submitForm.text && !submitForm.link && !submitForm.file) { Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์คำตอบ แนบลิงก์ หรือเลือกไฟล์ อย่างน้อย 1 อย่างครับ', 'warning'); return; }
    setUploadingWork(true); let finalFileUrl = null;
    try {
      if (submitForm.file) {
        const fileExt = submitForm.file.name.split('.').pop(); const fileName = `student_${session.user.id}_assign_${assignId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('student_submissions').upload(fileName, submitForm.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('student_submissions').getPublicUrl(fileName); finalFileUrl = publicUrl;
      }
      await supabase.from('submissions').insert([{ assignment_id: assignId, student_id: session.user.id, submitted_text: submitForm.text || '', link_url: submitForm.link || '', file_url: finalFileUrl }]); 
      const targetAssign = assignments.find(a => a.id === assignId);
      if (targetAssign) {
        const { data: courseData } = await supabase.from('courses').select('teacher_id, profiles(telegram_chat_id)').eq('id', targetAssign.course_id).single();
        if (courseData && courseData.profiles?.telegram_chat_id) {
           const msg = `📬 มีนักเรียนส่งงานใหม่!\nวิชา: ${targetAssign.courses.course_name}\nงาน: ${targetAssign.title}\nจาก: ${profileForm.full_name} (${profileForm.student_code})`;
           sendTelegramNotify(courseData.profiles.telegram_chat_id, msg);
        }
      }
      setSubmitForm({ assign_id: '', text: '', link: '', file: null }); fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ส่งงานสำเร็จ!', showConfirmButton: false, timer: 2000 });
    } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); } finally { setUploadingWork(false); }
  }

  const handleUnsubmit = async (subId) => {
    const result = await Swal.fire({ title: 'ยกเลิกการส่งงาน?', text: 'คุณต้องการยกเลิกการส่งงานนี้เพื่อส่งใหม่ใช่หรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ใช่, ยกเลิก', cancelButtonText: 'ปิด' });
    if (!result.isConfirmed) return;
    try { await supabase.from('submissions').delete().eq('id', subId); fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ยกเลิกการส่งงานแล้ว', showConfirmButton: false, timer: 2000 }); } 
    catch (error) { Swal.fire('เกิดข้อผิดพลาด', error.message, 'error'); }
  };

  const handleStartQuiz = (quiz) => { 
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
    setTakingQuiz({ ...quiz, questions: shuffledQuestions }); setQuizAnswers({}); cheatWarningsRef.current = 0; 
    if (quiz.time_limit && quiz.time_limit > 0) setTimeLeft(quiz.time_limit * 60); else setTimeLeft(null);
  }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < takingQuiz.questions.length) { 
      const result = await Swal.fire({ title: 'ทำข้อสอบยังไม่ครบ!', text: 'ต้องการส่งคำตอบเลยหรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ส่งเลย', cancelButtonText: 'กลับไปทำต่อ' });
      if (!result.isConfirmed) return;
    }
    let score = 0; takingQuiz.questions.forEach((q, index) => { if (quizAnswers[index] === q.correctOption) score++; });
    await supabase.from('quiz_submissions').insert([{ quiz_id: takingQuiz.id, student_id: session.user.id, score: score, total_score: takingQuiz.questions.length, is_cheated: false }]);
    Swal.fire('ส่งข้อสอบสำเร็จ!', `ได้ ${score}/${takingQuiz.questions.length} คะแนน`, 'success'); 
    setTakingQuiz(null); setQuizAnswers({}); setTimeLeft(null); cheatWarningsRef.current = 0; fetchData(); 
  }

  const navigateToService = (tab, subTab) => { setActiveTab(tab); if (subTab) { tab === 'classroom' ? setClassSubTab(subTab) : setTaskFilter(subTab); } }

  const totalAssignments = assignments.length; 
  const completedAssignments = submissions.length; 
  const missingCount = totalAssignments - completedAssignments;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  let totalScore = 0; let gradedCount = 0; 
  submissions.forEach(s => { if(s.score !== null){ totalScore += s.score; gradedCount++; } });
  const avgScore = gradedCount > 0 ? (totalScore / (gradedCount * 10)) * 100 : 100; 
  const isAtRisk = missingCount >= 2 || avgScore < 50;

  // 🌟 แยกระบบภาระงาน 3 สถานะ (Todo, Pending, Done)
  const mySubMap = {}; submissions.forEach(s => mySubMap[s.assignment_id] = s);
  const myQuizSubMap = {}; quizSubmissions.forEach(q => myQuizSubMap[q.quiz_id] = q);

  const todoAssignments = assignments.filter(a => !mySubMap[a.id]);
  const todoQuizzes = quizzes.filter(q => !myQuizSubMap[q.id]);
  const pendingAssignments = assignments.filter(a => mySubMap[a.id] && mySubMap[a.id].score === null);
  const doneAssignments = assignments.filter(a => mySubMap[a.id] && mySubMap[a.id].score !== null);
  const doneQuizzes = quizzes.filter(q => myQuizSubMap[q.id]);

  if (!session || session.role !== 'student') return <Navigate to="/" />

  return (
    <div className="app-layout font-app">
      
      {showAnnPopup && latestAnn && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1060, backdropFilter: 'blur(5px)' }}>
          <div className="theme-card w-100 slide-down mx-3 p-0 overflow-hidden border-0 shadow-lg" style={{ maxWidth: '400px' }}>
            <div className="bg-theme-red text-white p-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><span>📢</span> ประกาศใหม่!</h6>
              <button onClick={closeAnnPopup} className="btn-close btn-close-white"></button>
            </div>
            <div className="p-4 bg-white text-center">
              <h6 className="fw-bold text-theme-dark mb-2">{latestAnn.title}</h6>
              <p className="text-theme-dark bg-theme-gray p-3 rounded-4 small fw-bold mb-4 border border-light text-start">{latestAnn.content}</p>
              <div className="d-flex flex-column gap-2">
                <button onClick={closeAnnPopup} className="btn btn-theme-red w-100 rounded-pill fw-bold shadow-sm py-2">รับทราบ (ปิดหน้าต่าง)</button>
                <button onClick={hideAnnPopupForever} className="btn btn-light text-muted w-100 rounded-pill small fw-bold py-2 border">ไม่ต้องแสดงประกาศนี้อีก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖥️ Desktop Sidebar */}
      <div className={`sidebar ${takingQuiz ? 'd-none' : ''} shadow-sm`}>
        <div className="d-flex align-items-center gap-3 mb-5 px-2 mt-2">
          <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'45px', height:'45px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
          <h5 className="fw-bold m-0 text-theme-dark">สมาร์ท LMS</h5>
        </div>
        <div className="d-flex flex-column gap-2 flex-grow-1">
          <button className={`nav-link-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')}><span className="fs-5">🏠</span> หน้าหลัก</button>
          <button className={`nav-link-btn ${activeTab === 'classroom' ? 'active' : ''}`} onClick={() => handleTabChange('classroom')}><span className="fs-5">📚</span> วิชาเรียน</button>
          <button className={`nav-link-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => handleTabChange('tasks')}><span className="fs-5">📝</span> ภาระงาน</button>
          <button className={`nav-link-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}><span className="fs-5">👤</span> บัญชีของฉัน</button>
        </div>
        <div className="mt-auto border-top pt-3">
          <button onClick={handleLogout} className="nav-link-btn text-danger w-100"><span className="fs-5">🚪</span> ออกจากระบบ</button>
        </div>
      </div>

      {/* 📱 Mobile Menu (Offcanvas) */}
      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show d-lg-none" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0 d-lg-none" style={{ visibility: "visible", zIndex: 1045, width: "260px" }}>
            <div className="offcanvas-header p-4 bg-theme-dark text-white">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2">เมนูหลัก</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1" style={{ overflowY: 'auto' }}>
              <button className={`nav-link-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')}><span className="fs-5">🏠</span> หน้าหลัก</button>
              <button className={`nav-link-btn ${activeTab === 'classroom' ? 'active' : ''}`} onClick={() => handleTabChange('classroom')}><span className="fs-5">📚</span> วิชาเรียน</button>
              <button className={`nav-link-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => handleTabChange('tasks')}><span className="fs-5">📝</span> ภาระงาน</button>
              <button className={`nav-link-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}><span className="fs-5">👤</span> บัญชีของฉัน</button>
              <div className="mt-auto pt-3 border-top border-light">
                <button onClick={handleLogout} className="nav-link-btn text-danger w-100"><span className="fs-5">🚪</span> ออกจากระบบ</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 📱 Main Content Area */}
      <div className="main-content">
        {!takingQuiz && (
          <div className="mobile-only d-flex justify-content-between align-items-center p-3 bg-white shadow-sm sticky-top z-3">
            <div className="d-flex align-items-center gap-2">
              <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-theme-dark rounded-3 border" style={{width:'40px', height:'40px', padding:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <span style={{fontSize: '1.2rem', lineHeight: 1}}>☰</span>
              </button>
              <h6 className="fw-bold text-theme-dark m-0 d-none d-sm-block">สมาร์ท LMS</h6>
            </div>
            <div className="d-flex align-items-center gap-2">
               <h6 className="fw-bold m-0 text-theme-dark text-truncate" style={{maxWidth: '120px', fontSize:'13px'}}>{profileForm.full_name || 'นักศึกษา'}</h6>
               <button onClick={handleLogout} className="btn btn-outline-danger btn-sm rounded-pill fw-bold px-3 py-1">🚪 ออก</button>
            </div>
          </div>
        )}

        <div className="container-fluid p-3 p-md-4" style={{ maxWidth: '1000px' }}>
          
          {takingQuiz ? (
             <div className="theme-card p-0 overflow-hidden mb-5 slide-up border border-theme-red">
                <div className="bg-theme-dark text-white p-4 position-relative">
                  <h5 className="mb-1 fw-bold">{takingQuiz.title}</h5>
                  <small className="text-white-50 mt-1 d-block fw-bold">⚠️ ห้ามสลับหน้าจอหรือย่อแอปขณะสอบ</small>
                  {timeLeft !== null && (
                    <div className="bg-danger text-white fw-bold px-3 py-2 rounded-pill shadow-lg mt-3 d-inline-block border border-white small">
                      ⏳ เหลือเวลา: {formatTime(timeLeft)} นาที
                    </div>
                  )}
                </div>
                <div className="card-body p-4 bg-white">
                  {takingQuiz.questions.map((q, qIndex) => (
                    <div key={qIndex} className="mb-5 pb-3 border-bottom border-light">
                      <h6 className="fw-bold mb-3 text-theme-dark">{qIndex + 1}. {q.question}</h6>
                      {q.imageUrl && (
                        <div className="mb-3 rounded-4 overflow-hidden shadow-sm border border-light text-center">
                          <img src={q.imageUrl} alt="ภาพประกอบโจทย์" className="w-100 object-fit-contain" style={{ maxHeight: '200px' }} />
                        </div>
                      )}
                      <div className="d-flex flex-column gap-2">
                        {q.options.map((opt, optIndex) => (
                          <label key={optIndex} className={`d-flex align-items-center gap-3 border p-3 rounded-3 transition-all ${quizAnswers[qIndex] === optIndex ? 'border-danger bg-danger bg-opacity-10 fw-bold text-danger shadow-sm' : 'border-light bg-light hover-bg-gray'}`} style={{cursor: 'pointer'}}>
                            <input type="radio" name={`q-${qIndex}`} className="form-check-input mt-0 flex-shrink-0" style={{width: '18px', height:'18px', accentColor: 'var(--theme-red)'}} checked={quizAnswers[qIndex] === optIndex} onChange={() => setQuizAnswers({...quizAnswers, [qIndex]: optIndex})} />
                            <span className="small">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="d-flex flex-column flex-md-row gap-2 pt-2">
                    <button onClick={() => { setTakingQuiz(null); setTimeLeft(null); }} className="btn btn-light rounded-pill fw-bold px-4 py-2 text-muted border small">ยกเลิกสอบ</button>
                    <button onClick={handleQuizSubmit} className="btn btn-theme-red rounded-pill fw-bold py-2 px-4 shadow-sm flex-grow-1 small">ส่งข้อสอบ</button>
                  </div>
                </div>
             </div>
          ) : (
            <>
              {/* TAB 1: หน้าหลัก (Grid Layout) */}
              {activeTab === 'home' && (
                <div className="fade-in row g-3">
                  <div className="col-12 col-xl-8">
                    <div className="hero-card mb-3 d-flex flex-column justify-content-center p-4">
                      <div style={{zIndex: 2, position: 'relative'}}>
                        <h3 className="fw-bold mb-2">เตรียมพร้อม<br/>สู่ความสำเร็จ</h3>
                        <p className="text-white-50 mb-3 small" style={{maxWidth: '80%'}}>จัดการการเรียนและเป้าหมายของคุณได้ที่นี่</p>
                        <button onClick={() => navigateToService('tasks', 'todo')} className="btn btn-theme-red btn-sm rounded-pill px-3 py-2 fw-bold shadow-sm">ดูงานที่ค้างส่ง ➔</button>
                      </div>
                    </div>

                    <h6 className="fw-bold mb-3 text-theme-dark mt-4">บริการต่างๆ</h6>
                    <div className="row g-2 text-center mb-4">
                      <div className="col-4"><button onClick={() => {handleTabChange('classroom'); setClassSubTab('enroll')}} className="theme-card p-2 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-4 mb-1">➕</span><span className="text-muted fw-bold" style={{fontSize:'10px'}}>ลงทะเบียนเรียน</span></button></div>
                      <div className="col-4"><button onClick={() => navigateToService('tasks', 'todo')} className="theme-card p-2 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-4 mb-1">📝</span><span className="text-muted fw-bold" style={{fontSize:'10px'}}>ส่งงาน/สอบ</span></button></div>
                      <div className="col-4"><button onClick={() => handleTabChange('profile')} className="theme-card p-2 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-4 mb-1">👤</span><span className="text-muted fw-bold" style={{fontSize:'10px'}}>โปรไฟล์</span></button></div>
                    </div>

                    <h6 className="fw-bold mb-3 text-theme-dark">งานล่าสุดที่ต้องทำ</h6>
                    <div className="d-flex flex-column gap-2">
                      {todoAssignments.slice(0, 3).map(a => (
                        <div key={a.id} className="theme-card p-3 d-flex align-items-center gap-3">
                          <div className="bg-danger bg-opacity-10 text-danger border border-danger rounded-3 p-2 fs-5">📝</div>
                          <div className="flex-grow-1 overflow-hidden">
                            <h6 className="fw-bold mb-1 text-truncate text-theme-dark" style={{fontSize: '14px'}}>{a.title}</h6>
                            <small className="text-muted fw-bold" style={{fontSize: '12px'}}>{a.courses.course_name}</small>
                          </div>
                          <button onClick={() => { setActiveTab('classroom'); setSelectedCourse(allCourses.find(c=>c.id === a.course_id)); setCourseViewTab('assignments'); }} className="btn btn-light rounded-circle text-danger fw-bold shadow-sm p-2">→</button>
                        </div>
                      ))}
                      {todoAssignments.length === 0 && (
                        <div className="theme-card p-3 text-center"><span className="text-muted fw-bold small">✅ ไม่มีงานค้างในขณะนี้!</span></div>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-xl-4">
                     <div className="theme-card bg-white border border-light mb-3 p-3">
                       <h6 className="fw-bold text-theme-dark mb-3">สถิติของฉัน</h6>
                       <div className="d-flex justify-content-between text-center mb-2">
                         <div className="flex-grow-1 border-end">
                           <div className="text-theme-red fs-5 mb-1">📚</div><h5 className="fw-bold text-theme-dark mb-0">{enrolledCourses.length}</h5><small className="text-muted fw-bold" style={{fontSize: '10px'}}>วิชาเรียน</small>
                         </div>
                         <div className="flex-grow-1 border-end">
                           <div className="text-theme-red fs-5 mb-1">⏳</div><h5 className="fw-bold text-danger mb-0">{missingCount}</h5><small className="text-muted fw-bold" style={{fontSize: '10px'}}>ค้างส่ง</small>
                         </div>
                         <div className="flex-grow-1">
                           <div className="text-theme-red fs-5 mb-1">✅</div><h5 className="fw-bold text-success mb-0">{doneAssignments.length + doneQuizzes.length}</h5><small className="text-muted fw-bold" style={{fontSize: '10px'}}>ทำเสร็จ</small>
                         </div>
                       </div>
                       
                       {isAtRisk ? (
                         <div className="bg-danger bg-opacity-10 border border-danger rounded-3 p-2 mt-3 d-flex align-items-center gap-2">
                            <div className="fs-3 text-danger px-2">⚠️</div>
                            <div><h6 className="text-danger fw-bold mb-0" style={{fontSize: '13px'}}>แจ้งเตือน!</h6><p className="text-danger mb-0 lh-sm" style={{fontSize: '11px'}}>มีงานค้างที่ต้องรีบจัดการด่วน!</p></div>
                         </div>
                       ) : (
                         <div className="bg-theme-dark rounded-3 p-2 mt-3 d-flex align-items-center gap-2">
                            <div className="fs-3 px-2">🚀</div>
                            <div><h6 className="text-white fw-bold mb-0" style={{fontSize: '13px'}}>เยี่ยมมาก!</h6><p className="text-white-50 mb-0 lh-sm" style={{fontSize: '11px'}}>ไม่มีงานค้าง รักษามาตรฐานนี้นะ</p></div>
                         </div>
                       )}
                     </div>
                  </div>
                </div>
              )}

              {/* 🌟 TAB 2: วิชาเรียน (ระบบเจาะลึกทีละวิชา) */}
              {activeTab === 'classroom' && (
                <div className="fade-in">
                  {!selectedCourse ? (
                    <>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                         <h5 className="fw-bold text-theme-dark m-0">แฟ้มวิชาเรียนของฉัน</h5>
                         <button onClick={() => setClassSubTab('enroll')} className="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3">➕ ลงวิชาเพิ่ม</button>
                      </div>

                      {classSubTab === 'enroll' && (
                        <div className="bg-theme-gray p-3 rounded-4 mb-4 border border-light slide-down">
                           <div className="d-flex justify-content-between align-items-center mb-2">
                              <h6 className="fw-bold text-theme-dark m-0">ลงทะเบียนเรียนเพิ่ม</h6>
                              <button onClick={() => setClassSubTab('my')} className="btn-close"></button>
                           </div>
                           <div className="row g-2 mt-2">
                             {allCourses.length === 0 ? <p className="text-muted small w-100">ไม่มีรายวิชาเปิดใหม่</p> : allCourses.map(c => {
                               const isEnrolled = enrolledCourses.includes(c.id);
                               return (
                                 <div key={c.id} className="col-12 col-md-6">
                                   <div className="bg-white p-2 rounded-3 border d-flex justify-content-between align-items-center">
                                     <div>
                                        <h6 className="fw-bold m-0 text-theme-dark" style={{fontSize:'13px'}}>{c.course_name}</h6>
                                        <small className="text-muted" style={{fontSize:'11px'}}>{c.course_code} | {c.profiles?.full_name}</small>
                                     </div>
                                     <button onClick={() => handleEnroll(c.id)} disabled={isEnrolled} className={`btn btn-sm rounded-pill fw-bold px-3 ${isEnrolled ? 'btn-light text-success' : 'btn-theme-red'}`} style={{fontSize:'11px'}}>
                                       {isEnrolled ? 'ลงแล้ว' : 'ลงทะเบียน'}
                                     </button>
                                   </div>
                                 </div>
                               )
                             })}
                           </div>
                        </div>
                      )}

                      <div className="row g-3">
                        {enrolledCourses.length === 0 ? (
                          <div className="text-center py-5">
                             <span className="fs-1 d-block mb-3">📂</span>
                             <h6 className="fw-bold text-muted">ยังไม่ได้ลงทะเบียนเรียนวิชาใดๆ</h6>
                             <button onClick={() => setClassSubTab('enroll')} className="btn btn-theme-red rounded-pill fw-bold px-4 mt-2">ลงทะเบียนวิชาเรียน</button>
                          </div>
                        ) : allCourses.filter(c => enrolledCourses.includes(c.id)).map(c => (
                          <div key={c.id} className="col-12 col-md-6 col-xl-4">
                            <div className="theme-card p-3 h-100 hover-card border border-light d-flex flex-column" onClick={() => setSelectedCourse(c)} style={{cursor: 'pointer'}}>
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger rounded-pill px-2 py-1 small">{c.course_code}</span>
                                <span className="badge bg-theme-dark text-white rounded-pill px-2 py-1 small">{c.section}</span>
                              </div>
                              <h5 className="fw-bold mb-1 text-theme-dark text-truncate" style={{fontSize: '16px'}}>{c.course_name}</h5>
                              <p className="mb-2 text-muted fw-bold" style={{fontSize: '11px'}}>👨‍🏫 {c.profiles?.full_name || 'ไม่ระบุชื่อครู'}</p>
                              
                              <div className="mt-auto pt-3 d-flex gap-2">
                                 <button className="btn btn-light w-100 rounded-pill fw-bold text-theme-dark border shadow-sm" style={{fontSize:'12px'}}>เข้าเรียน ➔</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* 🌟 หน้าต่างเจาะลึกเฉพาะวิชานั้นๆ (Deep Dive View) */
                    <div className="slide-up">
                      <button onClick={() => setSelectedCourse(null)} className="btn btn-sm btn-light rounded-pill fw-bold mb-3 border shadow-sm">⬅️ กลับหน้ารวมวิชา</button>
                      <div className="hero-card mb-3 p-4 bg-theme-dark">
                         <span className="badge bg-danger mb-2 px-3 py-1 rounded-pill">{selectedCourse.course_code}</span>
                         <h4 className="fw-bold text-white mb-1">{selectedCourse.course_name}</h4>
                         <p className="text-white-50 mb-0 small">ครูผู้สอน: {selectedCourse.profiles?.full_name} | กลุ่ม: {selectedCourse.section}</p>
                      </div>

                      <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 border border-light">
                        <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 small ${courseViewTab === 'materials' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setCourseViewTab('materials')}>📚 เอกสาร</button>
                        <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 small ${courseViewTab === 'assignments' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setCourseViewTab('assignments')}>📝 งาน</button>
                        <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 small ${courseViewTab === 'quizzes' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setCourseViewTab('quizzes')}>✍️ แบบทดสอบ</button>
                      </div>

                      {courseViewTab === 'materials' && (
                        <div className="row g-3">
                          {materials.filter(m => m.course_id === selectedCourse.id).length === 0 ? <p className="text-center text-muted py-4 w-100 fw-bold small">ไม่มีเอกสารในวิชานี้</p> : 
                            materials.filter(m => m.course_id === selectedCourse.id).map(m => {
                              const ytThumb = getYoutubeThumbnail(m.file_url);
                              const moduleName = modules.find(mod => mod.id === m.module_id)?.title; 
                              return (
                                <div key={m.id} className="col-12 col-md-6">
                                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="theme-card p-3 d-flex flex-row align-items-center gap-3 text-decoration-none hover-card h-100">
                                    {ytThumb ? (
                                      <div className="rounded-3 overflow-hidden shadow-sm" style={{ width: '60px', height: '45px', flexShrink: 0 }}><img src={ytThumb} alt="youtube thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                                    ) : (
                                      <div className="bg-danger bg-opacity-10 text-danger border border-danger rounded-3 d-flex align-items-center justify-content-center p-2 fs-4" style={{width: '60px', height: '45px', flexShrink: 0}}>📎</div>
                                    )}
                                    <div className="flex-grow-1 overflow-hidden">
                                      <h6 className="fw-bold mb-1 text-truncate text-theme-dark" style={{fontSize: '14px'}}>{m.title}</h6>
                                      {moduleName && <span className="badge bg-theme-gray text-theme-dark border mt-1" style={{fontSize:'10px'}}>{moduleName}</span>}
                                    </div>
                                    <div className="btn btn-light btn-sm text-theme-red rounded-circle p-1 shadow-sm fw-bold">⬇️</div>
                                  </a>
                                </div>
                              )
                          })}
                        </div>
                      )}

                      {courseViewTab === 'assignments' && (
                        <div className="d-flex flex-column gap-3">
                          {assignments.filter(a => a.course_id === selectedCourse.id).length === 0 ? <p className="text-center text-muted py-4 fw-bold small">ไม่มีงานในวิชานี้</p> : 
                            assignments.filter(a => a.course_id === selectedCourse.id).map(a => {
                              const mySub = submissions.find(s => s.assignment_id === a.id); 
                              const isCurrentForm = submitForm.assign_id === a.id;
                              return (
                                <div key={a.id} className="theme-card p-0 overflow-hidden d-flex flex-column border border-light">
                                  <div className={`p-1 ${mySub ? 'bg-success' : 'bg-theme-red'}`}></div>
                                  <div className="p-3 d-flex flex-column flex-grow-1">
                                    <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize: '15px'}}>{a.title}</h6>
                                    <p className="text-theme-dark small mb-3 bg-theme-gray p-2 rounded-3 fw-bold border" style={{fontSize: '12px'}}>{a.description}</p>
                                    
                                    {mySub ? (
                                        <div className="bg-light p-2 rounded-3 border border-light mt-auto">
                                          <h6 className="fw-bold text-success mb-2 d-flex align-items-center gap-2 small"><span>✅</span> ส่งงานแล้ว</h6>
                                          {mySub.score !== null ? <span className="badge bg-success rounded-pill px-2 py-1 mb-2">ได้คะแนน: {mySub.score}</span> : <span className="badge bg-warning rounded-pill px-2 py-1 mb-2 text-dark">รอตรวจ</span>}
                                          {mySub.teacher_feedback && <div className="bg-danger bg-opacity-10 p-2 rounded-3 border border-danger mb-2 small text-danger">💬 ครู: {mySub.teacher_feedback}</div>}
                                          {mySub.score === null && <button onClick={() => handleUnsubmit(mySub.id)} className="btn btn-sm btn-outline-danger rounded-pill fw-bold w-100 py-1" style={{fontSize: '12px'}}>❌ ยกเลิกการส่ง</button>}
                                        </div>
                                    ) : (
                                        <form onSubmit={(e) => handleWorkSubmit(e, a.id)} className="bg-theme-gray p-2 rounded-3 border border-light mt-auto">
                                          <div className="d-flex flex-column gap-2 mb-2">
                                            <textarea className="theme-input form-control bg-white text-dark py-2 px-3" placeholder="💬 พิมพ์คำตอบ..." value={isCurrentForm ? submitForm.text : ''} onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, text: e.target.value })} rows="1" style={{fontSize: '12px'}} />
                                            <input type="file" className="form-control form-control-sm border-0 shadow-none bg-white text-dark py-1 px-2 rounded-2" onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, file: e.target.files[0] })} />
                                          </div>
                                          <button type="submit" className="btn btn-theme-red w-100 rounded-pill fw-bold py-1 shadow-sm" style={{fontSize: '12px'}} disabled={uploadingWork}>ส่งคำตอบ</button>
                                        </form>
                                    )}
                                  </div>
                                </div>
                              )
                          })}
                        </div>
                      )}

                      {courseViewTab === 'quizzes' && (
                        <div className="row g-3">
                          {quizzes.filter(q => q.course_id === selectedCourse.id).length === 0 ? <p className="text-center text-muted py-4 w-100 fw-bold small">ไม่มีแบบทดสอบในวิชานี้</p> : 
                            quizzes.filter(q => q.course_id === selectedCourse.id).map(q => {
                              const isDone = quizSubmissions.find(qs => qs.quiz_id === q.id); 
                              return (
                                <div key={q.id} className="col-12 col-md-6">
                                  <div className="theme-card p-3 h-100 d-flex flex-column border border-light">
                                    <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize: '14px'}}>{q.title}</h6>
                                    {q.time_limit > 0 && <p className="text-danger fw-bold mb-3" style={{fontSize: '11px'}}>⏳ เวลาทำข้อสอบ: {q.time_limit} นาที</p>}
                                    <div className="mt-auto">
                                      {isDone ? (
                                        <div className="bg-light text-theme-dark fw-bold text-center p-2 rounded-pill border" style={{fontSize: '12px'}}>✅ ทำแล้ว ({isDone.score}/{isDone.total_score})</div>
                                      ) : (
                                        <button onClick={() => handleStartQuiz(q)} className="btn btn-theme-red rounded-pill fw-bold py-2 shadow-sm w-100" style={{fontSize: '12px'}}>✍️ เริ่มทำแบบทดสอบ</button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                          })}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* 🌟 TAB 3: ภาระงาน (แยก 3 สถานะชัดเจน) */}
              {activeTab === 'tasks' && (
                <div className="fade-in">
                  <h5 className="fw-bold text-theme-dark mb-3">ภาระงานทั้งหมด</h5>
                  
                  <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 border border-light">
                    <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 position-relative small ${taskFilter === 'todo' ? 'btn-danger shadow-sm' : 'btn-white text-muted'}`} onClick={() => setTaskFilter('todo')}>
                      🚨 ต้องทำ {todoAssignments.length + todoQuizzes.length > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-dark" style={{fontSize:'9px'}}>{todoAssignments.length + todoQuizzes.length}</span>}
                    </button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 small ${taskFilter === 'pending' ? 'btn-warning text-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setTaskFilter('pending')}>
                      ⏳ รอตรวจ
                    </button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 small ${taskFilter === 'done' ? 'btn-success shadow-sm' : 'btn-white text-muted'}`} onClick={() => setTaskFilter('done')}>
                      ✅ เสร็จสิ้น
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-3">
                     {taskFilter === 'todo' && (
                       <>
                         {todoAssignments.length === 0 && todoQuizzes.length === 0 && <div className="text-center py-5 text-muted fw-bold small"><span className="fs-1 d-block mb-2">🎉</span>ไม่มีงานค้าง เยี่ยมมาก!</div>}
                         {todoAssignments.map(a => (
                            <div key={a.id} className="theme-card p-3 border-start border-4 border-danger d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                               <div><span className="badge bg-danger bg-opacity-10 text-danger border border-danger mb-2">งานที่ต้องทำ</span><h6 className="fw-bold text-theme-dark mb-1">{a.title}</h6><p className="text-muted small fw-bold m-0">{a.courses.course_name}</p></div>
                               <button onClick={() => { setActiveTab('classroom'); setSelectedCourse(allCourses.find(c=>c.id === a.course_id)); setCourseViewTab('assignments'); }} className="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3">ไปที่งาน ➔</button>
                            </div>
                         ))}
                         {todoQuizzes.map(q => (
                            <div key={q.id} className="theme-card p-3 border-start border-4 border-danger d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                               <div><span className="badge bg-danger bg-opacity-10 text-danger border border-danger mb-2">แบบทดสอบ</span><h6 className="fw-bold text-theme-dark mb-1">{q.title}</h6><p className="text-muted small fw-bold m-0">{q.courses.course_name}</p></div>
                               <button onClick={() => { setActiveTab('classroom'); setSelectedCourse(allCourses.find(c=>c.id === q.course_id)); setCourseViewTab('quizzes'); }} className="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3">ไปทำข้อสอบ ➔</button>
                            </div>
                         ))}
                       </>
                     )}

                     {taskFilter === 'pending' && (
                       <>
                         {pendingAssignments.length === 0 && <div className="text-center py-5 text-muted fw-bold small"><span className="fs-1 d-block mb-2">📭</span>ไม่มีงานที่รอตรวจ</div>}
                         {pendingAssignments.map(a => (
                            <div key={a.id} className="theme-card p-3 border-start border-4 border-warning d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                               <div><span className="badge bg-warning text-dark mb-2">ส่งแล้ว รอตรวจ</span><h6 className="fw-bold text-theme-dark mb-1">{a.title}</h6><p className="text-muted small fw-bold m-0">{a.courses.course_name}</p></div>
                            </div>
                         ))}
                       </>
                     )}

                     {taskFilter === 'done' && (
                       <>
                         {doneAssignments.length === 0 && doneQuizzes.length === 0 && <div className="text-center py-5 text-muted fw-bold small"><span className="fs-1 d-block mb-2">📝</span>ยังไม่มีงานที่ทำเสร็จแล้ว</div>}
                         {doneAssignments.map(a => (
                            <div key={a.id} className="theme-card p-3 border-start border-4 border-success d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                               <div><span className="badge bg-success bg-opacity-10 text-success border border-success mb-2">งานตรวจแล้ว</span><h6 className="fw-bold text-theme-dark mb-1">{a.title}</h6><p className="text-muted small fw-bold m-0">{a.courses.course_name}</p></div>
                               <span className="fw-bold fs-5 text-success">{mySubMap[a.id].score} คะแนน</span>
                            </div>
                         ))}
                         {doneQuizzes.map(q => (
                            <div key={q.id} className="theme-card p-3 border-start border-4 border-success d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                               <div><span className="badge bg-success bg-opacity-10 text-success border border-success mb-2">สอบแล้ว</span><h6 className="fw-bold text-theme-dark mb-1">{q.title}</h6><p className="text-muted small fw-bold m-0">{q.courses.course_name}</p></div>
                               <span className="fw-bold fs-5 text-success">{myQuizSubMap[q.id].score}/{myQuizSubMap[q.id].total_score}</span>
                            </div>
                         ))}
                       </>
                     )}
                  </div>
                </div>
              )}

              {/* TAB 4: โปรไฟล์ */}
              {activeTab === 'profile' && (
                <div className="fade-in row justify-content-center">
                  <div className="col-12 col-md-8 col-xl-6">
                    <h5 className="fw-bold text-theme-dark mb-3">บัญชีผู้ใช้</h5>
                    
                    <div className="hero-card mb-3 text-center p-4">
                      <div className="bg-white rounded-circle border border-4 border-white shadow-lg mx-auto mb-2 d-flex justify-content-center align-items-center overflow-hidden" style={{ width: "80px", height: "80px", fontSize: "30px", zIndex: 2, position: 'relative' }}>
                         {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👨‍🎓'}
                      </div>
                      <div style={{zIndex: 2, position: 'relative'}}>
                        <h5 className="fw-bold mb-1">{profileForm.full_name || 'นักศึกษา'}</h5>
                        <p className="text-white-50 mb-0 small">{session?.user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="theme-card mb-4 border border-light p-3">
                      <h6 className="fw-bold mb-3 text-theme-dark text-center">แก้ไขข้อมูลส่วนตัว</h6>
                      <form onSubmit={handleUpdateProfile}>
                        <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>ชื่อ - นามสกุล</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.full_name} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} required style={{fontSize: '13px'}} /></div>
                        <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>ชื่อเล่น</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.nickname} onChange={e => setProfileForm({...profileForm, nickname: e.target.value})} style={{fontSize: '13px'}} /></div>
                        <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>เบอร์โทรศัพท์</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} style={{fontSize: '13px'}} /></div>
                        <div className="mb-3">
                          <label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>อัปโหลดรูปโปรไฟล์</label>
                          <input type="file" accept="image/*" className="form-control theme-input bg-white text-dark py-1" onChange={handleUploadAvatar} disabled={uploadingAvatar} style={{fontSize: '12px'}} />
                          {uploadingAvatar && <small className="text-danger mt-1 ms-2 d-block fw-bold" style={{fontSize: '10px'}}>⏳ กำลังอัปโหลด...</small>}
                        </div>

                        <hr className="my-3 border-light" />
                        
                        <h6 className="fw-bold mb-2 text-theme-dark d-flex align-items-center gap-2" style={{fontSize: '13px'}}><span>✈️</span> แจ้งเตือนผ่าน Telegram</h6>
                        <div className="bg-theme-dark text-white p-3 rounded-4 mb-3 shadow-sm">
                           <p className="mb-2 text-white-50" style={{fontSize: '11px'}}>1. กดปุ่มเพื่อเปิด Telegram และรับรหัส Chat ID จาก @getmyid_bot</p>
                           <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-theme-red rounded-pill px-3 py-1 shadow-sm mb-3 fw-bold" style={{fontSize: '11px'}}>👉 เปิดเพื่อรับรหัส Chat ID</a>
                           <p className="mb-1 text-white-50" style={{fontSize: '11px'}}>2. นำตัวเลข Chat ID มาวางที่นี่</p>
                           <input type="text" className="form-control bg-white text-dark border-0 rounded-pill px-3 py-2 fw-bold" placeholder="ตัวอย่าง 123456789" value={profileForm.telegram_chat_id || ''} onChange={e => setProfileForm({...profileForm, telegram_chat_id: e.target.value})} style={{fontSize: '13px'}} />
                           {profileForm.telegram_chat_id && <small className="text-success fw-bold d-block mt-2" style={{fontSize: '10px'}}>✅ ข้อมูล Chat ID พร้อมใช้งานแล้ว</small>}
                        </div>
                        
                        <hr className="my-3 border-light" />
                        <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize: '13px'}}>ข้อมูลระบบ (แก้ไขไม่ได้)</h6>
                        
                        <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>รหัสประจำตัว</label><input type="text" className="form-control theme-input bg-theme-gray text-muted py-2" value={profileForm.student_code} disabled style={{fontSize: '13px'}} /></div>
                        <div className="row mb-3 g-2">
                          <div className="col-6"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>ระดับชั้น</label><input type="text" className="form-control theme-input bg-theme-gray text-muted py-2" value={profileForm.grade_level} disabled style={{fontSize: '13px'}} /></div>
                          <div className="col-6"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>แผนกวิชา</label><input type="text" className="form-control theme-input bg-theme-gray text-truncate text-muted py-2" value={profileForm.department} disabled title={profileForm.department} style={{fontSize: '13px'}} /></div>
                        </div>

                        <button type="submit" className="btn btn-theme-dark w-100 rounded-pill fw-bold py-2 shadow-sm" style={{fontSize: '14px'}}>💾 บันทึกข้อมูล</button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {!takingQuiz && (
        <div className="bottom-nav d-md-none">
          <button onClick={() => handleTabChange('home')} className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}><span className="icon">🏠</span>หน้าหลัก</button>
          <button onClick={() => handleTabChange('classroom')} className={`bottom-nav-item ${activeTab === 'classroom' ? 'active' : ''}`}><span className="icon">📚</span>วิชาเรียน</button>
          <button onClick={() => handleTabChange('tasks')} className={`bottom-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}><span className="icon">📝</span>ภาระงาน</button>
          <button onClick={() => handleTabChange('profile')} className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}><span className="icon">👤</span>ฉัน</button>
        </div>
      )}
    </div>
  )
}