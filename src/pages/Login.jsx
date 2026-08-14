import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function LoginPage({ setSession }) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const email = `${studentId}@wnytc.ac.th`
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      alert('เข้าสู่ระบบไม่สำเร็จ: รหัสผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
    let role = 'student'

    if (!profile) {
      const { error: insertError } = await supabase.from('profiles').insert([{ id: authData.user.id, role: 'student', student_code: studentId }])
      if (insertError) alert('เกิดข้อผิดพลาดในการสร้างโปรไฟล์อัตโนมัติ')
    } else {
      role = profile.role
    }
    
    setSession({ user: authData.user, role })
    
    if (role === 'admin') navigate('/admin')
    else if (role === 'teacher') navigate('/teacher')
    else navigate('/student')
    
    setLoading(false)
  }

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-sm p-4" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-4">
          <h2 className="text-primary fw-bold mb-1">ระบบ LMS</h2>
          <p className="text-muted mb-0">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label fw-bold">รหัสผู้ใช้งาน</label>
            <input type="text" className="form-control" placeholder="เช่น 6620001" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="form-label fw-bold">รหัสผ่าน</label>
            <input type="password" className="form-control" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary w-100 py-2 fw-bold" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}