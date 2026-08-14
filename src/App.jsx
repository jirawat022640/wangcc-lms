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
        <Route path="/" element={<LoginPage setSession={setSession} />} />
        <Route path="/admin" element={<AdminDashboard session={session} handleLogout={() => supabase.auth.signOut()} />} />
        <Route path="/teacher" element={<TeacherDashboard session={session} handleLogout={() => supabase.auth.signOut()} />} />
        <Route path="/student" element={<StudentDashboard session={session} handleLogout={() => supabase.auth.signOut()} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}