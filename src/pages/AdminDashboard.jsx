import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2' 
import * as XLSX from 'xlsx' 

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

  const [departments, setDepartments] = useState([])
  const [deptForm, setDeptForm] = useState({ name: '' })

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

  const handleDeleteCourseAdmin = async (courseId, courseName) => {
    const result = await Swal.fire({
      title: 'คำเตือน: ยืนยันการลบวิชา?',
      text: `ต้องการลบวิชา "${courseName}" จริงหรือไม่? ข้อมูลการส่งงานของนักเรียนในวิชานี้จะหายไปด้วย`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e50914',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    })

    if (!result.isConfirmed) return

    await supabase.from('courses').delete().eq('id', courseId)
    fetchAllData()
    fetchAnalytics()
    Swal.fire('ลบสำเร็จ!', 'ลบรายวิชาออกจากระบบเรียบร้อยแล้ว', 'success')
  }

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
      confirmButtonColor: '#e50914',
      cancelButtonColor: '#6c757d',
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
    const roleText = newRole === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'
    
    const result = await Swal.fire({
      title: `เปลี่ยนสิทธิ์เป็น ${roleText}?`,
      text: `ต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้เป็น ${roleText} หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#121212',
      cancelButtonColor: '#e50914',
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
      confirmButtonColor: '#e50914',
      cancelButtonColor: '#6c757d',
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const result = await Swal.fire({
      title: 'นำเข้าข้อมูล?',
      text: `ยืนยันการนำเข้าข้อมูลนักเรียนจากไฟล์ ${file.name} (ระบบจะดึงข้อมูลจากทุกชีตโดยอัตโนมัติ)`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'นำเข้าเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#E50914'
    })

    if (!result.isConfirmed) {
      e.target.value = null
      return
    }

    setIsUploading(true)
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let insertData = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_json(worksheet);
          
          sheetData.forEach(row => {
             const code = row['รหัสประจำตัว'] || row['student_code'];
             const name = row['ชื่อ-นามสกุล'] || row['full_name'];
             const dept = row['แผนกวิชา'] || row['department'];
             const level = row['ระดับชั้น'] || row['grade_level'];

             if (code && name) {
               insertData.push({
                 student_code: String(code).trim().replace(/"/g, ''),
                 full_name: String(name).trim().replace(/"/g, ''),
                 department: dept ? String(dept).trim().replace(/"/g, '') : '',
                 grade_level: level ? String(level).trim().replace(/"/g, '') : ''
               });
             }
          });
        });

        if (insertData.length === 0) { 
          Swal.fire('เกิดข้อผิดพลาด', 'ไม่พบข้อมูลในไฟล์ หรือตั้งชื่อหัวคอลัมน์ไม่ถูกต้อง (รหัสประจำตัว, ชื่อ-นามสกุล, แผนกวิชา, ระดับชั้น)', 'error')
          setIsUploading(false)
          e.target.value = null 
          return 
        }

        const chunkSize = 200; 
        let successCount = 0
        for (let i = 0; i < insertData.length; i += chunkSize) {
          const chunk = insertData.slice(i, i + chunkSize)
          await supabase.from('student_master').upsert(chunk, { onConflict: 'student_code' })
          successCount += chunk.length
        }
        
        Swal.fire('เสร็จสิ้น!', `อ่านข้อมูลทั้งหมด ${workbook.SheetNames.length} ชีต\nนำเข้านักเรียนสำเร็จ ${successCount} คน!`, 'success')
        fetchMasterCount()
      } catch (error) { 
        Swal.fire('Error', `รูปแบบไฟล์ไม่ถูกต้อง หรือเกิดข้อผิดพลาด: ${error.message}`, 'error')
      } finally { 
        setIsUploading(false); e.target.value = null 
      }
    }
    
    reader.readAsArrayBuffer(file) 
  }

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
         title: 'บันทึกข้อมูลกลุ่มเรียนสำเร็จ!',
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
      confirmButtonColor: '#e50914',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'ลบข้อมูล'
    })

    if (!result.isConfirmed) return
    
    const { error } = await supabase.from("departments").delete().eq("id", id)
    if (error) {
       Swal.fire('ลบไม่สำเร็จ', error.message, 'error')
    } else {
       fetchClassroomData()
       Swal.fire('ลบสำเร็จ!', 'ข้อมูลกลุ่มเรียนถูกลบออกแล้ว', 'success')
    }
  }

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

  // 🌟 แปลงเมนูเป็นภาษาไทย 100%
  const menuItems = [
    { id: 'overview', icon: '📊', label: 'ภาพรวมระบบ' },
    { id: 'classrooms', icon: '🏢', label: 'จัดการห้องเรียน' },
    { id: 'students', icon: '👨‍🎓', label: 'จัดการนักเรียน' },
    { id: 'teachers', icon: '👨‍🏫', label: 'จัดการครูผู้สอน' },
    { id: 'courses', icon: '📚', label: 'รายวิชาทั้งหมด' },
    { id: 'announcements', icon: '📢', label: 'ประกาศข่าวสาร' },
    { id: 'settings', icon: '⚙️', label: 'ตั้งค่าระบบ' }
  ];

  return (
    <div className="app-layout font-app">
      
      {/* ---------------- โมดอลสำหรับแก้ไขข้อมูล ---------------- */}
      {editingUser && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050, backdropFilter: 'blur(5px)' }}>
          <div className="theme-card w-100 slide-up mx-3" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h5 className="fw-bold mb-4 border-bottom border-light pb-3 text-theme-dark">✏️ แก้ไขข้อมูล {editingUser.role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'}</h5>
            <form onSubmit={handleSaveEdit}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted px-2">ชื่อ - นามสกุล</label>
                <input type="text" className="form-control theme-input bg-white text-dark" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
              </div>
              <div className="row mb-3">
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted px-2">ชื่อเล่น</label>
                  <input type="text" className="form-control theme-input bg-white text-dark" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-muted px-2">เบอร์โทรศัพท์</label>
                  <input type="text" className="form-control theme-input bg-white text-dark" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted px-2">แผนกวิชา</label>
                <input type="text" className="form-control theme-input bg-white text-dark" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} />
              </div>
              {editingUser.role === 'student' && (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted px-2">ระดับชั้น</label>
                  <input type="text" className="form-control theme-input bg-white text-dark" value={editForm.grade_level} onChange={e => setEditForm({...editForm, grade_level: e.target.value})} />
                </div>
              )}
              <div className="mb-4">
                <label className="form-label small fw-bold text-muted px-2">ลิงก์รูปโปรไฟล์ (URL)</label>
                <input type="url" className="form-control theme-input bg-white text-dark" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} />
              </div>
              <div className="d-flex gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-light w-50 rounded-pill fw-bold py-3 text-muted">ยกเลิก</button>
                <button type="submit" className="btn btn-theme-red w-50 rounded-pill fw-bold shadow-sm py-3">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖥️ Desktop Sidebar */}
      <div className="sidebar shadow-sm">
        <div className="d-flex align-items-center gap-3 mb-5 px-2 mt-2">
          {/* 🌟 แสดงโลโก้วิทยาลัยใน Sidebar คอมพิวเตอร์ */}
          <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'50px', height:'50px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
          <h4 className="fw-bold m-0 text-theme-dark">ผู้ดูแลระบบ</h4>
        </div>
        <div className="d-flex flex-column gap-1 flex-grow-1" style={{overflowY: 'auto'}}>
          {menuItems.map(item => (
            <button key={item.id} className={`nav-link-btn ${activeTab === item.id ? "active" : ""}`} onClick={() => handleTabChange(item.id)}>
              <span className="fs-5">{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 border-top pt-3">
          <button onClick={handleLogout} className="nav-link-btn text-danger w-100"><span className="fs-5">🚪</span> ออกจากระบบ</button>
        </div>
      </div>

      {/* 📱 Mobile Menu (Offcanvas) */}
      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show d-lg-none" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0 d-lg-none" style={{ visibility: "visible", zIndex: 1045, width: "280px" }}>
            <div className="offcanvas-header p-4 bg-theme-dark text-white">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><span>🛡️</span> เมนูแอดมิน</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1" style={{ overflowY: 'auto' }}>
              {menuItems.map(item => (
                <button key={item.id} className={`nav-link-btn ${activeTab === item.id ? "active" : ""}`} onClick={() => handleTabChange(item.id)}>
                  <span className="fs-5">{item.icon}</span> {item.label}
                </button>
              ))}
              <div className="mt-auto pt-3 border-top border-light">
                <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="nav-link-btn text-danger w-100"><span className="fs-5">🚪</span> ออกจากระบบ</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 📱 Main Content Area */}
      <div className="main-content">
        
        {/* Mobile Header */}
        <div className="mobile-only d-flex justify-content-between align-items-center p-4 bg-white shadow-sm sticky-top z-3">
          <div className="d-flex align-items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-theme-dark rounded-circle p-2 fs-5 border-0">☰</button>
            <h5 className="fw-bold text-theme-dark m-0">ศูนย์ควบคุม (Admin)</h5>
          </div>
          {/* 🌟 แสดงโลโก้วิทยาลัยใน Header มือถือ */}
          <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'40px', height:'40px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
        </div>

        <div className="container-fluid p-4" style={{ maxWidth: '1200px' }}>
          
          {/* TAB 1: 📊 สถิติภาพรวม */}
          {activeTab === 'overview' && (
            <div className="fade-in">
               <div className="hero-card mb-4">
                  <div className="position-relative z-2">
                      <h3 className="fw-bold mb-2">ยินดีต้อนรับ, ผู้ดูแลระบบ 👋</h3>
                      <p className="text-white-50 mb-0">ภาคเรียนปัจจุบัน: {sysSettings.current_semester}</p>
                  </div>
               </div>
               <div className="row g-4">
                 <div className="col-6 col-md-3">
                   <div className="theme-card text-center h-100">
                     <div className="bg-theme-dark bg-opacity-10 text-theme-dark rounded-circle mx-auto mb-3 p-3 fs-3" style={{width:'60px', height:'60px'}}>👨‍🏫</div>
                     <h2 className="fw-bold text-theme-dark mb-0">{teachers.length}</h2>
                     <small className="text-muted fw-bold">ครูผู้สอน</small>
                   </div>
                 </div>
                 <div className="col-6 col-md-3">
                   <div className="theme-card text-center h-100">
                     <div className="bg-theme-red bg-opacity-10 text-theme-red rounded-circle mx-auto mb-3 p-3 fs-3" style={{width:'60px', height:'60px'}}>👨‍🎓</div>
                     <h2 className="fw-bold text-theme-dark mb-0">{students.length}</h2>
                     <small className="text-muted fw-bold">นักเรียน</small>
                   </div>
                 </div>
                 <div className="col-6 col-md-3">
                   <div className="theme-card text-center h-100">
                     <div className="bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-3 p-3 fs-3" style={{width:'60px', height:'60px'}}>📚</div>
                     <h2 className="fw-bold text-theme-dark mb-0">{stats.totalCourses}</h2>
                     <small className="text-muted fw-bold">รายวิชา</small>
                   </div>
                 </div>
                 <div className="col-6 col-md-3">
                   <div className="theme-card text-center h-100">
                     <div className="bg-warning bg-opacity-10 text-warning rounded-circle mx-auto mb-3 p-3 fs-3" style={{width:'60px', height:'60px'}}>📈</div>
                     <h2 className="fw-bold text-theme-dark mb-0">{stats.submissionRate}%</h2>
                     <small className="text-muted fw-bold">อัตราการส่งงาน</small>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {/* 🌟 TAB: 🏢 จัดการห้องเรียน */}
          {activeTab === 'classrooms' && (
            <div className="fade-in row g-4">
              <div className="col-lg-5">
                <div className="theme-card h-100">
                  <h5 className="fw-bold mb-4 text-theme-dark d-flex align-items-center gap-2"><span>➕</span> เพิ่มข้อมูลห้องเรียน</h5>
                  <p className="text-muted small mb-4 fw-bold">เพิ่มกลุ่มเรียน/แผนก เพื่อให้ครูนำไปเลือกตอนเปิดรายวิชา</p>
                  
                  <form onSubmit={handleCreateDepartment} className="d-flex flex-column gap-3">
                    <div className="form-floating">
                      {/* 🌟 บังคับใส่คลาส text-dark เพื่อให้อ่านออก 100% */}
                      <input type="text" className="form-control theme-input bg-white text-dark" id="deptName" placeholder="เช่น ช่างยนต์ ปวช.1/1" value={deptForm.name} onChange={(e) => setDeptForm({ name: e.target.value })} required />
                      <label htmlFor="deptName" className="text-muted fw-bold px-4">เช่น ช่างยนต์ ปวช.1/1</label>
                    </div>
                    <button type="submit" className="btn btn-theme-dark rounded-pill fw-bold py-3 mt-2 shadow-sm">บันทึกข้อมูล</button>
                  </form>
                </div>
              </div>
              
              <div className="col-lg-7">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-theme-dark m-0">รายการห้องเรียน ({filteredDepts.length})</h5>
                  <input 
                    type="text" 
                    className="form-control theme-input bg-white py-2 text-dark" 
                    placeholder="🔍 ค้นหาห้องเรียน..." 
                    style={{ maxWidth: '250px' }}
                    value={searchDept}
                    onChange={(e) => setSearchDept(e.target.value)}
                  />
                </div>
                <div className="theme-card p-0 overflow-hidden">
                  <div className="table-responsive" style={{ maxHeight: '500px' }}>
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th className="px-4 py-3 text-secondary">ลำดับ</th>
                          <th className="py-3 text-secondary">ชื่อกลุ่มเรียน / แผนก</th>
                          <th className="py-3 text-secondary text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDepts.length === 0 ? (
                          <tr><td colSpan="3" className="text-center py-5 text-muted fw-bold">ไม่พบข้อมูล</td></tr>
                        ) : (
                          filteredDepts.map((dept, index) => (
                            <tr key={dept.id}>
                              <td className="px-4 text-muted fw-bold">{index + 1}</td>
                              <td className="fw-bold text-theme-dark">{dept.name}</td>
                              <td className="text-center">
                                <button onClick={() => handleDeleteDepartment(dept.id, dept.name)} className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm hover-bg-gray">
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
              <div className="theme-card mb-4 p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border border-light">
                <div>
                  <h5 className="fw-bold text-theme-dark m-0 d-flex align-items-center gap-2">
                    <span className="fs-4">📥</span> นำเข้าฐานข้อมูลนักเรียน
                  </h5>
                  <p className="text-muted small mb-0 mt-1 fw-bold">
                    จำนวนรายชื่อในระบบ: <strong className="text-theme-red">{masterCount} คน</strong>
                  </p>
                </div>
                <div>
                  <input type="file" accept=".xlsx, .xls, .csv" id="excelUpload" className="d-none" onChange={handleFileUpload} disabled={isUploading} />
                  <label htmlFor="excelUpload" className="btn btn-theme-dark rounded-pill fw-bold px-5 py-3 mb-0 shadow-sm" style={{cursor: 'pointer'}}>
                    {isUploading ? '⏳ กำลังนำเข้า...' : '📄 อัปโหลดไฟล์ Excel/CSV'}
                  </label>
                </div>
              </div>
              
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 px-2 gap-3">
                <h5 className="fw-bold text-theme-dark m-0">นักเรียนในระบบ ({filteredStudents.length})</h5>
                <input 
                  type="text" 
                  className="form-control theme-input bg-white py-2 shadow-sm text-dark" 
                  placeholder="🔍 ค้นหาชื่อ, รหัส..." 
                  style={{ maxWidth: '300px' }}
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                />
              </div>

              <div className="row g-4">
                {filteredStudents.length === 0 && <p className="text-muted ps-3 fw-bold">ไม่พบข้อมูลนักเรียน</p>}
                {filteredStudents.map(user => (
                  <div key={user.id} className="col-md-6 col-xl-4">
                    <div className="theme-card h-100 hover-card border border-light d-flex flex-column">
                      <div className="d-flex gap-3 mb-3">
                        <div className="bg-theme-red bg-opacity-10 text-theme-red rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'60px', height:'60px', fontSize:'24px'}}>👨‍🎓</div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-1 text-truncate text-theme-dark">{user.full_name || 'ไม่ระบุชื่อ'}</h6>
                          <p className="mb-0 text-muted small fw-bold">รหัส: {user.student_code}</p>
                          <span className="badge bg-theme-gray text-theme-dark border mt-2 text-truncate" style={{maxWidth: '100%'}}>{user.department || 'ไม่ระบุแผนก'}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-auto pt-3 border-top border-light">
                         <button onClick={() => openEditModal(user)} className="btn btn-light text-theme-dark flex-grow-1 rounded-pill fw-bold py-2 border">✏️ แก้ไข</button>
                         <button onClick={() => handleResetPassword(user.id, user.full_name)} className="btn btn-warning text-dark rounded-pill px-3 fw-bold shadow-sm" title="รีเซ็ตรหัสผ่าน">🔑</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm border">🗑️</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-theme-dark btn-sm w-100 rounded-pill fw-bold mt-2 py-2">⬆️ อัปเกรดเป็นครู</button>
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
                <h5 className="fw-bold mb-0 text-theme-dark">ครูผู้สอน ({filteredTeachers.length})</h5>
                <div className="d-flex gap-2">
                  <input 
                    type="text" 
                    className="form-control theme-input bg-white py-2 shadow-sm text-dark" 
                    placeholder="🔍 ค้นหาครูผู้สอน..." 
                    style={{ maxWidth: '200px' }}
                    value={searchTeacher}
                    onChange={(e) => setSearchTeacher(e.target.value)}
                  />
                  <button onClick={() => setShowAddTeacher(!showAddTeacher)} className={`btn fw-bold rounded-pill shadow-sm px-4 py-2 flex-shrink-0 ${showAddTeacher ? 'btn-light border text-theme-dark' : 'btn-theme-red'}`}>
                    {showAddTeacher ? '✖ ปิดฟอร์ม' : '➕ เพิ่มบัญชีครู'}
                  </button>
                </div>
              </div>
              
              {showAddTeacher && (
                <div className="theme-card mb-5 border border-theme-red">
                    <h5 className="fw-bold text-theme-dark mb-4">สร้างบัญชีครูผู้สอน</h5>
                    <form onSubmit={handleCreateTeacher} className="row g-3">
                        <div className="col-md-6">
                          <input type="text" className="form-control theme-input bg-white text-dark" placeholder="รหัสบุคลากร" value={addTeacherForm.teacherId} onChange={(e) => setAddTeacherForm({...addTeacherForm, teacherId: e.target.value})} required />
                        </div>
                        <div className="col-md-6">
                          <input type="text" className="form-control theme-input bg-white text-dark" placeholder="ชื่อ-นามสกุล" value={addTeacherForm.teacherName} onChange={(e) => setAddTeacherForm({...addTeacherForm, teacherName: e.target.value})} required />
                        </div>
                        <div className="col-md-6">
                          <input type="text" className="form-control theme-input bg-white text-dark" placeholder="แผนกวิชา" value={addTeacherForm.department} onChange={(e) => setAddTeacherForm({...addTeacherForm, department: e.target.value})} required />
                        </div>
                        <div className="col-md-6">
                          <input type="text" className="form-control theme-input bg-white text-dark" placeholder="รหัสผ่านชั่วคราว" value={addTeacherForm.password} onChange={(e) => setAddTeacherForm({...addTeacherForm, password: e.target.value})} required />
                        </div>
                        <div className="col-12 mt-4 text-end">
                          <button type="submit" className="btn btn-theme-red rounded-pill px-5 fw-bold py-3 w-100 w-md-auto" disabled={isAdding}>
                            {isAdding ? '⏳ กำลังดำเนินการ...' : 'สร้างบัญชี'}
                          </button>
                        </div>
                    </form>
                    {addStatus.message && (
                      <div className={`mt-3 alert alert-${addStatus.type} fw-bold rounded-4`}>{addStatus.message}</div>
                    )}
                </div>
              )}

              <div className="row g-4">
                {filteredTeachers.length === 0 && <p className="text-muted ps-3 fw-bold">ไม่พบรายชื่อครูที่ค้นหา</p>}
                {filteredTeachers.map(user => (
                  <div key={user.id} className="col-md-6 col-xl-4">
                    <div className="theme-card h-100 hover-card border border-light d-flex flex-column">
                      <div className="d-flex gap-3 mb-3">
                        <div className="bg-theme-dark text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width:'60px', height:'60px', fontSize:'24px'}}>👩‍🏫</div>
                        <div className="flex-grow-1 overflow-hidden">
                          <h6 className="fw-bold mb-1 text-truncate text-theme-dark">{user.full_name}</h6>
                          <p className="mb-0 text-muted small fw-bold">รหัส: {user.student_code}</p>
                          <span className="badge bg-theme-gray text-theme-dark border mt-2 text-truncate" style={{maxWidth: '100%'}}>{user.department}</span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-auto pt-3 border-top border-light">
                         <button onClick={() => openEditModal(user)} className="btn btn-light text-theme-dark flex-grow-1 rounded-pill fw-bold py-2 border">✏️ แก้ไข</button>
                         <button onClick={() => handleResetPassword(user.id, user.full_name)} className="btn btn-warning text-dark rounded-pill px-3 fw-bold shadow-sm" title="รีเซ็ตรหัสผ่าน">🔑</button>
                         <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm border">🗑️</button>
                      </div>
                      <button onClick={() => handleChangeRole(user.id, user.role)} className="btn btn-outline-danger btn-sm w-100 rounded-pill fw-bold mt-2 py-2">⬇️ เปลี่ยนสิทธิ์เป็นนักเรียน</button>
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
                  <h5 className="fw-bold m-0 text-theme-dark d-flex align-items-center gap-2">
                    รายวิชาทั้งหมด <span className="badge bg-theme-dark rounded-pill fs-6 px-3">{filteredCourses.length} วิชา</span>
                  </h5>
                  <input 
                    type="text" 
                    className="form-control theme-input bg-white py-2 shadow-sm text-dark" 
                    placeholder="🔍 ค้นหารายวิชา, ผู้สอน..." 
                    style={{ maxWidth: '350px' }}
                    value={searchCourse}
                    onChange={(e) => setSearchCourse(e.target.value)}
                  />
               </div>
               <div className="row g-4">
                  {filteredCourses.length === 0 && <p className="text-muted ps-3 fw-bold">ไม่พบรายวิชาที่ค้นหา</p>}
                  {filteredCourses.map(c => (
                     <div key={c.id} className="col-md-6 col-lg-4">
                        <div className="theme-card h-100 hover-card border border-light">
                           <div className="d-flex justify-content-between align-items-start mb-3">
                              <span className="badge bg-theme-dark text-white rounded-pill px-3 py-2">{c.course_code}</span>
                              <button onClick={() => handleDeleteCourseAdmin(c.id, c.course_name)} className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                           </div>
                           <h5 className="fw-bold mb-2 text-theme-dark text-truncate" title={c.course_name}>{c.course_name}</h5>
                           <p className="text-muted small fw-bold mb-3 text-truncate">👨‍🏫 ผู้สอน: <span className="text-theme-dark">{c.profiles?.full_name}</span></p>
                           <span className="badge bg-theme-gray text-theme-dark border w-100 text-start py-2 px-3 text-truncate fs-6">กลุ่ม: {c.section} | ภาคเรียน: {c.semester}</span>
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
                  <div className="theme-card">
                     <h5 className="fw-bold text-theme-dark mb-4">สร้างประกาศใหม่</h5>
                     <form onSubmit={handleCreateAnnouncement} className="d-flex flex-column gap-3">
                        <input type="text" className="form-control theme-input bg-white fw-bold text-dark" placeholder="หัวข้อประกาศ" value={annForm.title} onChange={e => setAnnForm({...annForm, title: e.target.value})} required />
                        <textarea className="form-control theme-input bg-white text-dark" placeholder="รายละเอียดประกาศ..." rows="4" value={annForm.content} onChange={e => setAnnForm({...annForm, content: e.target.value})} required></textarea>
                        <button type="submit" className="btn btn-theme-red rounded-pill py-3 fw-bold shadow-sm mt-2">แจ้งประกาศ</button>
                     </form>
                  </div>
               </div>
               <div className="col-lg-7">
                  <h5 className="fw-bold text-theme-dark mb-4">ประกาศที่ใช้งานอยู่</h5>
                  <div className="d-flex flex-column gap-3">
                     {announcements.length === 0 && <p className="text-muted fw-bold">ยังไม่มีประกาศ</p>}
                     {announcements.map(ann => (
                        <div key={ann.id} className="theme-card p-4 border-start border-4 border-theme-dark d-flex justify-content-between align-items-start hover-card">
                           <div>
                              <h5 className="fw-bold text-theme-dark mb-2">{ann.title}</h5>
                              <p className="text-muted small mb-0 bg-theme-gray p-3 rounded-4 fw-bold">{ann.content}</p>
                           </div>
                           <button onClick={() => handleDeleteAnnouncement(ann.id)} className="btn btn-light text-theme-red rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ⚙️ ตั้งค่าระบบ */}
          {activeTab === 'settings' && (
            <div className="fade-in">
               <div className="theme-card mx-auto border border-light" style={{maxWidth: '600px'}}>
                  <h4 className="fw-bold text-theme-dark mb-2 text-center">⚙️ ตั้งค่าระบบ</h4>
                  <p className="text-muted text-center mb-4 fw-bold">ตั้งค่าการทำงานหลักของระบบ</p>
                  
                  <form onSubmit={handleUpdateSettings}>
                     <div className="bg-theme-gray p-4 rounded-4 mb-4 border border-light">
                        <label className="form-label fw-bold text-theme-dark mb-2">ภาคเรียน / ปีการศึกษา ปัจจุบัน</label>
                        <p className="small text-muted mb-3 fw-bold">ระบบจะนำค่านี้ไปใช้กับวิชาที่สร้างใหม่โดยอัตโนมัติ</p>
                        <input type="text" className="form-control theme-input bg-white text-center fs-5 text-dark" value={semForm} onChange={e => setSemForm(e.target.value)} required placeholder="เช่น 1/2569" />
                     </div>
                     <button type="submit" className="btn btn-theme-dark w-100 rounded-pill py-3 fw-bold shadow-sm fs-6">บันทึกการตั้งค่า</button>
                  </form>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}