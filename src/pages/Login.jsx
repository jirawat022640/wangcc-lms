import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login({ setSession }) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  
  const [identifier, setIdentifier] = useState('') 
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // สร้าง State สำหรับระบบแจ้งเตือน (แทนการใช้ alert ธรรมดา)
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAlertMsg({ type: '', text: '' }) // เคลียร์ข้อความเก่า
    
    const emailToUse = identifier.includes('@') ? identifier : `${identifier}@wnytc.ac.th`
    const sCode = identifier.includes('@') ? '' : identifier

    if (isLogin) {
      // ----------------- เข้าสู่ระบบ -----------------
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })
      if (error) {
        setAlertMsg({ type: 'danger', text: '❌ รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' })
      } else {
        setAlertMsg({ type: 'success', text: '✅ เข้าสู่ระบบสำเร็จ! กำลังพาดำเนินการ...' })
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } else {
      // ----------------- สมัครสมาชิก -----------------
      let masterData = null;
      if (sCode) {
        const { data: dbData } = await supabase.from('student_master').select('*').eq('student_code', sCode).single()
        if (dbData) masterData = dbData;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailToUse,
        password,
      })
      
      if (error) {
        setAlertMsg({ type: 'danger', text: `❌ สมัครสมาชิกไม่สำเร็จ: ${error.message}` })
      } else {
        if (data.user) {
           await supabase.from('profiles').update({
              student_code: sCode,
              full_name: masterData ? masterData.full_name : fullName,
              department: masterData ? masterData.department : '',
              grade_level: masterData ? masterData.grade_level : ''
           }).eq('id', data.user.id)
        }
        
        setAlertMsg({ 
          type: 'success', 
          text: masterData ? `🎉 ยินดีต้อนรับ ${masterData.full_name}! กำลังเข้าสู่ระบบ...` : '🎉 สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...' 
        })
        
        const { data: loginData } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
        if (loginData?.session) {
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        }
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-login">
      
      <div className="card border-0 rounded-4 overflow-hidden fade-in glass-card" style={{ maxWidth: '420px', width: '90%', zIndex: 2 }}>
        
        {/* Header Section */}
        <div className="p-5 text-center pb-4 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'url("https://www.transparenttextures.com/patterns/cubes.png")', opacity: 0.3 }}></div>
          <img 
            src="/LOGO-Wangcc.png" 
            alt="วิทยาลัยเทคนิควังน้ำเย็น" 
            className="rounded-circle shadow-lg mb-3 mx-auto d-block position-relative" 
            style={{ width: '95px', height: '95px', border: '4px solid white', objectFit: 'cover', zIndex: 5 }} 
          />
          <h3 className="fw-bold text-dark mb-1 position-relative">ระบบ LMS</h3>
          <p className="text-muted small mb-0 position-relative fw-bold">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>

        {/* Tab Switcher */}
        <div className="d-flex bg-light p-1 mx-4 rounded-pill mb-4 mt-n3 shadow-sm position-relative" style={{ zIndex: 10, transform: 'translateY(-15px)' }}>
          <button type="button" onClick={() => {setIsLogin(true); setAlertMsg({type:'',text:''})}} className={`btn rounded-pill flex-grow-1 fw-bold transition-all py-2 ${isLogin ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'}`}>เข้าสู่ระบบ</button>
          <button type="button" onClick={() => {setIsLogin(false); setAlertMsg({type:'',text:''})}} className={`btn rounded-pill flex-grow-1 fw-bold transition-all py-2 ${!isLogin ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'}`}>สมัครสมาชิก</button>
        </div>

        {/* Form Section */}
        <div className="card-body px-4 pb-5 pt-0">
          
          {/* แจ้งเตือน */}
          {alertMsg.text && (
            <div className={`alert alert-${alertMsg.type} border-0 shadow-sm rounded-4 text-center small fw-bold slide-down py-2 mb-4`} role="alert">
              {alertMsg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {!isLogin && (
              <div className="form-floating mb-1 slide-down">
                <input type="text" className="form-control rounded-4 bg-light border-0 custom-input" id="fullName" placeholder="ชื่อ - นามสกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <label htmlFor="fullName" className="text-muted">👤 ชื่อ-สกุล (เว้นว่างถ้าระบบมีชื่อแล้ว)</label>
              </div>
            )}

            <div className="form-floating mb-1">
              <input type="text" className="form-control rounded-4 bg-light border-0 custom-input" id="identifier" placeholder="รหัสประจำตัว หรือ อีเมล" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              <label htmlFor="identifier" className="text-muted">{isLogin ? '🧑‍💻 รหัสผู้ใช้งาน (เช่น 6620001)' : '🧑‍💻 รหัสประจำตัว (เพื่อใช้เข้าระบบ)'}</label>
            </div>

            <div className="form-floating mb-4">
              <input type="password" className="form-control rounded-4 bg-light border-0 custom-input" id="password" placeholder="รหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <label htmlFor="password" className="text-muted">🔒 รหัสผ่าน (เลข 13 หลัก)</label>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg rounded-pill fw-bold shadow-lg w-100 mb-2 btn-glow" style={{ padding: '14px', transition: 'all 0.3s' }}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              {loading ? 'กำลังประมวลผล...' : (isLogin ? 'เข้าสู่ระบบ' : 'ยืนยันการสมัครสมาชิก')}
            </button>
          </form>
        </div>
      </div>

      {/* Background Decorators */}
      <div className="position-absolute top-0 start-0 w-100 h-100 overflow-hidden" style={{ zIndex: 1 }}>
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <style>{`
        .bg-login { background-color: #e0f2fe; }
        .glass-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
        .custom-input { transition: all 0.3s; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.04); }
        .custom-input:focus { box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.15); background-color: #fff !important; transform: translateY(-2px); }
        .btn-glow:hover { box-shadow: 0 10px 25px -5px rgba(13, 110, 253, 0.5) !important; transform: translateY(-2px); }
        .fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        
        .blob { position: absolute; filter: blur(60px); opacity: 0.6; z-index: -1; animation: float 10s infinite ease-in-out alternate; }
        .blob-1 { top: -10%; left: -10%; width: 400px; height: 400px; background: #93c5fd; border-radius: 50%; }
        .blob-2 { bottom: -10%; right: -10%; width: 350px; height: 350px; background: #67e8f9; border-radius: 50%; animation-delay: -5s; }
        
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-15px); height: 0; margin-bottom: 0; } to { opacity: 1; transform: translateY(0); height: auto; } }
        @keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 50px) scale(1.1); } }
      `}</style>
    </div>
  )
}