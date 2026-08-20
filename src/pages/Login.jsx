import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Swal from 'sweetalert2' 

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
      
      if (error) {
        Swal.fire({
          icon: 'error',
          title: 'เข้าสู่ระบบไม่สำเร็จ',
          text: 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
          confirmButtonColor: '#E50914'
        })
      } else {
        // Auto-Sync Data
        try {
          const { data: profile } = await supabase.from('profiles').select('student_code, full_name').eq('id', data.user.id).single();
          const codeToCheck = sCode || profile?.student_code;

          if (codeToCheck) {
            const { data: masterData } = await supabase.from('student_master').select('*').eq('student_code', codeToCheck).single();
            if (masterData) {
              await supabase.from('profiles').update({
                full_name: masterData.full_name || profile?.full_name,
                department: masterData.department,
                grade_level: masterData.grade_level
              }).eq('id', data.user.id);
            }
          }
        } catch (syncError) {
          console.log("Auto-sync error:", syncError);
        }

        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ!',
          text: 'กำลังโหลดข้อมูลส่วนตัวของคุณ...',
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false
        })
        
        setTimeout(() => { window.location.reload() }, 1500)
      }
    } else {
      // ----------------- สมัครสมาชิก -----------------
      let masterData = null;
      if (sCode) {
        const { data: dbData } = await supabase.from('student_master').select('*').eq('student_code', sCode).single()
        if (dbData) masterData = dbData;
      }

      const { data, error } = await supabase.auth.signUp({ email: emailToUse, password })
      
      if (error) {
        Swal.fire({
          icon: 'error',
          title: 'สมัครสมาชิกไม่สำเร็จ',
          text: error.message,
          confirmButtonColor: '#E50914'
        })
      } else {
        if (data.user) {
           await supabase.from('profiles').upsert({
              id: data.user.id,
              student_code: sCode,
              full_name: masterData ? masterData.full_name : fullName,
              department: masterData ? masterData.department : '',
              grade_level: masterData ? masterData.grade_level : '',
              role: 'student'
           })
        }
        
        Swal.fire({
          icon: 'success',
          title: masterData ? `ยินดีต้อนรับ ${masterData.full_name}!` : 'สมัครสมาชิกสำเร็จ!',
          text: 'กำลังพาดำเนินการเข้าสู่ระบบ...',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false
        })
        
        const { data: loginData } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
        if (loginData?.session) {
          setTimeout(() => { window.location.reload() }, 2000)
        }
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center font-app" style={{ backgroundColor: '#121212' }}>
      
      <div className="card border-0 rounded-4 overflow-hidden fade-in" style={{ maxWidth: '420px', width: '90%', zIndex: 2, background: '#1c1c1e', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {/* Header โทนดำ-แดง */}
        <div className="p-5 text-center pb-4 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #121212 0%, #1c1c1e 100%)' }}>
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'url("https://www.transparenttextures.com/patterns/cubes.png")', opacity: 0.1 }}></div>
          <img 
            src="/LOGO-Wangcc.png" 
            alt="วิทยาลัยเทคนิควังน้ำเย็น" 
            className="rounded-circle shadow-lg mb-3 mx-auto d-block position-relative bg-white" 
            style={{ width: '100px', height: '100px', border: '3px solid #E50914', objectFit: 'cover', zIndex: 5 }} 
          />
          <h3 className="fw-bold text-white mb-1 position-relative">สมาร์ท LMS</h3>
          <p className="text-white-50 small mb-0 position-relative fw-bold">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>

        {/* ปุ่มสลับ Login / Register */}
        <div className="d-flex bg-dark p-1 mx-4 rounded-pill mb-4 mt-n3 shadow-sm position-relative border border-secondary border-opacity-25" style={{ zIndex: 10, transform: 'translateY(-15px)' }}>
          <button type="button" onClick={() => setIsLogin(true)} className={`btn rounded-pill flex-grow-1 fw-bold transition-all py-2 ${isLogin ? 'btn-theme-red shadow-sm' : 'btn-dark text-white-50 border-0'}`}>เข้าสู่ระบบ</button>
          <button type="button" onClick={() => setIsLogin(false)} className={`btn rounded-pill flex-grow-1 fw-bold transition-all py-2 ${!isLogin ? 'btn-theme-red shadow-sm' : 'btn-dark text-white-50 border-0'}`}>สมัครสมาชิก</button>
        </div>

        <div className="card-body px-4 pb-5 pt-0">
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {!isLogin && (
              <div className="form-floating mb-1 slide-down">
                {/* 🌟 บังคับใช้คลาส bg-white และ text-dark เพื่อให้อ่านง่าย 100% */}
                <input type="text" className="form-control rounded-4 theme-input bg-white text-dark shadow-none" id="fullName" placeholder="ชื่อ - นามสกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <label htmlFor="fullName" className="text-muted fw-bold">👤 ชื่อ-สกุล (เว้นว่างถ้าระบบมีชื่อแล้ว)</label>
              </div>
            )}

            <div className="form-floating mb-1">
              {/* 🌟 บังคับใช้คลาส bg-white และ text-dark */}
              <input type="text" className="form-control rounded-4 theme-input bg-white text-dark shadow-none" id="identifier" placeholder="รหัสประจำตัว หรือ อีเมล" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              <label htmlFor="identifier" className="text-muted fw-bold">{isLogin ? '🧑‍💻 รหัสผู้ใช้งาน (เช่น 6620001)' : '🧑‍💻 รหัสประจำตัว (ใช้เข้าระบบ)'}</label>
            </div>

            <div className="form-floating mb-4">
              {/* 🌟 บังคับใช้คลาส bg-white และ text-dark */}
              <input type="password" className="form-control rounded-4 theme-input bg-white text-dark shadow-none" id="password" placeholder="รหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <label htmlFor="password" className="text-muted fw-bold">🔒 รหัสผ่าน (เช่น เลข ปชช.)</label>
            </div>

            <button type="submit" disabled={loading} className="btn btn-theme-red btn-lg rounded-pill fw-bold shadow-lg w-100 mb-2" style={{ padding: '14px', transition: 'all 0.3s' }}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              {loading ? 'กำลังประมวลผล...' : (isLogin ? 'เข้าสู่ระบบ' : 'ยืนยันการสมัคร')}
            </button>
          </form>
        </div>
      </div>
      
    </div>
  )
}