import { useState, useEffect } from 'react'
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
  
  // 🌟 เพิ่ม telegram_chat_id ใน profileForm
  const [profileForm, setProfileForm] = useState({ 
    full_name: '', nickname: '', phone: '', avatar_url: '', 
    student_code: '', department: '', grade_level: '', telegram_chat_id: ''
  })
  const [takingQuiz, setTakingQuiz] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})

  const getYoutubeThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  // 🌟 ฟังก์ชันสำหรับยิงแจ้งเตือนเข้า Telegram
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

  const fetchData = async () => {
    const { data: pData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    
    if (pData) {
      setProfileForm({
        full_name: pData.full_name || '',
        nickname: pData.nickname || '',
        phone: pData.phone || '',
        avatar_url: pData.avatar_url || '',
        student_code: pData.student_code || '',
        department: pData.department || '',
        grade_level: pData.grade_level || '',
        telegram_chat_id: pData.telegram_chat_id || '' // 🌟 ดึงข้อมูล Telegram ID
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
        // ถ้านักเรียนไม่มีข้อมูลแผนก ก็ไม่ให้เห็น
        if (!studentDept) return false;
        
        // เช็คแค่ว่า ในชื่อกลุ่มเรียนที่ครูสร้าง มีคำว่า "ช่างซ่อมบำรุง" (หรือแผนกของเด็ก) อยู่ก็พอ
        const matchDept = section.includes(studentDept);
        
        // ส่งค่าผ่านเลย ไม่ต้องเช็คระดับชั้น (matchLevel) ให้จุกจิกอีกต่อไป
        return matchDept; 
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
      full_name: profileForm.full_name,
      nickname: profileForm.nickname,
      phone: profileForm.phone,
      avatar_url: profileForm.avatar_url,
      telegram_chat_id: profileForm.telegram_chat_id // 🌟 บันทึก Telegram ID
    }).eq('id', session.user.id); 
    fetchData(); 
    Swal.fire('สำเร็จ!', 'บันทึกข้อมูลส่วนตัวเรียบร้อย!', 'success');
  }

  const handleEnroll = async (courseId) => {
    const { error } = await supabase.from('enrollments').insert([{ student_id: session.user.id, course_id: courseId }])
    if (error) { 
      if (error.code === '23505' || error.message.includes('duplicate')) Swal.fire('แจ้งเตือน', 'คุณได้ลงทะเบียนวิชานี้ไปแล้ว', 'info'); 
      else Swal.fire('ข้อผิดพลาด', `เกิดข้อผิดพลาด: ${error.message}`, 'error'); 
    } else { 
      fetchData(); Swal.fire('สำเร็จ!', 'ลงทะเบียนวิชานี้เรียบร้อยแล้ว!', 'success'); 
    }
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

      await supabase.from('submissions').insert([{ 
        assignment_id: assignId, student_id: session.user.id, submitted_text: submitForm.text || '', link_url: submitForm.link || '', file_url: finalFileUrl
      }]); 
      
      // 🌟 ส่งแจ้งเตือนหาคุณครู
      const targetAssign = assignments.find(a => a.id === assignId);
      if (targetAssign) {
        const { data: courseData } = await supabase.from('courses').select('teacher_id, profiles(telegram_chat_id)').eq('id', targetAssign.course_id).single();
        if (courseData && courseData.profiles?.telegram_chat_id) {
           const msg = `📬 มีนักเรียนส่งงานใหม่!\nวิชา: ${targetAssign.courses.course_name}\nงาน: ${targetAssign.title}\nจาก: ${profileForm.full_name} (${profileForm.student_code})`;
           sendTelegramNotify(courseData.profiles.telegram_chat_id, msg);
        }
      }

      setSubmitForm({ assign_id: '', text: '', link: '', file: null }); 
      fetchData(); 
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ส่งงานสำเร็จ!', showConfirmButton: false, timer: 2000 });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
      setUploadingWork(false);
    }
  }

  const handleUnsubmit = async (subId) => {
    const result = await Swal.fire({
      title: 'ยกเลิกการส่งงาน?', text: 'คุณต้องการยกเลิกการส่งงานนี้เพื่อส่งใหม่ใช่หรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6c757d', confirmButtonText: 'ใช่, ยกเลิกการส่ง', cancelButtonText: 'ปิด'
    });
    if (!result.isConfirmed) return;
    try {
      await supabase.from('submissions').delete().eq('id', subId);
      fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ยกเลิกการส่งงานแล้ว', showConfirmButton: false, timer: 2000 });
    } catch (error) { Swal.fire('เกิดข้อผิดพลาด', error.message, 'error'); }
  };

  const handleStartQuiz = (quiz) => { setTakingQuiz(quiz); setQuizAnswers({}); }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < takingQuiz.questions.length) { 
      const result = await Swal.fire({ title: 'ทำข้อสอบยังไม่ครบ!', text: 'ต้องการส่งคำตอบเลยหรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ส่งเลย', cancelButtonText: 'กลับไปทำต่อ' });
      if (!result.isConfirmed) return;
    }
    let score = 0; takingQuiz.questions.forEach((q, index) => { if (quizAnswers[index] === q.correctOption) score++; });
    
    await supabase.from('quiz_submissions').insert([{ quiz_id: takingQuiz.id, student_id: session.user.id, score: score, total_score: takingQuiz.questions.length }]);
    
    Swal.fire('ส่งข้อสอบสำเร็จ!', `คุณทำได้ ${score}/${takingQuiz.questions.length} คะแนน`, 'success'); 
    setTakingQuiz(null); setQuizAnswers({}); fetchData(); 
  }

  const navigateToService = (tab, subTab) => { setActiveTab(tab); if (subTab) { tab === 'classroom' ? setClassSubTab(subTab) : setTaskSubTab(subTab); } }

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
    <div className="bg-light min-vh-100 font-app">
      <div className="mx-auto" style={{ maxWidth: '480px', minHeight: '100vh', backgroundColor: '#fafafa', position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.05)' }}>
        
        <div className="pt-4 px-4" style={{ paddingBottom: '120px' }}>
          
          {takingQuiz ? (
             <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-5 slide-up">
                <div className="bg-primary text-white p-4"><h5 className="mb-0 fw-bold">📝 {takingQuiz.title}</h5></div>
                <div className="card-body p-4">
                  {takingQuiz.questions.map((q, qIndex) => (
                    <div key={qIndex} className="mb-5">
                      <h6 className="fw-bold mb-3 fs-5">{qIndex + 1}. {q.question}</h6>
                      <div className="d-flex flex-column gap-2">
                        {q.options.map((opt, optIndex) => (
                          <label key={optIndex} className={`d-flex align-items-center gap-3 border p-3 rounded-4 ${quizAnswers[qIndex] === optIndex ? 'border-primary bg-primary bg-opacity-10 fw-bold text-primary' : 'border-light bg-white'}`} style={{cursor: 'pointer', transition: '0.2s'}}>
                            <input type="radio" name={`q-${qIndex}`} className="form-check-input mt-0" style={{width: '20px', height:'20px'}} checked={quizAnswers[qIndex] === optIndex} onChange={() => setQuizAnswers({...quizAnswers, [qIndex]: optIndex})} />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="d-flex gap-3 pt-4 border-top">
                    <button onClick={() => setTakingQuiz(null)} className="btn btn-light rounded-pill fw-bold px-4 py-3 text-secondary w-50">ยกเลิก</button>
                    <button onClick={handleQuizSubmit} className="btn btn-primary rounded-pill fw-bold py-3 shadow-sm w-50">ส่งคำตอบ</button>
                  </div>
                </div>
             </div>
          ) : (
            <>
              {/* TAB 1: หน้าหลัก */}
              {activeTab === 'home' && (
                <div className="fade-in">
                  <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
                    <div className="d-flex gap-3 align-items-center">
                      <div className="bg-white rounded-circle shadow-sm overflow-hidden d-flex justify-content-center align-items-center" style={{width: '45px', height: '45px', fontSize: '20px'}}>
                         {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👨‍🎓'}
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0">สวัสดี, {profileForm.full_name || 'นักศึกษา'} 👋</h6>
                        <small className="text-muted">วันนี้เรียนวิชาอะไรดี?</small>
                      </div>
                    </div>
                    <button onClick={handleLogout} className="btn btn-white border-0 bg-white shadow-sm rounded-circle d-flex justify-content-center align-items-center" style={{width: '40px', height: '40px'}}>🚪</button>
                  </div>

                  {announcements.length > 0 && (
                    <div className="mb-4">
                      {announcements.map(ann => (
                        <div key={ann.id} className="bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-4 p-3 mb-2 d-flex gap-3 slide-down">
                          <div className="fs-3">📢</div>
                          <div><h6 className="fw-bold mb-1 text-dark">{ann.title}</h6><p className="small text-dark text-opacity-75 mb-0 lh-sm">{ann.content}</p></div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="card border-0 rounded-4 shadow-sm mb-4" style={{ backgroundColor: '#0d6efd', backgroundImage: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' }}>
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between text-center text-white">
                        <div><div className="mb-2 fs-4">📚</div><h5 className="fw-bold mb-0">{enrolledCourses.length}</h5><small className="text-white-50" style={{fontSize: '11px'}}>วิชาที่เรียน</small></div>
                        <div className="border-end border-white border-opacity-25"></div>
                        <div><div className="mb-2 fs-4">⏳</div><h5 className="fw-bold mb-0">{missingCount}</h5><small className="text-white-50" style={{fontSize: '11px'}}>งานค้างส่ง</small></div>
                        <div className="border-end border-white border-opacity-25"></div>
                        <div><div className="mb-2 fs-4">📈</div><h5 className="fw-bold mb-0">{progressPercentage}%</h5><small className="text-white-50" style={{fontSize: '11px'}}>ก้าวหน้า</small></div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0 text-dark">บริการระบบเรียน</h6>
                    <button onClick={() => navigateToService('classroom', 'enroll')} className="btn btn-link text-primary text-decoration-none p-0 small fw-bold">ดูวิชาทั้งหมด</button>
                  </div>
                  
                  <div className="row g-3 text-center mb-4">
                    <div className="col-3"><button onClick={() => navigateToService('classroom', 'enroll')} className="btn btn-white border-0 bg-white shadow-sm p-3 rounded-4 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-1">➕</span></button><small className="text-muted d-block mt-2" style={{fontSize: '11px', fontWeight: '500'}}>ลงทะเบียน</small></div>
                    <div className="col-3"><button onClick={() => navigateToService('classroom', 'materials')} className="btn btn-white border-0 bg-white shadow-sm p-3 rounded-4 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-1">📎</span></button><small className="text-muted d-block mt-2" style={{fontSize: '11px', fontWeight: '500'}}>เอกสาร</small></div>
                    <div className="col-3"><button onClick={() => navigateToService('tasks', 'assignments')} className="btn btn-white border-0 bg-white shadow-sm p-3 rounded-4 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-1">📝</span></button><small className="text-muted d-block mt-2" style={{fontSize: '11px', fontWeight: '500'}}>ส่งงาน</small></div>
                    <div className="col-3"><button onClick={() => navigateToService('tasks', 'quizzes')} className="btn btn-white border-0 bg-white shadow-sm p-3 rounded-4 w-100 d-flex flex-column align-items-center app-icon-btn"><span className="fs-3 mb-1">✍️</span></button><small className="text-muted d-block mt-2" style={{fontSize: '11px', fontWeight: '500'}}>แบบทดสอบ</small></div>
                  </div>

                  {isAtRisk ? (
                     <div className="card bg-danger bg-opacity-10 border-0 rounded-4 mb-4">
                       <div className="card-body p-3 d-flex align-items-center">
                         <div className="flex-grow-1">
                           <h6 className="text-danger fw-bold mb-1">แจ้งเตือนสถานะการเรียน!</h6>
                           <p className="small text-danger text-opacity-75 mb-2">คุณมีงานค้างหรือคะแนนต่ำกว่าเกณฑ์</p>
                           <button onClick={() => navigateToService('tasks', 'assignments')} className="btn btn-danger btn-sm rounded-pill fw-bold px-3 shadow-sm">เคลียร์งานด่วน</button>
                         </div><div className="fs-1 px-2">⚠️</div>
                       </div>
                     </div>
                  ) : (
                    <div className="card bg-success bg-opacity-10 border-0 rounded-4 mb-4">
                      <div className="card-body p-3 d-flex align-items-center">
                        <div className="flex-grow-1">
                          <h6 className="text-success fw-bold mb-1">เยี่ยมมาก! ลุยต่อเลย</h6>
                          <p className="small text-success text-opacity-75 mb-2">เข้าเรียนและติดตามงานอย่างสม่ำเสมอ</p>
                          <button onClick={() => navigateToService('classroom', 'materials')} className="btn btn-success btn-sm rounded-pill fw-bold px-3 shadow-sm">ดูเอกสารเรียน</button>
                        </div><div className="fs-1 px-2">🚀</div>
                      </div>
                    </div>
                  )}

                  <h6 className="fw-bold mb-3 text-dark">งานที่ต้องทำล่าสุด</h6>
                  <div className="d-flex flex-column gap-2">
                    {assignments.filter(a => !submissions.find(s => s.assignment_id === a.id)).slice(0, 2).map(a => (
                      <div key={a.id} className="bg-white rounded-4 p-3 shadow-sm d-flex align-items-center gap-3">
                        <div className="bg-warning bg-opacity-10 rounded-3 p-2 fs-5">📝</div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-0 text-truncate text-dark">{a.title}</h6>
                          <small className="text-muted">{a.courses.course_name}</small>
                        </div>
                        <button onClick={() => navigateToService('tasks', 'assignments')} className="btn btn-light rounded-circle text-primary border-0 p-2">→</button>
                      </div>
                    ))}
                    {assignments.filter(a => !submissions.find(s => s.assignment_id === a.id)).length === 0 && (
                      <div className="bg-white rounded-4 p-3 shadow-sm text-center"><small className="text-muted">✅ ไม่มีงานค้างในขณะนี้</small></div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ห้องเรียน */}
              {activeTab === 'classroom' && (
                <div className="fade-in">
                  <h4 className="fw-bold text-dark mb-4">ห้องเรียน</h4>
                  <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4">
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'enroll' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('enroll')}>ลงทะเบียน</button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'materials' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('materials')}>เอกสาร</button>
                  </div>
                  
                  {classSubTab === 'materials' && (
                    <div className="d-flex flex-column gap-3">
                      {materials.length === 0 ? <p className="text-center text-muted py-5">ยังไม่มีเอกสารในวิชาของคุณ</p> : materials.map(m => {
                        const ytThumb = getYoutubeThumbnail(m.file_url);
                        const moduleName = modules.find(mod => mod.id === m.module_id)?.title; 
                        return (
                          <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="bg-white shadow-sm rounded-4 p-3 d-flex flex-row align-items-center gap-3 text-decoration-none hover-card">
                            {ytThumb ? (
                              <div className="rounded-3 overflow-hidden shadow-sm" style={{ width: '80px', height: '55px', flexShrink: 0 }}><img src={ytThumb} alt="youtube thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                            ) : (
                              <div className="bg-primary bg-opacity-10 text-primary rounded-3 d-flex align-items-center justify-content-center p-3 fs-4" style={{flexShrink: 0}}>📎</div>
                            )}
                            <div className="flex-grow-1">
                              <h6 className="fw-bold mb-1 text-truncate text-dark">{m.title}</h6>
                              <p className="text-muted small mb-0 text-truncate">{m.courses.course_name} {moduleName && <span className="text-primary fw-bold">[{moduleName}]</span>}</p>
                            </div>
                            <div className="btn btn-light text-primary rounded-circle p-2 shadow-sm">⬇️</div>
                          </a>
                        )
                      })}
                    </div>
                  )}

                  {classSubTab === 'enroll' && (
                    <div className="d-flex flex-column gap-3">
                      {allCourses.length === 0 ? <p className="text-center text-muted py-5">ยังไม่มีรายวิชาเปิดสำหรับกลุ่มเรียนของคุณ</p> : allCourses.map(c => { 
                        const isEnrolled = enrolledCourses.includes(c.id); 
                        return (
                          <div key={c.id} className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                            <div className="card-body p-4">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2">{c.course_code}</span><span className="badge bg-light text-dark border rounded-pill">กลุ่ม: {c.section}</span>
                              </div>
                              <h5 className="fw-bold mb-1 text-dark">{c.course_name}</h5>
                              <p className="mb-2 text-dark fw-bold small">👨‍🏫 ผู้สอน: <span className="text-primary">{c.profiles?.full_name || 'ไม่ระบุชื่อครู'}</span></p>
                              <p className="text-muted small mb-3">ภาคเรียน: {c.semester||'-'} | หน่วยกิต: {c.credits||'-'}</p>
                              <button onClick={() => handleEnroll(c.id)} disabled={isEnrolled} className={`btn w-100 rounded-pill fw-bold py-3 shadow-sm ${isEnrolled ? 'bg-light text-success border-0' : 'btn-primary'}`}>
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
                  <h4 className="fw-bold text-dark mb-4">งานและสอบ</h4>
                  <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4">
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'assignments' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('assignments')}>ส่งงาน</button>
                    <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'quizzes' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('quizzes')}>แบบทดสอบ</button>
                  </div>
                  
                  {taskSubTab === 'assignments' && (
                    <div className="d-flex flex-column gap-3">
                      {assignments.length === 0 ? <p className="text-center text-muted py-5">เยี่ยมมาก! ไม่มีงานค้าง</p> : assignments.map(a => { 
                        const mySub = submissions.find(s => s.assignment_id === a.id); 
                        const isCurrentForm = submitForm.assign_id === a.id;
                        const moduleName = modules.find(mod => mod.id === a.module_id)?.title;

                        return (
                          <div key={a.id} className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                            <div className={`p-2 ${mySub ? 'bg-success bg-opacity-10' : 'bg-warning bg-opacity-25'}`}></div>
                            <div className="card-body p-4">
                              <p className="text-muted small mb-1">{a.courses.course_name} {moduleName && <span className="text-primary fw-bold">[{moduleName}]</span>}</p>
                              <h5 className="fw-bold mb-2 text-dark">{a.title}</h5>
                              <p className="text-secondary small mb-3 bg-light p-3 rounded-4">{a.description}</p>
                              
                              {mySub ? (
                                <div className="bg-success bg-opacity-10 p-3 rounded-4 position-relative">
                                  <h6 className="fw-bold text-success mb-2">✅ ส่งงานเรียบร้อยแล้ว</h6>
                                  {mySub.submitted_text && <p className="small mb-2 text-dark bg-white p-2 rounded-3 border">"{mySub.submitted_text}"</p>}
                                  {mySub.link_url && (
                                    <div className="mb-2">
                                      {getYoutubeThumbnail(mySub.link_url) ? (
                                        <div className="mb-2 overflow-hidden rounded-3 shadow-sm" style={{maxWidth: '100%'}}><img src={getYoutubeThumbnail(mySub.link_url)} alt="youtube preview" className="w-100 object-fit-cover" /></div>
                                      ) : null}
                                      <a href={mySub.link_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-success rounded-pill px-3 shadow-sm bg-white">🔗 เปิดลิงก์ที่ส่ง</a>
                                    </div>
                                  )}
                                  {mySub.file_url && (
                                    <div className="mb-2"><a href={mySub.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-success rounded-pill px-3 shadow-sm bg-white">📂 ดูไฟล์ที่แนบ</a></div>
                                  )}
                                  
                                  <div className="mt-3">
                                    <span className="badge bg-success rounded-pill px-3 py-2 fs-6">{mySub.score !== null ? `ได้คะแนน: ${mySub.score}` : 'สถานะ: รอตรวจ'}</span>
                                  </div>

                                  {mySub.teacher_feedback && (
                                    <div className="bg-white p-3 rounded-4 border mt-3 small text-primary shadow-sm slide-down">
                                      <span className="fw-bold d-block mb-1">💬 ความคิดเห็นจากครู:</span>
                                      <span className="text-dark">{mySub.teacher_feedback}</span>
                                    </div>
                                  )}

                                  {mySub.score === null && (
                                    <button onClick={() => handleUnsubmit(mySub.id)} className="btn btn-sm btn-danger rounded-pill fw-bold w-100 mt-3 shadow-sm py-2">
                                      ❌ ยกเลิกและส่งงานใหม่
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <form onSubmit={(e) => handleWorkSubmit(e, a.id)}>
                                  <div className="d-flex flex-column gap-2 mb-3">
                                    <textarea className="form-control bg-light border-0 rounded-4 p-3" placeholder="💬 พิมพ์ข้อความคำตอบ (ถ้ามี)..." value={isCurrentForm ? submitForm.text : ''} onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, text: e.target.value })} rows="3" />
                                    <input type="url" className="form-control bg-light border-0 rounded-4 p-3" placeholder="🔗 วางลิงก์เว็บ หรือ YouTube (ถ้ามี)..." value={isCurrentForm ? submitForm.link : ''} onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, link: e.target.value })} />
                                    <div className="bg-light p-3 rounded-4 border-0">
                                       <label className="small fw-bold text-muted mb-2 d-block">📂 แนบไฟล์ หรือ รูปภาพ (ถ้ามี)</label>
                                       <input type="file" className="form-control bg-white rounded-3 border-0 shadow-sm p-2" onChange={(e) => setSubmitForm({ ...submitForm, assign_id: a.id, file: e.target.files[0] })} />
                                    </div>
                                  </div>
                                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-3 shadow-sm" disabled={uploadingWork}>
                                    {uploadingWork && isCurrentForm ? '⏳ กำลังส่งงาน...' : 'ส่งคำตอบ'}
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {taskSubTab === 'quizzes' && (
                    <div className="d-flex flex-column gap-3">
                      {quizzes.length === 0 ? <p className="text-center text-muted py-5">ยังไม่มีแบบทดสอบในวิชาของคุณ</p> : quizzes.map(q => { 
                        const isDone = quizSubmissions.find(qs => qs.quiz_id === q.id); 
                        const moduleName = modules.find(mod => mod.id === q.module_id)?.title;
                        return (
                          <div key={q.id} className="card border-0 shadow-sm rounded-4 bg-white">
                            <div className="card-body p-4 d-flex flex-column">
                              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 align-self-start mb-2">แบบทดสอบ</span>
                              <h5 className="fw-bold mb-1 text-dark">{q.title}</h5>
                              <p className="text-muted small mb-3">{q.courses.course_name} {moduleName && <span className="text-primary fw-bold">[{moduleName}]</span>}</p>
                              {isDone ? (
                                <div className="bg-success bg-opacity-10 text-success fw-bold text-center p-3 rounded-pill w-100">✅ ทำแล้ว ได้ {isDone.score}/{isDone.total_score} คะแนน</div>
                              ) : (
                                <button onClick={() => handleStartQuiz(q)} className="btn btn-primary rounded-pill fw-bold py-3 shadow-sm w-100">✍️ เริ่มทำแบบทดสอบ</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 🌟 TAB 4: โปรไฟล์ (เพิ่มส่วนเชื่อมต่อ Telegram) */}
              {activeTab === 'profile' && (
                <div className="fade-in">
                  <h4 className="fw-bold text-dark mb-4">บัญชีผู้ใช้</h4>
                  <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
                    <div className="bg-primary p-5 text-center position-relative" style={{ backgroundImage: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' }}>
                      <div className="bg-white rounded-circle position-absolute start-50 translate-middle border border-4 border-white shadow-sm d-flex justify-content-center align-items-center overflow-hidden" style={{width:'80px', height:'80px', top: '100%', fontSize:'30px'}}>
                         {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👨‍🎓'}
                      </div>
                    </div>
                    <div className="card-body pt-5 px-4 pb-4 text-center mt-3">
                      <h5 className="fw-bold mb-1 text-dark">{profileForm.full_name || 'นักศึกษา'}</h5>
                      <p className="text-muted mb-0">{session?.user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="card border-0 shadow-sm rounded-4 bg-white mb-4">
                    <div className="card-body p-4">
                      <h6 className="fw-bold mb-3 text-dark">ข้อมูลที่แก้ไขได้</h6>
                      <form onSubmit={handleUpdateProfile}>
                        <div className="mb-3">
                          <label className="form-label text-muted small fw-bold ms-2">ชื่อ - นามสกุล</label>
                          <input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3" value={profileForm.full_name} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} required />
                        </div>
                        <div className="mb-3">
                          <label className="form-label text-muted small fw-bold ms-2">ชื่อเล่น</label>
                          <input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3" value={profileForm.nickname} onChange={e => setProfileForm({...profileForm, nickname: e.target.value})} placeholder="ระบุชื่อเล่น" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label text-muted small fw-bold ms-2">เบอร์โทรศัพท์</label>
                          <input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} placeholder="08X-XXX-XXXX" />
                        </div>
                        <div className="mb-4">
                          <label className="form-label text-muted small fw-bold ms-2">รูปโปรไฟล์ (อัปโหลดจากเครื่อง)</label>
                          <input type="file" accept="image/*" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-2" onChange={handleUploadAvatar} disabled={uploadingAvatar} />
                          {uploadingAvatar && <small className="text-primary mt-2 ms-2 d-block fw-bold">⏳ กำลังอัปโหลด...</small>}
                        </div>
                        
                        <hr className="my-4 border-light" />
                        
                        {/* 🌟 ส่วนเชื่อมต่อ Telegram */}
                        <h6 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2"><span>✈️</span> การแจ้งเตือนผ่าน Telegram</h6>
                        <div className="bg-primary bg-opacity-10 p-3 rounded-4 mb-4 border border-primary border-opacity-25">
                           <p className="small text-dark mb-2">1. กดปุ่มด้านล่างเพื่อเปิด Telegram และรับรหัส Chat ID ของคุณจากบอท @getmyid_bot</p>
                           <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary rounded-pill px-3 shadow-sm mb-3">👉 เปิด Telegram รับรหัส</a>
                           <p className="small text-dark mb-2">2. นำตัวเลข Chat ID (เช่น 123456789) มากรอกในช่องด้านล่าง</p>
                           <input type="text" className="form-control custom-input bg-white border-0 rounded-pill px-4 py-3" placeholder="ระบุ Telegram Chat ID" value={profileForm.telegram_chat_id || ''} onChange={e => setProfileForm({...profileForm, telegram_chat_id: e.target.value})} />
                           {profileForm.telegram_chat_id && <small className="text-success fw-bold d-block mt-2">✅ ข้อมูล Chat ID พร้อมใช้งานแล้ว</small>}
                        </div>

                        <hr className="my-4 border-light" />

                        <h6 className="fw-bold mb-3 text-dark">ข้อมูลของระบบ (แก้ไขไม่ได้)</h6>
                        
                        <div className="mb-3">
                          <label className="form-label text-muted small fw-bold ms-2">รหัสประจำตัว</label>
                          <input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-3 text-muted" value={profileForm.student_code} disabled />
                        </div>
                        <div className="row mb-4 g-2">
                          <div className="col-6">
                            <label className="form-label text-muted small fw-bold ms-2">ระดับชั้น</label>
                            <input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-3 text-muted" value={profileForm.grade_level} disabled />
                          </div>
                          <div className="col-6">
                            <label className="form-label text-muted small fw-bold ms-2">แผนกวิชา</label>
                            <input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-3 text-muted text-truncate" value={profileForm.department} disabled title={profileForm.department} />
                          </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-3 shadow-sm custom-btn">💾 บันทึกข้อมูล</button>
                      </form>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="btn btn-light text-danger w-100 rounded-pill fw-bold py-3 shadow-sm bg-white mb-4 custom-btn">ออกจากระบบ</button>
                </div>
              )}
            </>
          )}

          <div style={{ height: '100px', width: '100%' }}></div>

        </div>

        {!takingQuiz && (
          <div className="position-fixed bottom-0 bg-white border-top shadow-lg" style={{ width: '100%', maxWidth: '480px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 1040 }}>
            <div className="d-flex justify-content-around px-2 py-2">
              <button onClick={() => setActiveTab('home')} className={`btn border-0 d-flex flex-column align-items-center p-2 w-25 ${activeTab === 'home' ? 'text-primary' : 'text-muted'}`}>
                <span className="fs-4 mb-1 lh-1">🏠</span>
                <span className="fw-bold" style={{fontSize: '11px'}}>หน้าหลัก</span>
              </button>
              <button onClick={() => setActiveTab('classroom')} className={`btn border-0 d-flex flex-column align-items-center p-2 w-25 ${activeTab === 'classroom' ? 'text-primary' : 'text-muted'}`}>
                <span className="fs-4 mb-1 lh-1">📚</span>
                <span className="fw-bold" style={{fontSize: '11px'}}>ห้องเรียน</span>
              </button>
              <button onClick={() => setActiveTab('tasks')} className={`btn border-0 d-flex flex-column align-items-center p-2 w-25 ${activeTab === 'tasks' ? 'text-primary' : 'text-muted'}`}>
                <span className="fs-4 mb-1 lh-1">📝</span>
                <span className="fw-bold" style={{fontSize: '11px'}}>งาน/สอบ</span>
              </button>
              <button onClick={() => setActiveTab('profile')} className={`btn border-0 d-flex flex-column align-items-center p-2 w-25 ${activeTab === 'profile' ? 'text-primary' : 'text-muted'}`}>
                <span className="fs-4 mb-1 lh-1">👤</span>
                <span className="fw-bold" style={{fontSize: '11px'}}>ฉัน</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .font-app { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; } 
        .fade-in { animation: fadeIn 0.3s ease-in-out; } 
        .slide-up { animation: slideUp 0.4s ease-out; } 
        .slide-down { animation: slideDown 0.4s ease-out; } 
        .app-icon-btn { transition: transform 0.2s; } 
        .app-icon-btn:active { transform: scale(0.95); } 
        .custom-input { transition: all 0.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); } 
        .custom-input:focus { box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.15) !important; background-color: #fff !important; }
        .custom-btn { transition: all 0.3s; } 
        .custom-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(13, 110, 253, 0.3) !important; } 
        .form-control:focus { box-shadow: none; border: 1px solid #0d6efd !important; } 
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } 
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes slideDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}