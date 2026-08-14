import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function StudentDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  // เมนูหลัก: home, classroom, tasks, profile
  const [activeTab, setActiveTab] = useState('home') 
  // เมนูย่อย
  const [classSubTab, setClassSubTab] = useState('enroll') // enroll, materials
  const [taskSubTab, setTaskSubTab] = useState('assignments') // assignments, quizzes

  const [allCourses, setAllCourses] = useState([])
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [quizSubmissions, setQuizSubmissions] = useState([])
  const [submitForm, setSubmitForm] = useState({ assign_id: '', text: '' })
  
  const [profileName, setProfileName] = useState('')
  const [takingQuiz, setTakingQuiz] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})

  useEffect(() => {
    if (session?.role === 'student') fetchData()
  }, [session])

  const fetchData = async () => {
    const { data: pData } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single()
    if (pData?.full_name) setProfileName(pData.full_name)

    const { data: cData } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    if (cData) setAllCourses(cData)

    const { data: eData } = await supabase.from('enrollments').select('course_id').eq('student_id', session.user.id)
    const myCourseIds = eData ? eData.map(e => e.course_id) : []
    setEnrolledCourses(myCourseIds)

    if (myCourseIds.length > 0) {
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    await supabase.from('profiles').update({ full_name: profileName }).eq('id', session.user.id)
    alert('บันทึกข้อมูลเรียบร้อย!')
  }

  const handleEnroll = async (courseId) => {
    const { error } = await supabase.from('enrollments').insert([{ student_id: session.user.id, course_id: courseId }])
    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) alert('คุณได้ลงทะเบียนวิชานี้ไปแล้ว')
      else alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } else {
      fetchData(); alert('ลงทะเบียนสำเร็จ!')
    }
  }

  const handleWorkSubmit = async (e, assignId) => {
    e.preventDefault()
    await supabase.from('submissions').insert([{ assignment_id: assignId, student_id: session.user.id, submitted_text: submitForm.text }])
    setSubmitForm({ assign_id: '', text: '' }); fetchData(); alert('ส่งงานสำเร็จ!')
  }

  const handleStartQuiz = (quiz) => { setTakingQuiz(quiz); setQuizAnswers({}); }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < takingQuiz.questions.length) {
      if(!window.confirm('คุณยังทำข้อสอบไม่ครบทุกข้อ ต้องการส่งคำตอบเลยหรือไม่?')) return;
    }
    let score = 0;
    takingQuiz.questions.forEach((q, index) => { if (quizAnswers[index] === q.correctOption) score++; });
    await supabase.from('quiz_submissions').insert([{ quiz_id: takingQuiz.id, student_id: session.user.id, score: score, total_score: takingQuiz.questions.length }]);
    alert(`ส่งข้อสอบสำเร็จ! คุณทำได้ ${score}/${takingQuiz.questions.length} คะแนน`);
    setTakingQuiz(null); setQuizAnswers({}); fetchData(); 
  }

  const totalAssignments = assignments.length;
  const completedAssignments = submissions.length;
  const missingCount = totalAssignments - completedAssignments;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  
  let totalScore = 0; let gradedCount = 0;
  submissions.forEach(s => { if(s.score !== null){ totalScore+=s.score; gradedCount++; } });
  const avgScore = gradedCount > 0 ? (totalScore / (gradedCount * 10)) * 100 : 100; 
  const isAtRisk = missingCount >= 2 || avgScore < 50;

  if (!session || session.role !== 'student') return <Navigate to="/" />

  return (
    <div className="bg-light min-vh-100 pb-5" style={{ paddingBottom: '80px' }}>
      
      {/* Top Header */}
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold text-primary m-0">LMS Portal</h4>
        <button onClick={handleLogout} className="btn btn-light text-danger rounded-pill fw-bold px-3 py-2 border-0">
          ออกจากระบบ
        </button>
      </div>

      <div className="container">
        
        {/* Risk Alert (Modern Banner) */}
        {isAtRisk && !takingQuiz && (
          <div className="alert alert-danger border-0 shadow-sm rounded-4 d-flex align-items-center gap-3 p-3 mb-4">
            <div className="bg-danger text-white rounded-circle d-flex justify-content-center align-items-center" style={{width:'40px', height:'40px'}}>⚠️</div>
            <div>
              <h6 className="fw-bold mb-1">สถานะการเรียนน่าเป็นห่วง!</h6>
              <p className="mb-0 small">คุณมีงานค้าง {missingCount} ชิ้น หรือคะแนนต่ำกว่าเกณฑ์ รีบเคลียร์งานด่วนครับ</p>
            </div>
          </div>
        )}

        {/* Quiz Taking Mode (ทับหน้าจอทั้งหมด) */}
        {takingQuiz ? (
          <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-5">
            <div className="bg-danger text-white p-4">
              <h5 className="mb-0 fw-bold">📝 {takingQuiz.title}</h5>
              <p className="mb-0 small text-white-50">{takingQuiz.courses.course_name}</p>
            </div>
            <div className="card-body p-4">
              {takingQuiz.questions.map((q, qIndex) => (
                <div key={qIndex} className="mb-5">
                  <h6 className="fw-bold mb-3 fs-5">{qIndex + 1}. {q.question}</h6>
                  <div className="d-flex flex-column gap-2">
                    {q.options.map((opt, optIndex) => (
                      <label key={optIndex} className={`d-flex align-items-center gap-3 border p-3 rounded-4 ${quizAnswers[qIndex] === optIndex ? 'border-danger bg-danger bg-opacity-10 fw-bold text-danger' : 'border-light bg-white'}`} style={{cursor: 'pointer', transition: '0.2s'}}>
                        <input type="radio" name={`q-${qIndex}`} className="form-check-input mt-0" style={{width: '20px', height:'20px'}} checked={quizAnswers[qIndex] === optIndex} onChange={() => setQuizAnswers({...quizAnswers, [qIndex]: optIndex})} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="d-flex gap-3 pt-4 border-top">
                 <button onClick={() => setTakingQuiz(null)} className="btn btn-light rounded-pill fw-bold px-4 py-3 text-secondary">ยกเลิก</button>
                 <button onClick={handleQuizSubmit} className="btn btn-danger rounded-pill fw-bold flex-grow-1 py-3 shadow-sm">ส่งคำตอบ</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Navigation (ซ่อนในมือถือ) */}
            <div className="d-none d-md-flex gap-2 mb-4 bg-white p-2 rounded-pill shadow-sm w-100">
              <button className={`btn rounded-pill flex-grow-1 fw-bold ${activeTab === 'home' ? 'btn-primary shadow-sm' : 'btn-white text-muted'}`} onClick={() => setActiveTab('home')}>🏠 หน้าหลัก</button>
              <button className={`btn rounded-pill flex-grow-1 fw-bold ${activeTab === 'classroom' ? 'btn-primary shadow-sm' : 'btn-white text-muted'}`} onClick={() => setActiveTab('classroom')}>📚 ห้องเรียน</button>
              <button className={`btn rounded-pill flex-grow-1 fw-bold ${activeTab === 'tasks' ? 'btn-primary shadow-sm' : 'btn-white text-muted'}`} onClick={() => setActiveTab('tasks')}>📝 งาน & สอบ</button>
              <button className={`btn rounded-pill flex-grow-1 fw-bold ${activeTab === 'profile' ? 'btn-primary shadow-sm' : 'btn-white text-muted'}`} onClick={() => setActiveTab('profile')}>👤 บัญชี</button>
            </div>

            {/* TAB 1: 🏠 หน้าหลัก */}
            {activeTab === 'home' && (
              <div className="fade-in">
                <div className="card shadow-sm border-0 rounded-4 bg-primary text-white mb-4 overflow-hidden">
                  <div className="card-body p-4 position-relative">
                    <div className="position-relative z-1">
                      <h4 className="fw-bold mb-1">สวัสดี, {profileName || 'นักศึกษา'} 👋</h4>
                      <p className="text-white-50 mb-4">พร้อมสำหรับการเรียนรู้ในวันนี้หรือยัง?</p>
                      
                      <div className="bg-white bg-opacity-10 p-3 rounded-4">
                        <div className="d-flex justify-content-between mb-2">
                          <span className="fw-bold text-white small">ความก้าวหน้าการเรียน</span>
                          <span className="fw-bold text-white small">{progressPercentage}%</span>
                        </div>
                        <div className="progress bg-white bg-opacity-25" style={{ height: '8px' }}>
                          <div className="progress-bar bg-white rounded-pill" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-6">
                    <div className="card border-0 shadow-sm rounded-4 p-3 h-100 d-flex flex-column align-items-center justify-content-center">
                      <div className="bg-info bg-opacity-10 text-info rounded-circle d-flex align-items-center justify-content-center mb-2" style={{width:'50px', height:'50px', fontSize:'24px'}}>📖</div>
                      <h2 className="fw-bold mb-0">{enrolledCourses.length}</h2>
                      <p className="text-muted small mb-0">วิชาที่เรียน</p>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="card border-0 shadow-sm rounded-4 p-3 h-100 d-flex flex-column align-items-center justify-content-center">
                      <div className="bg-warning bg-opacity-10 text-warning rounded-circle d-flex align-items-center justify-content-center mb-2" style={{width:'50px', height:'50px', fontSize:'24px'}}>⏳</div>
                      <h2 className="fw-bold mb-0">{missingCount}</h2>
                      <p className="text-muted small mb-0">งานค้างส่ง</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 📚 ห้องเรียน */}
            {activeTab === 'classroom' && (
              <div className="fade-in">
                {/* Sub-Tabs Toggle */}
                <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4">
                  <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'enroll' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('enroll')}>ลงทะเบียนวิชา</button>
                  <button className={`btn rounded-pill flex-grow-1 fw-bold ${classSubTab === 'materials' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setClassSubTab('materials')}>เอกสารเรียน</button>
                </div>

                {classSubTab === 'enroll' && (
                  <div className="d-flex flex-column gap-3">
                    {allCourses.map(c => {
                      const isEnrolled = enrolledCourses.includes(c.id)
                      return (
                        <div key={c.id} className="card border-0 shadow-sm rounded-4 overflow-hidden">
                          <div className="card-body p-4">
                            <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 mb-2">{c.course_code}</span>
                            <h5 className="fw-bold mb-1">{c.course_name}</h5>
                            <p className="text-muted small mb-3">ภาคเรียน: {c.semester||'-'} | หน่วยกิต: {c.credits||'-'} | กลุ่ม: {c.section}</p>
                            <button onClick={() => handleEnroll(c.id)} disabled={isEnrolled} className={`btn w-100 rounded-pill fw-bold py-2 ${isEnrolled ? 'bg-light text-success border-0' : 'btn-primary shadow-sm'}`}>
                              {isEnrolled ? '✅ ลงทะเบียนแล้ว' : '➕ ลงทะเบียนเรียน'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {classSubTab === 'materials' && (
                  <div className="d-flex flex-column gap-3">
                    {materials.length === 0 ? <p className="text-center text-muted py-5">ยังไม่มีเอกสารในวิชาของคุณ</p> : materials.map(m => (
                      <div key={m.id} className="card border-0 shadow-sm rounded-4 p-3 d-flex flex-row align-items-center gap-3">
                         <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{width:'50px', height:'50px', flexShrink: 0}}>📎</div>
                         <div className="flex-grow-1">
                           <h6 className="fw-bold mb-1 text-truncate" style={{maxWidth: '200px'}}>{m.title}</h6>
                           <p className="text-muted small mb-0">{m.courses.course_name}</p>
                         </div>
                         <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-light text-primary rounded-circle p-2" style={{width:'40px', height:'40px'}}>⬇️</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: 📝 งาน & สอบ */}
            {activeTab === 'tasks' && (
              <div className="fade-in">
                <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4">
                  <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'assignments' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('assignments')}>ส่งงาน</button>
                  <button className={`btn rounded-pill flex-grow-1 fw-bold ${taskSubTab === 'quizzes' ? 'btn-primary' : 'btn-white text-muted'}`} onClick={() => setTaskSubTab('quizzes')}>แบบทดสอบ</button>
                </div>

                {taskSubTab === 'assignments' && (
                  <div className="d-flex flex-column gap-3">
                    {assignments.length === 0 ? <p className="text-center text-muted py-5">เยี่ยมมาก! ไม่มีงานค้าง</p> : assignments.map(a => {
                      const mySub = submissions.find(s => s.assignment_id === a.id)
                      return (
                        <div key={a.id} className="card border-0 shadow-sm rounded-4 overflow-hidden">
                          <div className={`p-2 ${mySub ? 'bg-success bg-opacity-10' : 'bg-warning bg-opacity-10'}`}></div>
                          <div className="card-body p-4">
                            <p className="text-muted small mb-1">{a.courses.course_name}</p>
                            <h5 className="fw-bold mb-2">{a.title}</h5>
                            <p className="text-secondary small mb-3 bg-light p-3 rounded-4">{a.description}</p>
                            
                            {mySub ? (
                              <div className="bg-success bg-opacity-10 p-3 rounded-4">
                                <h6 className="fw-bold text-success mb-2">✅ ส่งงานแล้ว</h6>
                                <p className="small mb-2 text-dark">"{mySub.submitted_text}"</p>
                                <span className="badge bg-success rounded-pill px-3 py-2">
                                  {mySub.score !== null ? `คะแนน: ${mySub.score}` : 'รอครูตรวจ'}
                                </span>
                              </div>
                            ) : (
                              <form onSubmit={(e) => handleWorkSubmit(e, a.id)}>
                                <textarea className="form-control bg-light border-0 rounded-4 p-3 mb-3" placeholder="พิมพ์คำตอบของคุณที่นี่..." required onChange={(e) => setSubmitForm({ assign_id: a.id, text: e.target.value })} rows="3" />
                                <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm">ส่งคำตอบ</button>
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
                      return (
                        <div key={q.id} className="card border-0 shadow-sm rounded-4">
                          <div className="card-body p-4 d-flex flex-column">
                            <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-3 py-1 align-self-start mb-2">แบบทดสอบ</span>
                            <h5 className="fw-bold mb-1">{q.title}</h5>
                            <p className="text-muted small mb-3">{q.courses.course_name}</p>
                            
                            {isDone ? (
                              <div className="bg-success bg-opacity-10 text-success fw-bold text-center p-2 rounded-pill w-100">
                                ✅ ทำแล้ว ได้ {isDone.score}/{isDone.total_score} คะแนน
                              </div>
                            ) : (
                              <button onClick={() => handleStartQuiz(q)} className="btn btn-danger rounded-pill fw-bold py-2 shadow-sm w-100">
                                ✍️ เริ่มทำแบบทดสอบ
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: 👤 บัญชี */}
            {activeTab === 'profile' && (
              <div className="fade-in">
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                  <div className="bg-primary p-5 text-center position-relative">
                    <div className="bg-white rounded-circle position-absolute start-50 translate-middle border border-4 border-white shadow-sm d-flex justify-content-center align-items-center" style={{width:'80px', height:'80px', top: '100%', fontSize:'30px'}}>
                      👨‍🎓
                    </div>
                  </div>
                  <div className="card-body pt-5 px-4 pb-4 text-center mt-3">
                    <h5 className="fw-bold mb-1">{profileName || 'นักศึกษา'}</h5>
                    <p className="text-muted mb-0">{session?.user?.email}</p>
                  </div>
                </div>

                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-4">
                    <h6 className="fw-bold mb-3">แก้ไขข้อมูลส่วนตัว</h6>
                    <form onSubmit={handleUpdateProfile}>
                      <div className="mb-3">
                        <label className="form-label text-muted small fw-bold">ชื่อ - นามสกุล</label>
                        <input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-2" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="ระบุชื่อ-นามสกุล" required />
                      </div>
                      <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm">บันทึกข้อมูล</button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation (เฉพาะบนจอมือถือ) */}
      {!takingQuiz && (
        <div className="fixed-bottom bg-white border-top shadow-lg d-md-none" style={{ zIndex: 1050, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="d-flex justify-content-around px-2 py-2">
            <button onClick={() => setActiveTab('home')} className={`btn border-0 d-flex flex-column align-items-center p-1 ${activeTab === 'home' ? 'text-primary' : 'text-muted'}`}>
              <span className="fs-4 mb-1 lh-1">🏠</span>
              <span className="fw-bold" style={{fontSize: '11px'}}>หน้าหลัก</span>
            </button>
            <button onClick={() => setActiveTab('classroom')} className={`btn border-0 d-flex flex-column align-items-center p-1 ${activeTab === 'classroom' ? 'text-primary' : 'text-muted'}`}>
              <span className="fs-4 mb-1 lh-1">📚</span>
              <span className="fw-bold" style={{fontSize: '11px'}}>ห้องเรียน</span>
            </button>
            <button onClick={() => setActiveTab('tasks')} className={`btn border-0 d-flex flex-column align-items-center p-1 ${activeTab === 'tasks' ? 'text-primary' : 'text-muted'}`}>
              <span className="fs-4 mb-1 lh-1">📝</span>
              <span className="fw-bold" style={{fontSize: '11px'}}>งาน/สอบ</span>
            </button>
            <button onClick={() => setActiveTab('profile')} className={`btn border-0 d-flex flex-column align-items-center p-1 ${activeTab === 'profile' ? 'text-primary' : 'text-muted'}`}>
              <span className="fs-4 mb-1 lh-1">👤</span>
              <span className="fw-bold" style={{fontSize: '11px'}}>ฉัน</span>
            </button>
          </div>
        </div>
      )}

      {/* เพิ่ม CSS เล็กน้อยสำหรับ Transition แบบเนียนๆ */}
      <style>{`
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .form-control:focus { box-shadow: none; border: 1px solid #0d6efd !important; }
      `}</style>
    </div>
  )
}