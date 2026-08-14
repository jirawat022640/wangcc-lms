import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [activeTab, setActiveTab] = useState('overview') 
  const [stats, setStats] = useState({ totalCourses: 0, submissionRate: 0 })
  
  // สถานะเปิด-ปิด Hamburger Menu
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (session?.role === 'admin') {
      fetchProfiles()
      fetchAnalytics()
    }
  }, [session])

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setProfiles(data)
  }

  const fetchAnalytics = async () => {
    const { count: cCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })
    const { count: aCount } = await supabase.from('assignments').select('*', { count: 'exact', head: true })
    const { count: sCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true })
    
    // คำนวณอัตราการส่งงานโดยรวม
    const studentsCount = profiles.filter(p => p.role === 'student').length || 1
    const expectedSubmissions = (aCount || 0) * studentsCount
    const rate = expectedSubmissions > 0 ? Math.round(((sCount || 0) / expectedSubmissions) * 100) : 0
    
    setStats({ totalCourses: cCount || 0, submissionRate: rate > 100 ? 100 : rate })
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setIsMenuOpen(false)
  }

  const handleChangeRole = async (userId, currentRole) => {
    const newRole = currentRole === 'student' ? 'teacher' : 'student'
    if (!window.confirm(`ต้องการเปลี่ยนสิทธิ์เป็น ${newRole === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'} หรือไม่?`)) return
    
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    fetchProfiles()
    alert('ปรับเปลี่ยนสิทธิ์สำเร็จ!')
  }

  const teachers = profiles.filter(p => p.role === 'teacher')
  const students = profiles.filter(p => p.role === 'student')

  if (!session || session.role !== 'admin') return <Navigate to="/" />

  return (
    <div className="bg-light min-vh-100 pb-5">
      
      {/* Top Header with Hamburger Icon */}
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center mb-4 gap-3">
        <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-dark rounded-3 border-0 fs-4 px-3 py-1 shadow-sm">
          ☰
        </button>
        <h4 className="fw-bold text-dark m-0 flex-grow-1">Admin Portal</h4>
      </div>

      {/* Hamburger Menu (Offcanvas) */}
      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show" style={{ display: 'block', zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0" style={{ visibility: 'visible', zIndex: 1045, width: '300px' }} tabIndex="-1">
            <div className="offcanvas-header border-bottom p-4 bg-dark text-white">
              <h5 className="offcanvas-title fw-bold m-0">ตั้งค่าระบบ (Admin)</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column gap-2 p-4 bg-light">
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'overview' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => { handleTabChange('overview'); fetchAnalytics(); }}>📊 สถิติภาพรวม</button>
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'students' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => handleTabChange('students')}>👨‍🎓 จัดการนักเรียน</button>
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'teachers' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => handleTabChange('teachers')}>👨‍🏫 จัดการครูผู้สอน</button>
              
              <hr className="my-4 text-secondary" />
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="btn btn-outline-danger bg-white rounded-pill fw-bold py-3 shadow-sm mt-auto">
                ออกจากระบบ
              </button>
            </div>
          </div>
        </>
      )}

      <div className="container">
        
        {/* TAB 1: 📊 สถิติภาพรวม */}
        {activeTab === 'overview' && (
          <div className="fade-in">
            <div className="card shadow-sm border-0 rounded-4 bg-dark text-white mb-4 overflow-hidden">
              <div className="card-body p-4 p-md-5 position-relative">
                <div className="position-relative z-1">
                  <h3 className="fw-bold mb-2">ยินดีต้อนรับ, ผู้ดูแลระบบ 🛡️</h3>
                  <p className="text-white-50 mb-0">ภาพรวมการใช้งานระบบวิทยาลัยเทคนิควังน้ำเย็น</p>
                </div>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-6 col-md-3">
                <div className="card bg-primary bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100">
                  <div className="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center mx-auto mb-3" style={{width:'50px', height:'50px', fontSize:'24px'}}>👨‍🏫</div>
                  <h5 className="fw-bold text-dark mb-1">ครูผู้สอน</h5>
                  <h2 className="display-6 fw-bold text-primary mb-0">{teachers.length}</h2>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card bg-info bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100">
                  <div className="bg-info text-white rounded-circle d-flex justify-content-center align-items-center mx-auto mb-3" style={{width:'50px', height:'50px', fontSize:'24px'}}>👨‍🎓</div>
                  <h5 className="fw-bold text-dark mb-1">ผู้เรียน</h5>
                  <h2 className="display-6 fw-bold text-info mb-0">{students.length}</h2>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card bg-success bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100">
                  <div className="bg-success text-white rounded-circle d-flex justify-content-center align-items-center mx-auto mb-3" style={{width:'50px', height:'50px', fontSize:'24px'}}>📚</div>
                  <h5 className="fw-bold text-dark mb-1">รายวิชา</h5>
                  <h2 className="display-6 fw-bold text-success mb-0">{stats.totalCourses}</h2>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card bg-warning bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100">
                  <div className="bg-warning text-dark rounded-circle d-flex justify-content-center align-items-center mx-auto mb-3" style={{width:'50px', height:'50px', fontSize:'24px'}}>📈</div>
                  <h5 className="fw-bold text-dark mb-1">ส่งงานรวม</h5>
                  <h2 className="display-6 fw-bold text-warning mb-0">{stats.submissionRate}%</h2>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 👨‍🎓 จัดการนักเรียน */}
        {activeTab === 'students' && (
          <div className="fade-in">
            <h5 className="fw-bold mb-4 px-2">รายชื่อนักเรียนในระบบ ({students.length})</h5>
            
            {students.length === 0 ? (
               <div className="text-center text-muted py-5 card border-0 rounded-4 shadow-sm">ไม่พบข้อมูลนักเรียน</div>
            ) : (
              <div className="row g-3">
                {students.map(user => (
                  <div key={user.id} className="col-md-6 col-xl-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body p-3 d-flex align-items-center gap-3">
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'50px', height:'50px', fontSize:'20px'}}>
                          👨‍🎓
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-0 text-truncate">{user.full_name || 'ยังไม่ระบุชื่อ'}</h6>
                          <p className="mb-0 text-muted small">รหัส: {user.student_code || 'ไม่มีรหัส'}</p>
                        </div>
                        <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-success btn-sm rounded-pill fw-bold flex-shrink-0 px-3">
                          ⬆️ ตั้งเป็นครู
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 👨‍🏫 จัดการครูผู้สอน */}
        {activeTab === 'teachers' && (
          <div className="fade-in">
            <h5 className="fw-bold mb-4 px-2">รายชื่อครูผู้สอนในระบบ ({teachers.length})</h5>
            
            {teachers.length === 0 ? (
               <div className="text-center text-muted py-5 card border-0 rounded-4 shadow-sm">ไม่พบข้อมูลครูผู้สอน</div>
            ) : (
              <div className="row g-3">
                {teachers.map(user => (
                  <div key={user.id} className="col-md-6 col-xl-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body p-3 d-flex align-items-center gap-3">
                        <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'50px', height:'50px', fontSize:'20px'}}>
                          👩‍🏫
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-0 text-truncate">{user.full_name || 'ยังไม่ระบุชื่อ'}</h6>
                          <p className="mb-0 text-muted small">รหัสบัญชี: {user.student_code || '-'}</p>
                        </div>
                        <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-danger btn-sm rounded-pill fw-bold flex-shrink-0 px-3">
                          ⬇️ ปรับลง
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Styles สำหรับ Animation */}
      <style>{`
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}