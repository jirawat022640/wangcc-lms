import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login({ setSession }) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  
  const [identifier, setIdentifier] = useState('') 
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    const emailToUse = identifier.includes('@') ? identifier : `${identifier}@wnytc.ac.th`
    const sCode = identifier.includes('@') ? '' : identifier

    if (isLogin) {
      // ----------------- เข้าสู่ระบบ -----------------
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })
      if (error) alert('เข้าสู่ระบบไม่สำเร็จ: รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง')
      else setSession(data.session)
    } else {
      // ----------------- สมัครสมาชิก (แบบดึงข้อมูลอัตโนมัติ) -----------------
      
      // 1. ไปค้นหาข้อมูลในตาราง student_master ด้วยรหัสนักศึกษา
      let masterData = null;
      if (sCode) {
        const { data: dbData } = await supabase
          .from('student_master')
          .select('*')
          .eq('student_code', sCode)
          .single()
        if (dbData) masterData = dbData;
      }

      // 2. ดำเนินการสมัครสมาชิก
      const { data, error } = await supabase.auth.signUp({
        email: emailToUse,
        password,
      })
      
      if (error) {
        alert('สมัครสมาชิกไม่สำเร็จ: ' + error.message)
      } else {
        if (data.user) {
           // 3. เอาข้อมูลจากตารางรายชื่อ มาใส่ประวัติผู้ใช้
           // ถ้าเจอในระบบ จะใช้ข้อมูลจาก Excel ถ้าไม่เจอจะใช้ชื่อที่พิมพ์หน้าเว็บแทน
           await supabase.from('profiles').update({
              student_code: sCode,
              full_name: masterData ? masterData.full_name : fullName,
              department: masterData ? masterData.department : '',
              grade_level: masterData ? masterData.grade_level : ''
           }).eq('id', data.user.id)
        }
        
        alert(masterData 
          ? `🎉 สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ ${masterData.full_name}` 
          : '🎉 สมัครสมาชิกสำเร็จ! ระบบกำลังพาเข้าสู่ระบบ...')
        
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password,
        })
        if (loginData?.session) setSession(loginData.session)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" 
         style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%)', padding: '20px' }}>
      
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden fade-in" style={{ maxWidth: '450px', width: '100%' }}>
        <div className="bg-white p-5 text-center pb-4">
          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 shadow-sm" 
               style={{ width: '70px', height: '70px', fontSize: '32px' }}>🎓</div>
          <h3 className="fw-bold text-primary mb-1">ระบบ LMS</h3>
          <p className="text-muted small mb-0">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>

        <div className="d-flex bg-light p-1 mx-4 rounded-pill mb-3">
          <button type="button" onClick={() => setIsLogin(true)} className={`btn rounded-pill flex-grow-1 fw-bold transition-all ${isLogin ? 'btn-primary shadow-sm' : 'btn-light text-muted border-0'}`}>เข้าสู่ระบบ</button>
          <button type="button" onClick={() => setIsLogin(false)} className={`btn rounded-pill flex-grow-1 fw-bold transition-all ${!isLogin ? 'btn-primary shadow-sm' : 'btn-light text-muted border-0'}`}>สมัครสมาชิก</button>
        </div>

        <div className="card-body p-4 pt-2 pb-5 bg-white">
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            
            {!isLogin && (
              <div className="form-floating mb-2 slide-down">
                <input type="text" className="form-control rounded-4 bg-light border-0" id="fullName" placeholder="ชื่อ - นามสกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <label htmlFor="fullName" className="text-muted">👤 ชื่อ - นามสกุล (เว้นว่างไว้ถ้าระบบมีรายชื่อแล้ว)</label>
              </div>
            )}

            <div className="form-floating mb-2">
              <input type="text" className="form-control rounded-4 bg-light border-0" id="identifier" placeholder="รหัสประจำตัว หรือ อีเมล" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              <label htmlFor="identifier" className="text-muted">{isLogin ? '🧑‍💻 รหัสผู้ใช้งาน (เช่น 6620001)' : '🧑‍💻 รหัสประจำตัว (เพื่อใช้เข้าระบบ)'}</label>
            </div>

            <div className="form-floating mb-4">
              <input type="password" className="form-control rounded-4 bg-light border-0" id="password" placeholder="รหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <label htmlFor="password" className="text-muted">🔒 รหัสผ่าน (เลข 13 หลัก)</label>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg rounded-pill fw-bold shadow-sm w-100 mb-2" style={{ padding: '14px' }}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              {loading ? 'กำลังประมวลผล...' : (isLogin ? 'เข้าสู่ระบบ' : 'ยืนยันการสมัครสมาชิก')}
            </button>
          </form>
        </div>
      </div>
      <style>{`.fade-in { animation: fadeIn 0.5s ease-out; } .slide-down { animation: slideDown 0.3s ease-out; } .transition-all { transition: all 0.3s ease; } .form-control:focus { box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.15); background-color: #fff !important; border: 1px solid #0d6efd !important; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); height: 0; margin-bottom: 0; } to { opacity: 1; transform: translateY(0); height: auto; } }`}</style>
    </div>
  )
}