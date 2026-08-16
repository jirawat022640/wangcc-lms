import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2' // 🌟 นำเข้า SweetAlert2

export default function AdminDashboard({ session, handleLogout }) {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [activeTab, setActiveTab] = useState('overview') 
  const [stats, setStats] = useState({ totalCourses: 0, submissionRate: 0 })
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const [masterCount, setMasterCount] = useState(0) 
  const [isUploading, setIsUploading] = useState(false)

  const [allCourses, setAllCourses] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [sysSettings, setSysSettings] = useState({ current_semester: '' })
  
  const [annForm, setAnnForm] = useState({ title: '', content: '' })
  const [semForm, setSemForm] = useState('')

  // State สำหรับจัดการกลุ่มเรียน/แผนก
  const [departments, setDepartments] = useState([])
  const [deptForm, setDeptForm] = useState({ name: '' })

  // State สำหรับระบบค้นหา (Search Filters)
  const [searchStudent, setSearchStudent] = useState('')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [searchCourse, setSearchCourse] = useState('')
  const [searchDept, setSearchDept] = useState('')

  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '', nickname: '', phone: '', department: '', grade_level: '', avatar_url: ''
  })

  const [showAddTeacher, setShowAddTeacher] = useState(false) 
  const [addTeacherForm, setAddTeacherForm] = useState({
    teacherId: '', teacherName: '', department: '', password: ''
  })
  const [addStatus, setAddStatus] = useState({ type: '', message: '' })
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (session?.role === 'admin') {
      fetchProfiles()
      fetchAnalytics()
      fetchMasterCount()
      fetchAllData()
      fetchClassroomData() 
    }
  }, [session])

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*')
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

  const fetchMasterCount = async () => {
    const { count } = await supabase.from('student_master').select('*', { count: 'exact', head: true })
    setMasterCount(count || 0)
  }

  const fetchAllData = async () => {
    const { data: courses } = await supabase.from('courses').select('*, profiles(full_name)').order('created_at', { ascending: false })
    if (courses) setAllCourses(courses)
    
    const { data: anns } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (anns) setAnnouncements(anns)

    const { data: sets } = await supabase.from('system_settings').select('*').eq('id', 1).single()
    if (sets) {
      setSysSettings(sets)
      setSemForm(sets.current_semester)
    }
  }

  const fetchClassroomData = async () => {
    const { data: dData } = await supabase.from('departments').select('*').order('created_at', { ascending: true })
    if (dData) setDepartments(dData)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setIsMenuOpen(false)
    setShowAddTeacher(false)
  }

  // 🌟 ใช้ SweetAlert สำหรับตั้งรหัสผ่านใหม่
  const handleResetPassword = async (userId, name) => {
    const { value: newPass } = await Swal.fire({
      title: 'รีเซ็ตรหัสผ่าน',
      input: 'text',
      inputLabel: `ระบุรหัสผ่านใหม่สำหรับ: ${name}`,
      inputValue: '123456',
      text: '(แนะนำตั้งเป็น 123456 หรือรหัสประจำตัว)',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        if (!value) return 'กรุณาระบุรหัสผ่าน!'
      }
    })

    if (!newPass) return

    const { error } = await supabase.rpc('reset_user_password', { target_user_id: userId, new_password: newPass })
    if (error) {
      Swal.fire('รีเซ็ตไม่สำเร็จ', error.message, 'error')
    } else {
      Swal.fire('สำเร็จ!', `รีเซ็ตรหัสผ่านของ ${name} เป็น "${newPass}" สำเร็จ!`, 'success')
    }
  }

  // 🌟 ใช้ SweetAlert สำหรับยืนยันการลบวิชา
  const handleDeleteCourseAdmin = async (courseId, courseName) => {
    const result = await Swal.fire({
      title: 'คำเตือน: ยืนยันการลบวิชา?',
      text: `ต้องการลบวิชา "${courseName}" จริงหรือไม่? ข้อมูลการส่งงานของนักเรียนในวิชานี้จะหายไปด้วย`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    })

    if (!result.isConfirmed) return

    await supabase.from('courses').delete().eq('id', courseId)
    fetchAllData()
    fetchAnalytics()
    Swal.fire('ลบสำเร็จ!', 'ลบรายวิชาออกจากระบบเรียบร้อยแล้ว', 'success')
  }

  // 🌟 ใช้ SweetAlert สำหรับการสร้างประกาศ
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault()
    await supabase.from('announcements').insert([annForm])
    setAnnForm({ title: '', content: '' })
    fetchAllData()
    Swal.fire('สำเร็จ!', 'บันทึกประกาศสำเร็จเรียบร้อยแล้ว', 'success')
  }

  const handleDeleteAnnouncement = async (id) => {
    const result = await Swal.fire({
      title: 'ลบประกาศ?',
      text: "คุณต้องการลบประกาศนี้หรือไม่?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย'
    })

    if (!result.isConfirmed) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchAllData()
    Swal.fire('ลบแล้ว!', 'ลบประกาศเรียบร้อยแล้ว', 'success')
  }

  const handleUpdateSettings = async (e) => {
    e.preventDefault()
    await supabase.from('system_settings').update({ current_semester: semForm }).eq('id', 1)
    fetchAllData()
    Swal.fire('บันทึกสำเร็จ!', 'อัปเดตภาคเรียนสำเร็จ! วิชาที่ครูสร้างใหม่จะใช้ค่านี้', 'success')
  }

  const handleChangeRole = async (userId, currentRole) => {
    const newRole = currentRole === 'student' ? 'teacher' : 'student'
    const roleText = newRole === 'teacher' ? 'ครู' : 'นักเรียน'
    
    const result = await Swal.fire({
      title: `เปลี่ยนสิทธิ์เป็น ${roleText}?`,
      text: `ต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้เป็น ${roleText} หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยันการเปลี่ยน'
    })

    if (!result.isConfirmed) return
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    fetchProfiles()
    Swal.fire('อัปเดตสิทธิ์สำเร็จ!', `ผู้ใช้ถูกเปลี่ยนสิทธิ์เป็น ${roleText} แล้ว`, 'success')
  }

  const handleDeleteUser = async (userId, name) => {
    const result = await Swal.fire({
      title: 'คำเตือนร้ายแรง',
      text: `ต้องการลบ "${name}" ออกจากระบบจริงหรือไม่? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบถาวร`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก'
    })

    if (!result.isConfirmed) return
    await supabase.from('profiles').delete().eq('id', userId)
    fetchProfiles()
    Swal.fire('ลบผู้ใช้สำเร็จ', 'บัญชีผู้ใช้นี้ถูกลบออกจากระบบแล้ว', 'success')
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setEditForm({ full_name: user.full_name || '', nickname: user.nickname || '', phone: user.phone || '', department: user.department || '', grade_level: user.grade_level || '', avatar_url: user.avatar_url || '' })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    await supabase.from('profiles').update(editForm).eq('id', editingUser.id)
    fetchProfiles()
    setEditingUser(null)
    Swal.fire('บันทึกสำเร็จ!', 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว', 'success')
  }

  const handleCreateTeacher = async (e) => {
    e.preventDefault()
    setIsAdding(true)
    setAddStatus({ type: 'info', message: 'กำลังสร้างบัญชี...' })

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const adminAuthClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const emailToUse = `${addTeacherForm.teacherId}@wnytc.ac.th`

    const { data: authData, error: authError } = await adminAuthClient.auth.signUp({ email: emailToUse, password: addTeacherForm.password })

    if (authError) {
      setAddStatus({ type: 'danger', message: `❌ เกิดข้อผิดพลาด: ${authError.message}` })
      setIsAdding(false)
      return
    }

    if (authData.user) {
      await supabase.from('profiles').upsert({
        id: authData.user.id, student_code: addTeacherForm.teacherId, full_name: addTeacherForm.teacherName,
        department: addTeacherForm.department, grade_level: 'บุคลากร', role: 'teacher'
      })
      setAddStatus({ type: 'success', message: `🎉 สร้างบัญชีครูสำเร็จ!` })
      setAddTeacherForm({ teacherId: '', teacherName: '', department: '', password: '' })
      fetchProfiles() 
      setTimeout(() => { setShowAddTeacher(false); setAddStatus({ type: '', message: '' }) }, 2000)
    }
    setIsAdding(false)
  }

  // 🌟 ใช้ SweetAlert สำหรับอัปโหลด CSV
  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const result = await Swal.fire({
      title: 'นำเข้าข้อมูล?',
      text: `ยืนยันการนำเข้าข้อมูลนักเรียนจากไฟล์ ${file.name} หรือไม่?`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'นำเข้าเลย',
      cancelButtonText: 'ยกเลิก'
    })

    if (!result.isConfirmed) {
      e.target.value = null
      return
    }

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result; 
        const rows = text.split('\n').filter(row => row.trim() !== '')
        const insertData = []
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',')
          if (cols.length >= 4) {
             insertData.push({ 
                student_code: cols[0].trim().replace(/"/g, ''), 
                full_name: cols[1].trim().replace(/"/g, ''), 
                department: cols[2].trim().replace(/"/g, ''), 
                grade_level: cols[3].trim().replace(/"/g, '') 
             })
          }
        }
        if (insertData.length === 0) { 
          Swal.fire('เกิดข้อผิดพลาด', 'ไม่พบข้อมูลในไฟล์ CSV', 'error')
          setIsUploading(false)
          return 
        }
        const chunkSize = 200; 
        let successCount = 0
        for (let i = 0; i < insertData.length; i += chunkSize) {
          const chunk = insertData.slice(i, i + chunkSize)
          await supabase.from('student_master').upsert(chunk, { onConflict: 'student_code' })
          successCount += chunk.length
        }
        
        Swal.fire('เสร็จสิ้น!', `นำเข้านักเรียนสำเร็จทั้งหมด ${successCount} คน!`, 'success')
        fetchMasterCount()
      } catch (error) { 
        Swal.fire('Error', `เกิดข้อผิดพลาด: ${error.message}`, 'error')
      } finally { 
        setIsUploading(false); e.target.value = null 
      }
    }
    reader.readAsText(file, 'UTF-8') 
  }

  // 🌟 ใช้ SweetAlert สำหรับจัดการกลุ่มเรียน/แผนก
  const handleCreateDepartment = async (e) => {
    e.preventDefault()
    if (!deptForm.name.trim()) return

    const { error } = await supabase.from("departments").insert([{ name: deptForm.name.trim() }])
    
    if (error) {
       Swal.fire('เกิดข้อผิดพลาด', error.message, 'error')
       console.error(error)
    } else {
       setDeptForm({ name: "" })
       fetchClassroomData()
       Swal.fire({
         toast: true,
         position: 'top-end',
         icon: 'success',
         title: 'บันทึกข้อมูลห้องเรียนสำเร็จ!',
         showConfirmButton: false,
         timer: 2000
       })
    }
  }

  const handleDeleteDepartment = async (id, name) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: `ต้องการลบข้อมูลกลุ่มเรียน/แผนก: "${name}" หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบข้อมูล'
    })

    if (!result.isConfirmed) return
    
    const { error } = await supabase.from("departments").delete().eq("id", id)
    if (error) {
       Swal.fire('ลบไม่สำเร็จ', error.message, 'error')
    } else {
       fetchClassroomData()
       Swal.fire('ลบสำเร็จ!', 'ข้อมูลห้องเรียนถูกลบออกแล้ว', 'success')
    }
  }

  // Logic การกรองข้อมูลแบบ Real-time
  const teachers = profiles.filter(p => p.role === 'teacher')
  const students = profiles.filter(p => p.role === 'student')

  const filteredStudents = students.filter(s => 
    (s.full_name || '').toLowerCase().includes(searchStudent.toLowerCase()) || 
    (s.student_code || '').toLowerCase().includes(searchStudent.toLowerCase()) ||
    (s.department || '').toLowerCase().includes(searchStudent.toLowerCase())
  )

  const filteredTeachers = teachers.filter(t => 
    (t.full_name || '').toLowerCase().includes(searchTeacher.toLowerCase()) || 
    (t.student_code || '').toLowerCase().includes(searchTeacher.toLowerCase()) ||
    (t.department || '').toLowerCase().includes(searchTeacher.toLowerCase())
  )

  const filteredCourses = allCourses.filter(c => 
    (c.course_name || '').toLowerCase().includes(searchCourse.toLowerCase()) || 
    (c.course_code || '').toLowerCase().includes(searchCourse.toLowerCase()) ||
    (c.section || '').toLowerCase().includes(searchCourse.toLowerCase()) ||
    (c.profiles?.full_name || '').toLowerCase().includes(searchCourse.toLowerCase())
  )

  const filteredDepts = departments.filter(d => 
    (d.name || '').toLowerCase().includes(searchDept.toLowerCase())
  )

  if (!session || session.role !== 'admin') return <Navigate to="/" />

  return (
    <div className="bg-light min-vh-100 pb-5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* ---------------- โมดอลสำหรับแก้ไขข้อมูล ---------------- */}
      {editingUser && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050, backdropFilter: 'blur(5px)' }}>
          <div className="bg-white rounded-4 shadow-lg p-4 w-100 slide-up mx-3" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h5 className="fw-bold mb-4 border-bottom pb-3 text-primary">✏️ แก้ไขข้อมูล {editingUser.role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'}</h5>
            <form onSubmit={handleSaveEdit}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">ชื่อ - นามสกุล</label>
                <input type="text" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
              </div>
              <div className="row mb-3">
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted">ชื่อเล่น</label>
                  <input type="text" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted">เบอร์โทรศัพท์</label>
                  <input type="text" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">แผนกวิชา</label>
                <input type="text" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} />
              </div>
              {editingUser.role === 'student' && (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">ระดับชั้น</label>
                  <input type="text" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.grade_level} onChange={e => setEditForm({...editForm, grade_level: e.target.value})} />
                </div>
              )}
              <div className="mb-4">
                <label className="form-label small fw-bold text-muted">ลิงก์รูปโปรไฟล์ (URL)</label>
                <input type="url" className="form-control custom-input bg-light border-0 rounded-3 p-2" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} />
              </div>
              <div className="d-flex gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-light w-50 rounded-pill fw-bold py-2">ยกเลิก</button>
                <button type="submit" className="btn btn-primary w-50 rounded-pill fw-bold shadow-sm py-2">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔵 Top Navigation */}
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center justify-content-between mb-4 z-3">
        <div className="d-flex align-items-center gap-3">
          <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-primary rounded-circle p-0" style={{ width: '40px', height: '40px' }}><span className="fs-5">☰</span></button>
          <h5 className="fw-bold text-primary m-0">Admin Hub</h5>
        </div>
        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>🛡️</div>
      </div>

      {/* 🔵 Drawer Menu */}
      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0" style={{ visibility: "visible", zIndex: 1045, width: "280px" }}>
            <div className="offcanvas-header p-4 text-white" style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><span>🛡️</span> ศูนย์ควบคุม</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1" style={{ overflowY: 'auto' }}>
              {[
                { id: 'overview', icon: '📊', label: 'สถิติภาพรวม' },
                { id: 'classrooms', icon: '🏢', label: 'จัดการข้อมูลห้องเรียน' },
                { id: 'students', icon: '👨‍🎓', label: 'จัดการนักเรียน' },
                { id: 'teachers', icon: '👨‍🏫', label: 'จัดการครูผู้สอน' },
                { id: 'courses', icon: '📚', label: 'รายวิชาทั้งหมด' },
                { id: 'announcements', icon: '📢', label: 'ประกาศข่าวสาร' },
                { id: 'settings', icon: '⚙️', label: 'ตั้งค่าระบบ' }
              ].map(item => (
                <button key={item.id} className={`btn text-start fw-bold py-3 px-4 rounded-4 transition-all ${activeTab === item.id ? "bg-primary bg-opacity-10 text-primary" : "bg-white text-muted border-0 hover-bg-light"}`} onClick={() => handleTabChange(item.id)}>
                  <span className="me-3">{item.icon}</span> {item.label}
                </button>
              ))}
              <div className="mt-auto pt-3 border-top">
                <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="btn btn-light text-danger w-100 rounded-pill fw-bold py-3">ออกจากระบบ</button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="container" style={{ maxWidth: '1100px' }}>
        
        {/* TAB 1: 📊 สถิติภาพรวม */}
        {activeTab === 'overview' && (
          <div className="fade-in">
             <div className="card shadow-sm border-0 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #084298 100%)' }}>
                <div className="card-body p-4 p-md-5 text-white position-relative overflow-hidden">
                    <div className="position-relative z-2">
                        <h3 className="fw-bold mb-2">ยินดีต้อนรับ, ผู้ดูแลระบบ 👋</h3>
                        <p className="text-white-50 mb-0">ภาคเรียนปัจจุบัน: {sysSettings.current_semester}</p>
                    </div>
                    <div className="position-absolute opacity-25" style={{ top: '-20px', right: '-20px', fontSize: '150px' }}>🛡️</div>
                </div>
             </div>
             <div className="row g-3">
               <div className="col-6 col-md-3">
                 <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white">
                   <div className="bg-primary bg-opacity-10 text-primary rounded-circle mx-auto mb-3 p-3 fs-3">👨‍🏫</div>
                   <h2 className="fw-bold text-dark mb-0">{teachers.length}</h2>
                   <small className="text-muted fw-bold">ครูผู้สอน</small>
                 </div>
               </div>
               <div className="col-6 col-md-3">
                 <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white">
                   <div className="bg-info bg-opacity-10 text-info rounded-circle mx-auto mb-3 p-3 fs-3">👨‍🎓</div>
                   <h2 className="fw-bold text-dark mb-0">{students.length}</h2>
                   <small className="text-muted fw-bold">นักเรียน</small>
                 </div>
               </div>
               <div className="col-6 col-md-3">
                 <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white">
                   <div className="bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-3 p-3 fs-3">📚</div>
                   <h2 className="fw-bold text-dark mb-0">{stats.totalCourses}</h2>
                   <small className="text-muted fw-bold">รายวิชา</small>
                 </div>
               </div>
               <div className="col-6 col-md-3">
                 <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white">
                   <div className="bg-warning bg-opacity-10 text-warning rounded-circle mx-auto mb-3 p-3 fs-3">📈</div>
                   <h2 className="fw-bold text-dark mb-0">{stats.submissionRate}%</h2>
                   <small className="text-muted fw-bold">ส่งงาน</small>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* 🌟 TAB: 🏢 จัดการห้องเรียน */}
        {activeTab === 'classrooms' && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div className="card-body p-4 p-md-5">
                  <h5 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2"><span>➕</span> เพิ่มข้อมูลห้องเรียน</h5>
                  <p className="text-muted small mb-4">พิมพ์รูปแบบสำเร็จรูป เพื่อให้คุณครูคลิกเลือกในหน้าสร้างวิชาได้ทันที</p>
                  
                  <form onSubmit={handleCreateDepartment} className="d-flex flex-column gap-3">
                    <div className="form-floating">
                      <input type="text" className="form-control custom-input bg-light border-0 rounded-4" id="deptName" placeholder="เช่น แผนกวิชาช่างยนต์ ปวช.1/1" value={deptForm.name} onChange={(e) => setDeptForm({ name: e.target.value })} required />
                      <label htmlFor="deptName" className="text-muted fw-bold">เช่น แผนกวิชาช่างยนต์ ปวช.1/1</label>
                    </div>
                    <button type="submit" className="btn btn-primary rounded-4 fw-bold py-3 mt-2 shadow-sm custom-btn">บันทึกข้อมูล</button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="col-lg-7">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="fw-bold text-dark m-0">รายการห้องเรียน ({filteredDepts.length})</h5>
                <input 
                  type="text" 
                  className="form-control border-0 bg-white shadow-sm rounded-pill px-4" 
                  placeholder="🔍 ค้นหาห้องเรียน..." 
                  style={{ maxWidth: '250px' }}
                  value={searchDept}
                  onChange={(e) => setSearchDept(e.target.value)}
                />
              </div>
              <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="table-responsive" style={{ maxHeight: '500px' }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th className="px-4 py-3 text-secondary">ลำดับ</th>
                        <th className="py-3 text-secondary">ชื่อแผนกและกลุ่มเรียน</th>
                        <th className="py-3 text-secondary text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepts.length === 0 ? (
                        <tr><td colSpan="3" className="text-center py-4 text-muted">ไม่พบข้อมูลที่ค้นหา</td></tr>
                      ) : (
                        filteredDepts.map((dept, index) => (
                          <tr key={dept.id}>
                            <td className="px-4 text-muted">{index + 1}</td>
                            <td className="fw-bold text-dark">{dept.name}</td>
                            <td className="text-center">
                              <button onClick={() => handleDeleteDepartment(dept.id, dept.name)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm hover-bg-danger">
                                <span style={{fontSize:'12px'}}>🗑️</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: 👨‍🎓 จัดการนักเรียน */}
        {activeTab === 'students' && (
          <div className="fade-in">
            <div className="card shadow-sm border-0 rounded-4 mb-4 bg-white overflow-hidden">
              <div className="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                    <span className="fs-4">📥</span> นำเข้าฐานข้อมูลนักเรียน
                  </h5>
                  <p className="text-muted small mb-0 mt-1">
                    รอนักเรียนเข้าระบบ: <strong className="text-primary">{masterCount} คน</strong>
                  </p>
                </div>
                <div>
                  <input type="file" accept=".csv" id="csvUpload" className="d-none" onChange={handleCSVUpload} disabled={isUploading} />
                  <label htmlFor="csvUpload" className="btn btn-primary rounded-pill fw-bold px-4 py-2 mb-0" style={{cursor: 'pointer'}}>
                    {isUploading ? '⏳ กำลังนำเข้า...' : '📄 อัปโหลด CSV'}
                  </label>
                </div>
              </div>
            </div>
            
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 px-2 gap-3">
              <h5 className="fw-bold text-dark m-0">นักเรียนในระบบ ({filteredStudents.length})</h5>
              <input 
                type="text" 
                className="form-control border-0 bg-white shadow-sm rounded-pill px-4" 
                placeholder="🔍 ค้นหาชื่อ, รหัส, แผนก..." 
                style={{ maxWidth: '300px' }}
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
              />
            </div>

            <div className="row g-3">
              {filteredStudents.length === 0 && <p className="text-muted ps-3">ไม่พบรายชื่อนักเรียนที่ค้นหา</p>}
              {filteredStudents.map(user => (
                <div key={user.id} className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-card">
                    <div className="card-body p-4 d-flex flex-column">
                      <div className="d-flex gap-3 mb-3">
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'60px', height:'60px', fontSize:'24px'}}>👨‍🎓</div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-1 text-truncate text-dark">{user.full_name || 'ไม่ระบุชื่อ'}</h6>
                          <p className="mb-0 text-muted small">รหัส: {user.student_code}</p>
                          <span className="badge bg-light text-secondary border mt-1 text-truncate" style={{maxWidth: '100%'}}>{user.department || '-'}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-auto pt-3 border-top">
                         <button onClick={() => openEditModal(user)} className="btn btn-light text-primary flex-grow-1 rounded-pill fw-bold py-2">✏️ แก้ไข</button>
                         <button onClick={() => handleResetPassword(user.id, user.full_name)} className="btn btn-warning text-dark rounded-pill px-3 fw-bold shadow-sm" title="รีเซ็ตรหัสผ่าน">🔑</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm">🗑️</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-success btn-sm w-100 rounded-pill fw-bold mt-2 py-2">⬆️ อัปเกรดเป็นครู</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: 👨‍🏫 จัดการครูผู้สอน */}
        {activeTab === 'teachers' && (
          <div className="fade-in">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 px-2 gap-3">
              <h5 className="fw-bold mb-0 text-dark">ครูผู้สอน ({filteredTeachers.length})</h5>
              <div className="d-flex gap-2">
                <input 
                  type="text" 
                  className="form-control border-0 bg-white shadow-sm rounded-pill px-4" 
                  placeholder="🔍 ค้นหาครู..." 
                  style={{ maxWidth: '200px' }}
                  value={searchTeacher}
                  onChange={(e) => setSearchTeacher(e.target.value)}
                />
                <button onClick={() => setShowAddTeacher(!showAddTeacher)} className={`btn fw-bold rounded-pill shadow-sm px-4 py-2 flex-shrink-0 ${showAddTeacher ? 'btn-secondary' : 'btn-primary'}`}>
                  {showAddTeacher ? '✖ ปิดฟอร์ม' : '➕ เพิ่มบัญชี'}
                </button>
              </div>
            </div>
            
            {showAddTeacher && (
              <div className="card shadow-sm border-0 rounded-4 mb-5 bg-white p-4">
                  <h5 className="fw-bold text-primary mb-3">ฟอร์มสร้างบัญชีบุคลากร</h5>
                  <form onSubmit={handleCreateTeacher} className="row g-3">
                      <div className="col-md-6">
                        <input type="text" className="form-control bg-light border-0 p-3 rounded-3" placeholder="รหัสบุคลากร" value={addTeacherForm.teacherId} onChange={(e) => setAddTeacherForm({...addTeacherForm, teacherId: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <input type="text" className="form-control bg-light border-0 p-3 rounded-3" placeholder="ชื่อ-สกุล" value={addTeacherForm.teacherName} onChange={(e) => setAddTeacherForm({...addTeacherForm, teacherName: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <input type="text" className="form-control bg-light border-0 p-3 rounded-3" placeholder="แผนก" value={addTeacherForm.department} onChange={(e) => setAddTeacherForm({...addTeacherForm, department: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <input type="text" className="form-control bg-light border-0 p-3 rounded-3" placeholder="รหัสผ่านชั่วคราว" value={addTeacherForm.password} onChange={(e) => setAddTeacherForm({...addTeacherForm, password: e.target.value})} required />
                      </div>
                      <div className="col-12 text-end">
                        <button type="submit" className="btn btn-primary rounded-pill px-5 fw-bold py-2" disabled={isAdding}>
                          {isAdding ? '⏳ กำลังประมวลผล...' : 'สร้างบัญชี'}
                        </button>
                      </div>
                  </form>
              </div>
            )}

            <div className="row g-3">
              {filteredTeachers.length === 0 && <p className="text-muted ps-3">ไม่พบรายชื่อครูที่ค้นหา</p>}
              {filteredTeachers.map(user => (
                <div key={user.id} className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-card">
                    <div className="card-body p-4 d-flex flex-column">
                      <div className="d-flex gap-3 mb-3">
                        <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'60px', height:'60px', fontSize:'24px'}}>👩‍🏫</div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-1 text-truncate text-dark">{user.full_name}</h6>
                          <p className="mb-0 text-muted small">{user.student_code}</p>
                          <span className="badge bg-light text-secondary border mt-1 text-truncate" style={{maxWidth: '100%'}}>{user.department}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-auto pt-3 border-top">
                         <button onClick={() => openEditModal(user)} className="btn btn-light text-primary flex-grow-1 rounded-pill fw-bold py-2">✏️ แก้ไข</button>
                         <button onClick={() => handleResetPassword(user.id, user.full_name)} className="btn btn-warning text-dark rounded-pill px-3 fw-bold shadow-sm" title="รีเซ็ตรหัสผ่าน">🔑</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm">🗑️</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-danger btn-sm w-100 rounded-pill fw-bold mt-2 py-2">⬇️ เปลี่ยนเป็นนักเรียน</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: 📚 จัดการรายวิชาทั้งหมด */}
        {activeTab === 'courses' && (
          <div className="fade-in">
             <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 px-2 gap-3">
                <h5 className="fw-bold m-0 text-dark d-flex align-items-center gap-2">
                  รายวิชาในระบบ <span className="badge bg-primary rounded-pill fs-6 px-3">{filteredCourses.length} วิชา</span>
                </h5>
                <input 
                  type="text" 
                  className="form-control border-0 bg-white shadow-sm rounded-pill px-4" 
                  placeholder="🔍 ค้นหาวิชา, รหัส, ครู, หรือกลุ่มเรียน..." 
                  style={{ maxWidth: '350px' }}
                  value={searchCourse}
                  onChange={(e) => setSearchCourse(e.target.value)}
                />
             </div>
             <div className="row g-3">
                {filteredCourses.length === 0 && <p className="text-muted ps-3">ไม่พบรายวิชาที่ค้นหา</p>}
                {filteredCourses.map(c => (
                   <div key={c.id} className="col-md-6 col-lg-4">
                      <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-card">
                         <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                               <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2">{c.course_code}</span>
                               <button onClick={() => handleDeleteCourseAdmin(c.id, c.course_name)} className="btn btn-light text-danger rounded-circle p-1"><span style={{fontSize:'12px'}}>🗑️</span></button>
                            </div>
                            <h5 className="fw-bold mb-1 text-dark text-truncate" title={c.course_name}>{c.course_name}</h5>
                            <p className="text-muted small fw-bold mb-2 text-truncate">👨‍🏫 ผู้สอน: <span className="text-primary">{c.profiles?.full_name}</span></p>
                            <span className="badge bg-light text-dark border w-100 text-start py-2 text-truncate">กลุ่ม: {c.section} | ภาคเรียน: {c.semester}</span>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* TAB: 📢 ประกาศข่าวสาร */}
        {activeTab === 'announcements' && (
          <div className="fade-in row g-4">
             <div className="col-lg-5">
                <div className="card border-0 shadow-sm rounded-4 bg-white">
                   <div className="card-body p-4">
                      <h5 className="fw-bold text-dark mb-4">สร้างประกาศใหม่</h5>
                      <form onSubmit={handleCreateAnnouncement} className="d-flex flex-column gap-3">
                         <input type="text" className="form-control bg-light border-0 rounded-3 p-3 fw-bold" placeholder="หัวข้อประกาศ" value={annForm.title} onChange={e => setAnnForm({...annForm, title: e.target.value})} required />
                         <textarea className="form-control bg-light border-0 rounded-3 p-3" placeholder="รายละเอียด..." rows="4" value={annForm.content} onChange={e => setAnnForm({...annForm, content: e.target.value})} required></textarea>
                         <button type="submit" className="btn btn-primary rounded-pill py-3 fw-bold shadow-sm">ส่งประกาศ</button>
                      </form>
                   </div>
                </div>
             </div>
             <div className="col-lg-7">
                <h5 className="fw-bold text-dark mb-4">ประกาศที่ใช้งานอยู่</h5>
                <div className="d-flex flex-column gap-3">
                   {announcements.length === 0 && <p className="text-muted">ยังไม่มีประกาศ</p>}
                   {announcements.map(ann => (
                      <div key={ann.id} className="bg-white p-4 rounded-4 shadow-sm border-start border-4 border-warning d-flex justify-content-between align-items-start hover-card">
                         <div>
                            <h5 className="fw-bold text-dark mb-1">{ann.title}</h5>
                            <p className="text-muted small mb-0 bg-light p-2 rounded-3 mt-2">{ann.content}</p>
                         </div>
                         <button onClick={() => handleDeleteAnnouncement(ann.id)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* TAB: ⚙️ ตั้งค่าระบบ */}
        {activeTab === 'settings' && (
          <div className="fade-in">
             <div className="card border-0 shadow-sm rounded-4 bg-white mx-auto" style={{maxWidth: '600px'}}>
                <div className="card-body p-4 p-md-5">
                   <h4 className="fw-bold text-dark mb-2 text-center">⚙️ ตั้งค่าระบบ</h4>
                   <p className="text-muted text-center mb-4">ควบคุมการทำงานหลักของระบบ LMS</p>
                   
                   <form onSubmit={handleUpdateSettings}>
                      <div className="bg-light p-4 rounded-4 mb-4">
                         <label className="form-label fw-bold text-dark mb-2">ปีการศึกษา / ภาคเรียน ปัจจุบัน</label>
                         <p className="small text-muted mb-3">เมื่อครูสร้างวิชาใหม่ ระบบจะดึงค่านี้ไปใช้โดยอัตโนมัติ</p>
                         <input type="text" className="form-control border-0 rounded-3 p-3 fw-bold fs-5 text-primary text-center" value={semForm} onChange={e => setSemForm(e.target.value)} required placeholder="เช่น 1/2569" />
                      </div>
                      <button type="submit" className="btn btn-primary w-100 rounded-pill py-3 fw-bold shadow-sm fs-6">บันทึกการตั้งค่า</button>
                   </form>
                </div>
             </div>
          </div>
        )}

      </div>
      <style>{`
        .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .transition-all { transition: all 0.3s ease; }
        .hover-bg-light:hover { background-color: #f8f9fa !important; }
        .hover-card { transition: transform 0.2s, box-shadow 0.2s; }
        .hover-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; }
        .custom-input { transition: all 0.3s; }
        .custom-input:focus { box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.15) !important; background-color: #fff !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}