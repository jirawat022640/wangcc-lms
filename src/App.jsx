import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// นำเข้าหน้าต่างๆ จากโฟลเดอร์ pages
import LoginPage from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      if (activeSession) loadUserProfile(activeSession.user)
      else setIsInitializing(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession) loadUserProfile(currentSession.user)
      else { setSession(null); setIsInitializing(false); }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (user) => {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    setSession({ user: user, role: data?.role || 'student' })
    setIsInitializing(false)
  }

  if (isInitializing) return <div className="d-flex justify-content-center align-items-center vh-100 text-secondary fs-5">⏳ กำลังโหลดระบบ...</div>

  return (
    <Router>
      <Routes>
        {/* หน้า Login: ถ้ามี session แล้วให้เช็ค role แล้วเปลี่ยนหน้าอัตโนมัติ */}
        <Route path="/" element={
          !session ? (
            <LoginPage setSession={setSession} />
          ) : session.role === 'admin' ? (
            <Navigate to="/admin" replace />
          ) : session.role === 'teacher' ? (
            <Navigate to="/teacher" replace />
          ) : (
            <Navigate to="/student" replace />
          )
        } />

        {/* แดชบอร์ดต่างๆ: ป้องกันไม่ให้คนที่ยังไม่ล็อกอินแอบเข้าผ่าน URL */}
        <Route 
          path="/admin" 
          element={session?.role === 'admin' ? <AdminDashboard session={session} handleLogout={() => supabase.auth.signOut()} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/teacher" 
          element={session?.role === 'teacher' ? <TeacherDashboard session={session} handleLogout={() => supabase.auth.signOut()} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/student" 
          element={session ? <StudentDashboard session={session} handleLogout={() => supabase.auth.signOut()} /> : <Navigate to="/" replace />} 
        />
        
        {/* ถ้าพิมพ์ URL มั่ว ให้จับกลับมาที่หน้าแรก */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}