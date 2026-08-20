import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2' 

export default function StudentDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home') 
  const [classSubTab, setClassSubTab] = useState('enroll') 
  const [taskSubTab, setTaskSubTab] = useState('assignments') 

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
    if (annData) setAnnouncements(annData)

    const { data: cData } = await supabase.from('courses').select('*, profiles(full_name)').order('created_at', { ascending: false })
    if (cData && pData) {
      const studentDept = pData.department || '';
      const studentLevel = pData.grade_level || '';
      const baseLevel = studentLevel.split('/')[0];
      const myClassCourses = cData.filter(course => {
        const section = course.section || '';
        if (!studentDept) return false;
        const matchDept = section.includes(studentDept);
        const matchLevel = baseLevel ? section.includes(baseLevel) : true;
        return matchDept && matchLevel;
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

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleUploadAvatar = async (e) => {
    try {
      setUploadingAvatar(true);
      const file = e.target.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `user_${session.user.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfileForm({ ...profileForm, avatar_url: publicUrl });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 3000 });
    } catch (error) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถอัปโหลดรูปได้: ${error.message}`, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => { 
    e.preventDefault(); 
    await supabase.from('profiles').update({ 
      full_name: profileForm.full_name, nickname: profileForm.nickname, phone: profileForm.phone, avatar_url: profileForm.avatar_url, telegram_chat_id: profileForm.telegram_chat_id
    }).eq('id', session.user.id); 
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
    if (!submitForm.text && !submitForm.link && !submitForm.file) {
      Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์คำตอบ แนบลิงก์ หรือเลือกไฟล์ อย่างน้อย 1 อย่างครับ', 'warning'); return;
    }
    setUploadingWork(true);
    let finalFileUrl = null;
    try {
      if (submitForm.file) {
        const fileExt = submitForm.file.name.split('.').pop();
        const fileName = `student_${session.user.id}_assign_${assignId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('student_submissions').upload(fileName, submitForm.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('student_submissions').getPublicUrl(fileName);
        finalFileUrl = publicUrl;
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
    const result = await Swal.fire({ title: 'ยกเลิกการส่งงาน?', text: 'คุณต้องการยกเลิกการส่งงานนี้เพื่อส่งใหม่ใช่หรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', cancelButtonColor: '#6c757d', confirmButtonText: 'ใช่, ยกเลิกการส่ง', cancelButtonText: 'ปิด' });
    if (!result.isConfirmed) return;
    try {
      await supabase.from('submissions').delete().eq('id', subId);
      fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ยกเลิกการส่งงานแล้ว', showConfirmButton: false, timer: 2000 });
    } catch (error) { Swal.fire('เกิดข้อผิดพลาด', error.message, 'error'); }
  };

  const handleStartQuiz = (quiz) => { 
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
    setTakingQuiz({ ...quiz, questions: shuffledQuestions }); setQuizAnswers({}); cheatWarningsRef.current = 0; 
    if (quiz.time_limit && quiz.time_limit > 0) setTimeLeft(quiz.time_limit * 60); else setTimeLeft(null);
  }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < takingQuiz.questions.length) { 
      const result = await Swal.fire({ title: 'ทำข้อสอบยังไม่ครบ!', text: 'ต้องการส่งคำตอบเลยหรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', cancelButtonColor: '#6c757d', confirmButtonText: 'ส่งเลย', cancelButtonText: 'กลับไปทำต่อ' });
      if (!result.isConfirmed) return;
    }
    let score = 0; takingQuiz.questions.forEach((q, index) => { if (quizAnswers[index] === q.correctOption) score++; });
    await supabase.from('quiz_submissions').insert([{ quiz_id: takingQuiz.id, student_id: session.user.id, score: score, total_score: takingQuiz.questions.length, is_cheated: false }]);
    Swal.fire('ส่งข้อสอบสำเร็จ!', `คุณทำได้ ${score}/${takingQuiz.questions.length} คะแนน`, 'success'); 
    setTakingQuiz(null); setQuizAnswers({}); setTimeLeft(null); cheatWarningsRef.current = 0; fetchData(); 
  }

  const navigateToService = (tab, subTab) => { setActiveTab(tab); if (subTab) { tab === 'classroom' ? setClassSubTab(subTab) : setTaskSubTab(subTab); } }

  // 🌟 (กู้คืนโค้ดส่วนที่หายไป) คำนวณความเสี่ยงและงานค้างของนักเรียน
  const totalAssignments = assignments.length; 
  const completedAssignments = submissions.length; 
  const missingCount = totalAssignments - completedAssignments;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  
  let totalScore = 0; let gradedCount = 0; 
  submissions.forEach(s => { if(s.score !== null){ totalScore += s.score; gradedCount++; } });
  const avgScore = gradedCount > 0 ? (totalScore / (gradedCount * 10)) * 100 : 100; 
  const isAtRisk = missingCount >= 2 || avgScore < 50;

  if (!session || session.role !== 'student') return <Navigate to="/" />

  return (
    <div className="app-layout font-app">
      
      {/* 🖥️ Desktop Sidebar */}
      <div className={`sidebar ${takingQuiz ? 'd-none' : ''} shadow-sm`}>
        <div className="d-flex align-items-center gap-3 mb-5 px-2 mt-2">
          {/* 🌟 ใส่โลโก้วิทยาลัย */}
          <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'50px', height:'50px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
          <h4 className="fw-bold m-0 text-theme-dark">สมาร์ท LMS</h4>
        </div>
        <div className="d-flex flex-column gap-2 flex-grow-1">
          <button className={`nav-link-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><span className="fs-5">🏠</span> หน้าหลัก</button>
          <button className={`nav-link-btn ${activeTab === 'classroom' ? 'active' : ''}`} onClick={() => setActiveTab('classroom')}><span className="fs-5">📚</span> ห้องเรียน</button>
          <button className={`nav-link-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}><span className="fs-5">📝</span> งานและสอบ</button>
          <button className={`nav-link-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><span className="fs-5">👤</span> บัญชีผู้ใช้</button>
        </div>
        <div className="mt-auto border-top pt-3">
          <button onClick={handleLogout} className="nav-link-btn text-danger w-100"><span className="fs-5">🚪</span> ออกจากระบบ</button>
        </div>
      </div>

      {/* 📱 Main Content Area */}
      <div className="main-content">
        
        {/* Mobile Header (Hidden on taking quiz) */}
        {!takingQuiz && (
          <div className="mobile-only d-flex justify-content-between align-items-center p-4 bg-white shadow-sm sticky-top z-3">
            <div className="d-flex align-items-center gap-3">
              <div className="bg-theme-dark rounded-circle shadow-sm overflow-hidden d-flex justify-content-center align-items-center border border-2 border-white" style={{width: '45px', height: '45px', fontSize: '20px'}}>
                  {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👨‍🎓'}
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-theme-dark">สวัสดี, {profileForm.full_name || 'นักศึกษา'}</h6>
                <small className="text-muted fw-bold">พร้อมเรียนรู้หรือยัง!</small>
              </div>
            </div>
            {/* 🌟 ใส่โลโก้วิทยาลัย */}
            <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'40px', height:'40px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
          </div>
        )}

        <div className="container-fluid p-4" style={{ maxWidth: '1200px' }}>
          
          {takingQuiz ? (
             <div className="theme-card p-0 overflow-hidden mb-5 slide-up border border-theme-red">
                <div className="bg-theme-dark text-white p-4 p-md-5 position-relative">
                  <h4 className="mb-1 fw-bold">{takingQuiz.title}</h4>
                  <small className="text-white-50 mt-1 d-block fw-bold">⚠️ ห้ามสลับหน้าจอหรือย่อแอปขณะสอบ</small>
                  {timeLeft !== null && (
                    <div className="bg-theme-red text-white fw-bold px-4 py-2 rounded-pill shadow-lg mt-3 d-inline-block border border-white">
                      ⏳ เหลือเวลา: {formatTime(timeLeft)} นาที
                    </div>
                  )}
                </div>
                <div className="card-body p-4 p-md-5 bg-white">
                  {takingQuiz.questions.map((q, qIndex) => (
                    <div key={qIndex} className="mb-5 pb-4">
                      <h5 className="fw-bold mb-4 text-theme-dark">{qIndex + 1}. {q.question}</h5>
                      {q.imageUrl && (
                        <div className="mb-4 rounded-4 overflow-hidden shadow-sm border border-light text-center">
                          <img src={q.imageUrl} alt="ภาพประกอบโจทย์" className="w-100 object-fit-contain" style={{ maxHeight: '300px' }} />
                        </div>
                      )}
                      <div className="d-flex flex-column gap-3">
                        {q.options.map((opt, optIndex) => (
                          <label key={optIndex} className={`d-flex align-items-center gap-3 border p-4 rounded-4 transition-all ${quizAnswers[qIndex] === optIndex ? 'border-theme-red bg-theme-red bg-opacity-10 fw-bold text-theme-red shadow-sm' : 'border-light bg-light hover-bg-gray'}`} style={{cursor: 'pointer'}}>
                            <input type="radio" name={`q-${qIndex}`} className="form-check-input mt-0 flex-shrink-0" style={{width: '22px', height:'22px', accentColor: 'var(--theme-red)'}} checked={quizAnswers[qIndex] === optIndex} onChange={() => setQuizAnswers({...quizAnswers, [qIndex]: optIndex})} />
                            <span className="fs-6">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="d-flex flex-column flex-md-row gap-3 pt-3 border-top">
                    <button onClick={() => { setTakingQuiz(null); setTimeLeft(null); }} className="btn btn-light rounded-pill fw-bold px-5 py-3 text-muted">ยกเลิกสอบ</button>
                    <button onClick={handleQuizSubmit} className="btn btn-theme-red rounded-pill fw-bold py-3 px-5 shadow-sm flex-grow-1">ส่งข้อสอบ</button>
                  </div>
                </div>
             </div>
          ) : (
            <>
              {/* TAB 1: หน้าหลัก (Grid Layout) */}
              {activeTab === 'home' && (
                <div className="fade-in row g-4">
                  
                  <div className="col-12 col-xl-8">
                    {/* Hero Card */}
                    <div className="hero-card mb-4 d-flex flex-column justify-content-center">
                      <div style={{zIndex: 2, position: 'relative'}}>
                        <h2 className="fw-bold mb-2">เตรียมพร้อม<br/>สู่ความสำเร็จ</h2>
                        <p className="text-white-50 mb-4" style={{maxWidth: '80%'}}>ติดตามความคืบหน้า งานที่ได้รับมอบหมาย และเป้าหมายของคุณได้ที่นี่</p>
                        <button onClick={() => navigateToService('tasks', 'assignments')} className="btn btn-theme-red rounded-pill px-4 py-2 fw-bold shadow-sm">ดูงานที่ค้างส่ง ➔</button>
                      </div>
                    </div>

                    {/* Quick Services */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold mb-0 text-theme-dark">บริการต่างๆ</h5>
                    </div>
                    <div className="row g-3 text-center mb-4">
                      <div className="col-3"><button onClick={() => navigateToService('classroom', 'enroll')} className="theme-card p-3 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-2">➕</span><span className="text-muted fw-bold" style={{fontSize:'12px'}}>ลงทะเบียน</span></button></div>
                      <div className="col-3"><button onClick={() => navigateToService('classroom', 'materials')} className="theme-card p-3 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-2">📎</span><span className="text-muted fw-bold" style={{fontSize:'12px'}}>เอกสาร</span></button></div>
                      <div className="col-3"><button onClick={() => navigateToService('tasks', 'assignments')} className="theme-card p-3 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-2">📝</span><span className="text-muted fw-bold" style={{fontSize:'12px'}}>ส่งงาน</span></button></div>
                      <div className="col-3"><button onClick={() => navigateToService('tasks', 'quizzes')} className="theme-card p-3 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-2">✍️</span><span className="text-muted fw-bold" style={{fontSize:'12px'}}>แบบทดสอบ</span></button></div>
                    </div>

                    {/* Recent Tasks */}
                    <h5 className="fw-bold mb-3 text-theme-dark">งานล่าสุด</h5>
                    <div className="d-flex flex-column gap-3">
                      {assignments.filter(a => !submissions.find(s => s.assignment_id === a.id)).slice(0, 3).map(a => (
                        <div key={a.id} className="theme-card p-3 d-flex align-items-center gap-3">
                          <div className="bg-theme-red bg-opacity-10 text-theme-red rounded-3 p-3 fs-5">📝</div>
                          <div className="flex-grow-1 overflow-hidden">
                            <h6 className="fw-bold mb-1 text-truncate text-theme-dark">{a.title}</h6>
                            <small className="text-muted fw-bold">{a.courses.course_name}</small>
                          </div>
                          <button onClick={() => navigateToService('tasks', 'assignments')} className="btn btn-light rounded-circle text-theme-red fw-bold shadow-sm p-2">→</button>
                        </div>
                      ))}
                      {assignments.filter(a => !submissions.find(s => s.assignment_id === a.id)).length === 0 && (
                        <div className="theme-card p-4 text-center"><span className="text-muted fw-bold">✅ ไม่มีงานค้างในขณะนี้!</span></div>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-xl-4">
                     {/* Stats Panel */}
                     <div className="theme-card bg-white border border-light mb-4 p-4">
                       <h6 className="fw-bold text-theme-dark mb-4">สถิติของฉัน</h6>
                       <div className="d-flex justify-content-between text-center mb-3">
                         <div className="flex-grow-1 border-end">
                           <div className="text-theme-red fs-4 mb-1">📚</div><h4 className="fw-bold text-theme-dark mb-0">{enrolledCourses.length}</h4><small className="text-muted fw-bold" style={{fontSize: '11px'}}>วิชาเรียน</small>
                         </div>
                         <div className="flex-grow-1 border-end">
                           <div className="text-theme-red fs-4 mb-1">⏳</div><h4 className="fw-bold text-theme-dark mb-0">{missingCount}</h4><small className="text-muted fw-bold" style={{fontSize: '11px'}}>ค้างส่ง</small>
                         </div>
                         <div className="flex-grow-1">
                           <div className="text-theme-red fs-4 mb-1">📈</div><h4 className="fw-bold text-theme-dark mb-0">{progressPercentage}%</h4><small className="text-muted fw-bold" style={{fontSize: '11px'}}>ก้าวหน้า</small>
                         </div>
                       </div>
                       
                       {/* Alert Banner */}
                       {isAtRisk ? (
                         <div className="bg-theme-red bg-opacity-10 rounded-4 p-3 mt-3 d-flex align-items-center gap-3">
                            <div className="fs-2 text-theme-red">⚠️</div>
                            <div><h6 className="text-theme-red fw-bold mb-1">แจ้งเตือน!</h6><p className="small text-theme-red mb-0 lh-sm">คุณมีงานค้างหรือคะแนนต่ำกว่าเกณฑ์</p></div>
                         </div>
                       ) : (
                         <div className="bg-theme-dark rounded-4 p-3 mt-3 d-flex align-items-center gap-3">
                            <div className="fs-2">🚀</div>
                            <div><h6 className="text-white fw-bold mb-1">เยี่ยมมาก!</h6><p className="small text-white-50 mb-0 lh-sm">ตั้งใจเรียนและรักษามาตรฐานนี้ไว้นะ</p></div>
                         </div>
                       )}
                     </div>

                     {/* Announcements */}
                     {announcements.length > 0 && (
                        <>
                          <h6 className="fw-bold mb-3 text-theme-dark">ประกาศข่าวสาร</h6>
                          <div className="d-flex flex-column gap-2">
                            {announcements.map(ann => (
                              <div key={ann.id} className="theme-card p-3 d-flex gap-3">
                                <div className="fs-4">📢</div>
                                <div><h6 className="fw-bold mb-1 text-theme-dark">{ann.title}</h6><p className="small text-muted mb-0 lh-sm">{ann.content}</p></div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                  </div>

                </div>
              )}

              {/* TAB 2: ห้องเรียน */}
              {activeTab === 'classroom' && (
                <div className="fade-in">
                  <h4 className="fw-bold text-theme-dark mb-4">ห้องเรียน</h4>
                  <div className="d-flex bg-white p-2 rounded-pill shadow-sm mb-4">
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'enroll' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('enroll')}>ลงทะเบียน</button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'materials' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('materials')}>เอกสารประกอบ</button>
                  </div>
                  
                  {classSubTab === 'materials' && (
                    <div className="row g-3">
                      {materials.length === 0 ? <p className="text-center text-muted py-5 col-12 fw-bold">ยังไม่มีเอกสารในวิชาของคุณ</p> : materials.map(m => {
                        const ytThumb = getYoutubeThumbnail(m.file_url);
                        const moduleName = modules.find(mod => mod.id === m.module_id)?.title; 
                        return (
                          <div key={m.id} className="col-12 col-md-6">
                            <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="theme-card p-3 d-flex flex-row align-items-center gap-3 text-decoration-none hover-card h-100">
                              {ytThumb ? (
                                <div className="rounded-3 overflow-hidden shadow-sm" style={{ width: '80px', height: '60px', flexShrink: 0 }}><img src={ytThumb} alt="youtube thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                              ) : (
                                <div className="bg-theme-red bg-opacity-10 text-theme-red rounded-3 d-flex align-items-center justify-content-center p-3 fs-3" style={{flexShrink: 0}}>📎</div>
                              )}
                              <div className="flex-grow-1 overflow-hidden">
                                <h6 className="fw-bold mb-1 text-truncate text-theme-dark">{m.title}</h6>
                                <p className="text-muted small mb-0 text-truncate fw-bold">{m.courses.course_name} {moduleName && <span className="text-theme-red">[{moduleName}]</span>}</p>
                              </div>
                              <div className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm fw-bold">⬇️</div>
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {classSubTab === 'enroll' && (
                    <div className="row g-3">
                      {allCourses.length === 0 ? <p className="text-center text-muted py-5 col-12 fw-bold">ยังไม่มีรายวิชาเปิดสำหรับกลุ่มเรียนของคุณ</p> : allCourses.map(c => { 
                        const isEnrolled = enrolledCourses.includes(c.id); 
                        return (
                          <div key={c.id} className="col-12 col-md-6 col-xl-4">
                            <div className="theme-card p-4 h-100 d-flex flex-column">
                              <div className="d-flex justify-content-between align-items-start mb-3">
                                <span className="badge bg-theme-red bg-opacity-10 text-theme-red rounded-pill px-3 py-2">{c.course_code}</span>
                                <span className="badge bg-theme-dark text-white rounded-pill px-3 py-2">{c.section}</span>
                              </div>
                              <h5 className="fw-bold mb-2 text-theme-dark">{c.course_name}</h5>
                              <p className="mb-2 text-theme-dark fw-bold small">👨‍🏫 ผู้สอน: <span className="text-muted">{c.profiles?.full_name || '-'}</span></p>
                              <p className="text-muted small mb-4 fw-bold">ภาคเรียน: {c.semester||'-'} | หน่วยกิต: {c.credits||'-'}</p>
                              <button onClick={() => handleEnroll(c.id)} disabled={isEnrolled} className={`btn w-100 rounded-pill fw-bold py-3 mt-auto ${isEnrolled ? 'btn-light text-success border-0 shadow-none' : 'btn-theme-red shadow-sm'}`}>
                                {isEnrolled ? '✅ ลงทะเบียนแล้ว' : '➕ ลงทะเบียนเรียน'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: งานและแบบทดสอบ */}
              {activeTab === 'tasks' && (
                <div className="fade-in">
                  <h4 className="fw-bold text-theme-dark mb-4">งานและสอบ</h4>
                  <div className="d-flex bg-white p-2 rounded-pill shadow-sm mb-4">
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'assignments' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('assignments')}>ส่งงาน</button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'quizzes' ? 'btn-theme-dark shadow-sm' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('quizzes')}>แบบทดสอบ</button>
                  </div>
                  
                  {taskSubTab === 'assignments' && (
                    <div className="row g-4">
                      {assignments.length === 0 ? <p className="text-center text-muted py-5 col-12 fw-bold">เยี่ยมมาก! ไม่มีงานค้าง</p> : assignments.map(a => { 
                        const mySub = submissions.find(s => s.assignment_id === a.id); 
                        const isCurrentForm = submitForm.assign_id === a.id;
                        const moduleName = modules.find(mod => mod.id === a.module_id)?.title;

                        return (
                          <div key={a.id} className="col-12 col-xl-6">
                            <div className="theme-card p-0 overflow-hidden h-100 d-flex flex-column border border-light">
                              <div className={`p-1 ${mySub ? 'bg-success' : 'bg-theme-red'}`}></div>
                              <div className="p-4 d-flex flex-column flex-grow-1">
                                <p className="text-muted small mb-2 fw-bold">{a.courses.course_name} {moduleName && <span className="text-theme-red">[{moduleName}]</span>}</p>
                                <h5 className="fw-bold mb-3 text-theme-dark">{a.title}</h5>
                                <p className="text-theme-dark small mb-4 bg-theme-gray p-3 rounded-4 fw-bold">{a.description}</p>
                                
                                <div className="mt-auto">
                                  {mySub ? (
                                    <div className="bg-light p-3 rounded-4 position-relative border border-light">
                                      <h6 className="fw-bold text-success mb-3 d-flex align-items-center gap-2"><span>✅</span> ส่งงานแล้ว</h6>
                                      {mySub.submitted_text && <p className="small mb-2 text-theme-dark bg-white p-2 rounded-3 border fw-bold">"{mySub.submitted_text}"</p>}
                                      {mySub.link_url && (
                                        <div className="mb-2">
                                          {getYoutubeThumbnail(mySub.link_url) ? (
                                            <div className="mb-2 overflow-hidden rounded-3 shadow-sm"><img src={getYoutubeThumbnail(mySub.link_url)} alt="youtube preview" className="w-100 object-fit-cover" /></div>
                                          ) : null}
                                          <a href={mySub.link_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-dark rounded-pill px-3 shadow-sm fw-bold">🔗 เปิดลิงก์ที่ส่ง</a>
                                        </div>
                                      )}
                                      {mySub.file_url && (
                                        <div className="mb-2"><a href={mySub.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-dark rounded-pill px-3 shadow-sm fw-bold">📂 ดูไฟล์ที่แนบ</a></div>
                                      )}
                                      
                                      <div className="mt-3">
                                        <span className="badge bg-theme-dark rounded-pill px-3 py-2 fs-6">{mySub.score !== null ? `ได้คะแนน: ${mySub.score}` : 'สถานะ: รอตรวจ'}</span>
                                      </div>

                                      {mySub.teacher_feedback && (
                                        <div className="bg-theme-red bg-opacity-10 p-3 rounded-4 border mt-3 small text-theme-red shadow-sm">
                                          <span className="fw-bold d-block mb-1">💬 ความคิดเห็นจากครู:</span>
                                          <span className="fw-bold">{mySub.teacher_feedback}</span>
                                        </div>
                                      )}

                                      {mySub.score === null && (
                                        <button onClick={() => handleUnsubmit(mySub.id)} className="btn btn-sm btn-outline-danger rounded-pill fw-bold w-100 mt-3 py-2">
                                          ❌ ยกเลิกการส่ง
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <form onSubmit={(e) => handleWorkSubmit(e, a.id)} className="bg-theme-gray p-3 rounded-4 border border-light">
                                      <div className="d-flex flex-column gap-2 mb-3">
                                        <textarea className="theme-input form-control" placeholder="💬 พิมพ์คำตอบ..." value={isCurrentForm ? submitForm.text : ''} onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, text: e.target.value })} rows="2" />
                                        <input type="url" className="theme-input form-control" placeholder="🔗 แนบลิงก์เว็บ / YouTube" value={isCurrentForm ? submitForm.link : ''} onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, link: e.target.value })} />
                                        <div className="bg-white p-2 rounded-4 border border-light mt-1">
                                          <label className="small fw-bold text-muted mb-1 px-2">📂 แนบไฟล์ / รูปภาพ</label>
                                          <input type="file" className="form-control border-0 shadow-none bg-transparent fw-bold" onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, file: e.target.files[0] })} />
                                        </div>
                                      </div>
                                      <button type="submit" className="btn btn-theme-red w-100 rounded-pill fw-bold py-3 shadow-sm" disabled={uploadingWork}>
                                        {uploadingWork && isCurrentForm ? '⏳ กำลังส่งงาน...' : 'ส่งคำตอบ'}
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {taskSubTab === 'quizzes' && (
                    <div className="row g-4">
                      {quizzes.length === 0 ? <p className="text-center text-muted py-5 col-12 fw-bold">ยังไม่มีแบบทดสอบในวิชาของคุณ</p> : quizzes.map(q => { 
                        const isDone = quizSubmissions.find(qs => qs.quiz_id === q.id); 
                        const moduleName = modules.find(mod => mod.id === q.module_id)?.title;
                        return (
                          <div key={q.id} className="col-12 col-md-6 col-xl-4">
                            <div className="theme-card p-4 h-100 d-flex flex-column border border-light">
                              <span className="badge bg-theme-dark text-white rounded-pill px-3 py-1 align-self-start mb-3 fs-6">แบบทดสอบ</span>
                              <h5 className="fw-bold mb-2 text-theme-dark">{q.title}</h5>
                              <p className="text-muted small mb-3 fw-bold">{q.courses.course_name} {moduleName && <span className="text-theme-red">[{moduleName}]</span>}</p>
                              
                              {q.time_limit > 0 && <p className="text-theme-red fw-bold small mb-4">⏳ เวลาทำข้อสอบ: {q.time_limit} นาที</p>}

                              <div className="mt-auto">
                                {isDone ? (
                                  <div className="bg-light text-theme-dark fw-bold text-center p-3 rounded-pill w-100 border">
                                    ✅ ทำแล้ว ({isDone.score}/{isDone.total_score} คะแนน)
                                    {isDone.is_cheated && <span className="d-block mt-1 text-theme-red small">🚨 โดนตัดสิทธิ์ (ทุจริต)</span>}
                                  </div>
                                ) : (
                                  <button onClick={() => handleStartQuiz(q)} className="btn btn-theme-red rounded-pill fw-bold py-3 shadow-sm w-100">✍️ เริ่มทำแบบทดสอบ</button>
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

              {/* TAB 4: โปรไฟล์ */}
              {activeTab === 'profile' && (
                <div className="fade-in row justify-content-center">
                  <div className="col-12 col-md-8 col-xl-6">
                    <h4 className="fw-bold text-theme-dark mb-4">บัญชีผู้ใช้</h4>
                    
                    {/* User Card */}
                    <div className="hero-card mb-4 text-center">
                      <div className="bg-white rounded-circle border border-4 border-white shadow-lg mx-auto mb-3 d-flex justify-content-center align-items-center overflow-hidden" style={{ width: "100px", height: "100px", fontSize: "40px", zIndex: 2, position: 'relative' }}>
                         {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👨‍🎓'}
                      </div>
                      <div style={{zIndex: 2, position: 'relative'}}>
                        <h4 className="fw-bold mb-1">{profileForm.full_name || 'นักศึกษา'}</h4>
                        <p className="text-white-50 mb-0">{session?.user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="theme-card mb-4">
                      <h5 className="fw-bold mb-4 text-theme-dark text-center">แก้ไขข้อมูลส่วนตัว</h5>
                      <form onSubmit={handleUpdateProfile}>
                        <div className="mb-3"><label className="form-label text-muted small fw-bold px-2">ชื่อ - นามสกุล</label><input type="text" className="theme-input form-control" value={profileForm.full_name} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} required /></div>
                        <div className="mb-3"><label className="form-label text-muted small fw-bold px-2">ชื่อเล่น</label><input type="text" className="theme-input form-control" value={profileForm.nickname} onChange={e => setProfileForm({...profileForm, nickname: e.target.value})} /></div>
                        <div className="mb-3"><label className="form-label text-muted small fw-bold px-2">เบอร์โทรศัพท์</label><input type="text" className="theme-input form-control" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} /></div>
                        <div className="mb-4">
                          <label className="form-label text-muted small fw-bold px-2">อัปโหลดรูปโปรไฟล์</label>
                          <input type="file" accept="image/*" className="theme-input form-control bg-white" onChange={handleUploadAvatar} disabled={uploadingAvatar} />
                          {uploadingAvatar && <small className="text-theme-red mt-2 ms-2 d-block fw-bold">⏳ กำลังอัปโหลด...</small>}
                        </div>

                        <hr className="my-4 border-light" />
                        
                        <h6 className="fw-bold mb-3 text-theme-dark d-flex align-items-center gap-2"><span>✈️</span> แจ้งเตือนผ่าน Telegram</h6>
                        <div className="bg-theme-dark text-white p-4 rounded-4 mb-4 shadow-sm">
                           <p className="small mb-3 text-white-50">1. กดปุ่มด้านล่างเพื่อเปิด Telegram และรับรหัส Chat ID จาก @getmyid_bot</p>
                           <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-theme-red rounded-pill px-4 py-2 shadow-sm mb-4 fw-bold">👉 เปิดเพื่อรับรหัส Chat ID</a>
                           <p className="small mb-2 text-white-50">2. นำตัวเลข Chat ID มาวางที่นี่</p>
                           <input type="text" className="form-control bg-white border-0 rounded-pill px-4 py-3 fw-bold" placeholder="ตัวอย่าง 123456789" value={profileForm.telegram_chat_id || ''} onChange={e => setProfileForm({...profileForm, telegram_chat_id: e.target.value})} />
                           {profileForm.telegram_chat_id && <small className="text-success fw-bold d-block mt-3">✅ ข้อมูล Chat ID พร้อมใช้งานแล้ว</small>}
                        </div>
                        
                        <hr className="my-4 border-light" />
                        <h6 className="fw-bold mb-3 text-theme-dark">ข้อมูลระบบ (แก้ไขไม่ได้)</h6>
                        
                        <div className="mb-3"><label className="form-label text-muted small fw-bold px-2">รหัสประจำตัว</label><input type="text" className="theme-input form-control text-muted" value={profileForm.student_code} disabled /></div>
                        <div className="row mb-4 g-3">
                          <div className="col-6"><label className="form-label text-muted small fw-bold px-2">ระดับชั้น</label><input type="text" className="theme-input form-control text-muted" value={profileForm.grade_level} disabled /></div>
                          <div className="col-6"><label className="form-label text-muted small fw-bold px-2">แผนกวิชา</label><input type="text" className="theme-input form-control text-truncate text-muted" value={profileForm.department} disabled title={profileForm.department} /></div>
                        </div>

                        <button type="submit" className="btn btn-theme-dark w-100 rounded-pill fw-bold py-3 shadow-sm">💾 บันทึกข้อมูล</button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* 📱 Mobile Bottom Nav */}
      {!takingQuiz && (
        <div className="bottom-nav d-md-none">
          <button onClick={() => setActiveTab('home')} className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}><span className="icon">🏠</span>หน้าหลัก</button>
          <button onClick={() => setActiveTab('classroom')} className={`bottom-nav-item ${activeTab === 'classroom' ? 'active' : ''}`}><span className="icon">📚</span>ห้องเรียน</button>
          <button onClick={() => setActiveTab('tasks')} className={`bottom-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}><span className="icon">📝</span>งาน/สอบ</button>
          <button onClick={() => setActiveTab('profile')} className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}><span className="icon">👤</span>ฉัน</button>
        </div>
      )}
    </div>
  )
}