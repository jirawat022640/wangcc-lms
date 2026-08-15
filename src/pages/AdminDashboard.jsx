import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [activeTab, setActiveTab] = useState('overview') 
  const [stats, setStats] = useState({ totalCourses: 0, submissionRate: 0 })
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // ---------------- STATE สำหรับการแก้ไขข้อมูล ----------------
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '', nickname: '', phone: '', department: '', grade_level: '', avatar_url: ''
  })

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

  // ---------------- ฟังก์ชันการลบผู้ใช้ ----------------
  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`⚠️ คำเตือน: คุณต้องการลบผู้ใช้ "${name}" ออกจากระบบจริงหรือไม่? ข้อมูลการส่งงานจะหายไปด้วย`)) return
    
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) {
      alert(`ลบไม่ได้: ${error.message} (อาจมีข้อมูลส่งงานค้างอยู่)`)
    } else {
      fetchProfiles()
      alert('ลบผู้ใช้สำเร็จ!')
    }
  }

  // ---------------- ฟังก์ชันเปิดฟอร์มแก้ไข ----------------
  const openEditModal = (user) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name || '',
      nickname: user.nickname || '',
      phone: user.phone || '',
      department: user.department || '',
      grade_level: user.grade_level || '',
      avatar_url: user.avatar_url || ''
    })
  }

  // ---------------- ฟังก์ชันบันทึกการแก้ไข ----------------
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name,
      nickname: editForm.nickname,
      phone: editForm.phone,
      department: editForm.department,
      grade_level: editForm.grade_level,
      avatar_url: editForm.avatar_url
    }).eq('id', editingUser.id)

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      fetchProfiles()
      setEditingUser(null)
      alert('บันทึกข้อมูลเรียบร้อย!')
    }
  }

  const teachers = profiles.filter(p => p.role === 'teacher')
  const students = profiles.filter(p => p.role === 'student')

  if (!session || session.role !== 'admin') return <Navigate to="/" />

  return (
    <div className="bg-light min-vh-100 pb-5">
      
      {/* ---------------- โมดอลสำหรับแก้ไขข้อมูล (จะแสดงเมื่อกดปุ่มแก้ไข) ---------------- */}
      {editingUser && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="bg-white rounded-4 shadow-lg p-4 w-100" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h5 className="fw-bold mb-4 border-bottom pb-2">
              ✏️ แก้ไขข้อมูล {editingUser.role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'}
            </h5>
            <form onSubmit={handleSaveEdit}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">ชื่อ - นามสกุล</label>
                <input type="text" className="form-control bg-light border-0" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
              </div>
              
              <div className="row mb-3">
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted">ชื่อเล่น</label>
                  <input type="text" className="form-control bg-light border-0" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted">เบอร์โทรศัพท์</label>
                  <input type="text" className="form-control bg-light border-0" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">แผนกวิชา</label>
                <input type="text" className="form-control bg-light border-0" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} placeholder="เช่น ช่างยนต์, คอมพิวเตอร์ธุรกิจ" />
              </div>

              {/* แสดงระดับชั้น เฉพาะถ้านักเรียน */}
              {editingUser.role === 'student' && (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">ระดับชั้น</label>
                  <input type="text" className="form-control bg-light border-0" value={editForm.grade_level} onChange={e => setEditForm({...editForm, grade_level: e.target.value})} placeholder="เช่น ปวช.1, ปวส.2" />
                </div>
              )}

              <div className="mb-4">
                <label className="form-label small fw-bold text-muted">ลิงก์รูปโปรไฟล์ (URL)</label>
                <input type="url" className="form-control bg-light border-0" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} placeholder="วางลิงก์รูปภาพที่นี่..." />
              </div>

              <div className="d-flex gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-light w-50 rounded-pill fw-bold">ยกเลิก</button>
                <button type="submit" className="btn btn-primary w-50 rounded-pill fw-bold shadow-sm">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center mb-4 gap-3">
        <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-dark rounded-3 border-0 fs-4 px-3 py-1 shadow-sm">☰</button>
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
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'overview' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => handleTabChange('overview')}>📊 สถิติภาพรวม</button>
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'students' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => handleTabChange('students')}>👨‍🎓 จัดการนักเรียน</button>
              <button className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === 'teachers' ? 'btn-dark shadow-sm' : 'bg-white text-muted border-0'}`} onClick={() => handleTabChange('teachers')}>👨‍🏫 จัดการครูผู้สอน</button>
              
              <hr className="my-4 text-secondary" />
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="btn btn-outline-danger bg-white rounded-pill fw-bold py-3 shadow-sm mt-auto">ออกจากระบบ</button>
            </div>
          </div>
        </>
      )}

      <div className="container">
        {/* TAB 1: 📊 สถิติภาพรวม */}
        {activeTab === 'overview' && (
          <div className="fade-in">
             <div className="alert alert-primary border-0 shadow-sm rounded-4 mb-4 p-4">
                <h5 className="fw-bold mb-1">ยินดีต้อนรับ, ผู้ดูแลระบบ 🛡️</h5>
                <p className="mb-0 small">จัดการข้อมูลครูและนักเรียนทั้งหมดได้จากเมนูด้านซ้ายครับ</p>
             </div>
             {/* ส่วนตัวเลขสถิติเดิม (ซ่อนโค้ดยาวเพื่อความอ่านง่าย แต่ของจริงยังอยู่ครับ) */}
             <div className="row g-3">
               <div className="col-6 col-md-3"><div className="card bg-primary bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100"><h5 className="fw-bold text-dark mb-1">ครูผู้สอน</h5><h2 className="display-6 fw-bold text-primary mb-0">{teachers.length}</h2></div></div>
               <div className="col-6 col-md-3"><div className="card bg-info bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100"><h5 className="fw-bold text-dark mb-1">ผู้เรียน</h5><h2 className="display-6 fw-bold text-info mb-0">{students.length}</h2></div></div>
               <div className="col-6 col-md-3"><div className="card bg-success bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100"><h5 className="fw-bold text-dark mb-1">รายวิชา</h5><h2 className="display-6 fw-bold text-success mb-0">{stats.totalCourses}</h2></div></div>
               <div className="col-6 col-md-3"><div className="card bg-warning bg-opacity-10 border-0 shadow-sm rounded-4 p-4 text-center h-100"><h5 className="fw-bold text-dark mb-1">ส่งงานรวม</h5><h2 className="display-6 fw-bold text-warning mb-0">{stats.submissionRate}%</h2></div></div>
             </div>
          </div>
        )}

        {/* TAB 2: 👨‍🎓 จัดการนักเรียน */}
        {activeTab === 'students' && (
          <div className="fade-in">
            <h5 className="fw-bold mb-4 px-2">รายชื่อนักเรียนในระบบ ({students.length})</h5>
            <div className="row g-3">
              {students.map(user => (
                <div key={user.id} className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body p-3">
                      <div className="d-flex gap-3 mb-3">
                        <div className="flex-shrink-0">
                          {user.avatar_url ? (
                             <img src={user.avatar_url} alt="profile" className="rounded-circle object-fit-cover" style={{width:'60px', height:'60px'}} />
                          ) : (
                             <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{width:'60px', height:'60px', fontSize:'24px'}}>👨‍🎓</div>
                          )}
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-0 text-truncate">{user.full_name || 'ยังไม่ระบุชื่อ'} {user.nickname && `(${user.nickname})`}</h6>
                          <p className="mb-0 text-muted small">รหัส: {user.student_code || 'ไม่มีรหัส'}</p>
                          <span className="badge bg-light text-dark border mt-1">{user.grade_level || 'ไม่ระบุชั้น'} | {user.department || 'ไม่ระบุแผนก'}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                         <button onClick={() => openEditModal(user)} className="btn btn-warning btn-sm fw-bold w-100 rounded-pill text-dark shadow-sm">✏️ แก้ไข</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-danger btn-sm fw-bold w-100 rounded-pill shadow-sm">🗑️ ลบ</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-success btn-sm w-100 rounded-pill fw-bold mt-2">⬆️ เปลี่ยนเป็นครู</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: 👨‍🏫 จัดการครูผู้สอน */}
        {activeTab === 'teachers' && (
          <div className="fade-in">
            <h5 className="fw-bold mb-4 px-2">รายชื่อครูผู้สอนในระบบ ({teachers.length})</h5>
            <div className="row g-3">
              {teachers.map(user => (
                <div key={user.id} className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body p-3">
                      <div className="d-flex gap-3 mb-3">
                        <div className="flex-shrink-0">
                          {user.avatar_url ? (
                             <img src={user.avatar_url} alt="profile" className="rounded-circle object-fit-cover" style={{width:'60px', height:'60px'}} />
                          ) : (
                             <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style={{width:'60px', height:'60px', fontSize:'24px'}}>👩‍🏫</div>
                          )}
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-0 text-truncate">{user.full_name || 'ยังไม่ระบุชื่อ'} {user.nickname && `(${user.nickname})`}</h6>
                          <p className="mb-0 text-muted small">เบอร์โทร: {user.phone || '-'}</p>
                          <span className="badge bg-light text-dark border mt-1">แผนก: {user.department || 'ไม่ระบุแผนก'}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                         <button onClick={() => openEditModal(user)} className="btn btn-warning btn-sm fw-bold w-100 rounded-pill text-dark shadow-sm">✏️ แก้ไข</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-danger btn-sm fw-bold w-100 rounded-pill shadow-sm">🗑️ ลบ</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-danger btn-sm w-100 rounded-pill fw-bold mt-2">⬇️ เปลี่ยนเป็นนักเรียน</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <style>{`.fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}