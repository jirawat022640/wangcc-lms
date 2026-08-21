import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Swal from 'sweetalert2'; 

export default function TeacherDashboard({ session, handleLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("analytics");
  const [assignSubTab, setAssignSubTab] = useState("create");
  const [quizSubTab, setQuizSubTab] = useState("create"); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 🌟 State สำหรับระบบ Focus Mode เลือกล็อกวิชาที่จะจัดการ
  const [managedCourseId, setManagedCourseId] = useState("");

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]); 
  const [attendances, setAttendances] = useState([]); 
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]); 
  const [enrollments, setEnrollments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [courseForm, setCourseForm] = useState({ code: "", name: "", section: "", semester: "", credits: "" });
  const [moduleForm, setModuleForm] = useState({ title: "" }); 
  const [assignForm, setAssignForm] = useState({ module_id: "", title: "", description: "" });
  const [quizForm, setQuizForm] = useState({ module_id: "", title: "", time_limit: "" });
  const [questions, setQuestions] = useState([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]);
  const [editingQuiz, setEditingQuiz] = useState(null);
  
  const [gradeForm, setGradeForm] = useState({ id: "", score: "", feedback: "" }); 
  const [editingGrade, setEditingGrade] = useState(null); 
  const [gradeFilter, setGradeFilter] = useState(""); 
  const [selectedSubIds, setSelectedSubIds] = useState([]);
  const [batchScore, setBatchScore] = useState("");

  const [profileForm, setProfileForm] = useState({ full_name: '', nickname: '', phone: '', avatar_url: '', student_code: '', department: '', telegram_chat_id: '' });
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [uploadMode, setUploadMode] = useState("file");
  const [materialForm, setMaterialForm] = useState({ module_id: "", title: "", file: null, link: "" });
  const [uploading, setUploading] = useState(false);

  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attRecords, setAttRecords] = useState({});

  const [showAnnPopup, setShowAnnPopup] = useState(false);
  const [latestAnn, setLatestAnn] = useState(null);

  const getYoutubeThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  const sendTelegramNotify = async (chatId, message) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
    if (!chatId || botToken === "YOUR_BOT_TOKEN_HERE") return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });
    } catch (err) { console.error("Telegram Error", err); }
  };

  useEffect(() => {
    if (session?.role === "teacher") fetchData();
  }, [session]);

  const fetchData = async () => {
    try {
      const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (pData) {
        setProfileForm({
          full_name: pData.full_name || '', nickname: pData.nickname || '', phone: pData.phone || '',
          avatar_url: pData.avatar_url || '', student_code: pData.student_code || '', department: pData.department || '',
          telegram_chat_id: pData.telegram_chat_id || '' 
        });
      }

      const { data: annData } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false });
      if (annData) {
         setAnnouncements(annData);
         if (annData.length > 0) {
           const latest = annData[0];
           const isHidden = localStorage.getItem(`hide_ann_${latest.id}`);
           if (!isHidden) { setLatestAnn(latest); setShowAnnPopup(true); }
         }
      }

      const { data: sysData } = await supabase.from('system_settings').select('current_semester').eq('id', 1).single();
      if (sysData) setCourseForm(prev => ({ ...prev, semester: sysData.current_semester }));

      const { data: deptData } = await supabase.from('departments').select('*').order('name');
      if (deptData) setDepartments(deptData);

      const { data: cData } = await supabase.from("courses").select("*").eq("teacher_id", session.user.id).order('created_at', { ascending: false });
      const coursesList = cData || [];
      setCourses(coursesList);
      
      // Auto-select first course if none is selected
      if (coursesList.length > 0 && !managedCourseId) {
          setManagedCourseId(coursesList[0].id);
      }

      if (coursesList.length > 0) {
        const myCourseIds = coursesList.map(c => c.id);

        const { data: modData } = await supabase.from("modules").select("*").in("course_id", myCourseIds).order('created_at', { ascending: true });
        if (modData) setModules(modData);

        const { data: attData } = await supabase.from("attendances").select("*").in("course_id", myCourseIds);
        if (attData) setAttendances(attData);

        const { data: eData } = await supabase.from("enrollments").select("*, profiles(*)").in("course_id", myCourseIds);
        if (eData) setEnrollments(eData);

        const { data: aData } = await supabase.from("assignments").select("*").in("course_id", myCourseIds);
        const assignList = aData || [];
        setAssignments(assignList);
        const myAssignIds = assignList.map(a => a.id);

        if (myAssignIds.length > 0) {
          const { data: sData } = await supabase.from("submissions").select("*").in("assignment_id", myAssignIds);
          const subList = sData || [];

          const studentIds = [...new Set(subList.map(s => s.student_id).filter(Boolean))];
          let profilesList = [];
          if (studentIds.length > 0) {
            const { data: profData } = await supabase.from("profiles").select("*").in("id", studentIds);
            profilesList = profData || [];
          }

          const enrichedSubs = subList.map(sub => {
            const assign = assignList.find(a => a.id === sub.assignment_id);
            const course = coursesList.find(c => c.id === assign?.course_id);
            const student = profilesList.find(p => p.id === sub.student_id);
            return {
              ...sub, assignments: { ...assign, courses: course || {} },
              profiles: student || { student_code: "-", full_name: "ไม่ระบุชื่อ", telegram_chat_id: student?.telegram_chat_id || "" }
            };
          });
          enrichedSubs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setSubmissions(enrichedSubs);
        } else { setSubmissions([]); }

        const { data: mData } = await supabase.from("materials").select("*").in("course_id", myCourseIds);
        if (mData) setMaterials(mData.map(m => ({ ...m, courses: coursesList.find(c => c.id === m.course_id) })));

        const { data: qData } = await supabase.from("quizzes").select("*").in("course_id", myCourseIds);
        const quizList = qData || [];
        setQuizzes(quizList.map(q => ({ ...q, courses: coursesList.find(c => c.id === q.course_id) })));

        const myQuizIds = quizList.map(q => q.id);
        if (myQuizIds.length > 0) {
           const { data: qsData } = await supabase.from("quiz_submissions").select("*").in("quiz_id", myQuizIds);
           const qsList = qsData || [];
           const qsStudentIds = [...new Set(qsList.map(qs => qs.student_id).filter(Boolean))];
           let qsProfilesList = [];
           if (qsStudentIds.length > 0) {
              const { data: qsProfData } = await supabase.from("profiles").select("*").in("id", qsStudentIds);
              qsProfilesList = qsProfData || [];
           }
           const enrichedQS = qsList.map(qs => {
              const quiz = quizList.find(q => q.id === qs.quiz_id);
              const course = coursesList.find(c => c.id === quiz?.course_id);
              const student = qsProfilesList.find(p => p.id === qs.student_id);
              return { ...qs, quizzes: { ...quiz, courses: course || {} }, profiles: student || { student_code: "-", full_name: "ไม่ระบุชื่อ" } }
           });
           enrichedQS.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
           setQuizSubmissions(enrichedQS);
        } else { setQuizSubmissions([]); }
      }
    } catch (err) { console.error("Fetch Data Error:", err); }
  };

  const closeAnnPopup = () => setShowAnnPopup(false);
  const hideAnnPopupForever = () => { if (latestAnn) localStorage.setItem(`hide_ann_${latestAnn.id}`, 'true'); setShowAnnPopup(false); };
  const handleTabChange = (tab) => { setActiveTab(tab); setIsMenuOpen(false); };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleUploadAvatar = async (e) => {
    try {
      setUploadingAvatar(true); const file = e.target.files[0]; if (!file) return;
      const fileExt = file.name.split('.').pop(); const fileName = `user_${session.user.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfileForm({ ...profileForm, avatar_url: publicUrl });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 3000 });
    } catch (error) { Swal.fire('ข้อผิดพลาด', `ไม่สามารถอัปโหลดรูปได้: ${error.message}`, 'error'); } finally { setUploadingAvatar(false); }
  };

  const handleUpdateProfile = async (e) => { 
    e.preventDefault(); 
    await supabase.from("profiles").update({ full_name: profileForm.full_name, nickname: profileForm.nickname, phone: profileForm.phone, avatar_url: profileForm.avatar_url, telegram_chat_id: profileForm.telegram_chat_id }).eq("id", session.user.id); 
    fetchData(); Swal.fire('สำเร็จ!', 'บันทึกข้อมูลเรียบร้อย', 'success'); 
  };
  
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.section) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกกลุ่มเรียน/แผนก', 'warning'); return; }
    await supabase.from("courses").insert([{ course_code: courseForm.code, course_name: courseForm.name, section: courseForm.section, semester: courseForm.semester, credits: courseForm.credits, teacher_id: session.user.id }]);
    setCourseForm(prev => ({ code: "", name: "", section: "", semester: prev.semester, credits: "" })); 
    fetchData(); Swal.fire('สำเร็จ!', 'เปิดรายวิชาใหม่เรียบร้อยแล้ว', 'success');
  };
  const handleUpdateCourse = async (e) => { 
    e.preventDefault(); 
    await supabase.from("courses").update({ course_code: editingCourse.course_code, course_name: editingCourse.course_name, section: editingCourse.section, semester: editingCourse.semester, credits: editingCourse.credits }).eq("id", editingCourse.id); 
    setEditingCourse(null); fetchData(); Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลวิชาสำเร็จ', 'success'); 
  };
  const handleDeleteCourse = async (id) => { 
    const result = await Swal.fire({ title: 'คำเตือน', text: "ลบวิชานี้หรือไม่? ข้อมูลงานและเอกสารจะถูกลบไปด้วย", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ลบวิชา' });
    if (!result.isConfirmed) return; 
    if(managedCourseId === id) setManagedCourseId("");
    await supabase.from("courses").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบวิชาเรียบร้อยแล้ว', 'success');
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!managedCourseId || !moduleForm.title) return;
    await supabase.from("modules").insert([{ course_id: managedCourseId, title: moduleForm.title }]);
    setModuleForm({ title: "" }); fetchData();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'สร้างบทเรียนสำเร็จ!', showConfirmButton: false, timer: 1500 });
  };
  const handleDeleteModule = async (id) => {
    const result = await Swal.fire({ title: 'ลบบทเรียน?', text: "เอกสารและงานในบทนี้จะถูกนำออกจากหมวดหมู่ (แต่ไม่ถูกลบ)", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ลบทิ้ง' });
    if (!result.isConfirmed) return; await supabase.from("modules").delete().eq("id", id); fetchData();
  };

  const handleUploadMaterial = async (e) => { 
    e.preventDefault(); 
    if (!managedCourseId) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกวิชาที่ต้องการจัดการก่อน', 'warning'); return; }
    let finalUrl = ""; setUploading(true); 
    if (uploadMode === "file") { 
      if (!materialForm.file) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์', 'warning'); setUploading(false); return; } 
      const file = materialForm.file; const fileExt = file.name.split(".").pop(); 
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`; 
      const filePath = `${managedCourseId}/${fileName}`; 
      const { error: uploadError } = await supabase.storage.from("course_materials").upload(filePath, file); 
      if (uploadError) { Swal.fire('ข้อผิดพลาด', `อัปโหลดไม่สำเร็จ: ${uploadError.message}`, 'error'); setUploading(false); return; } 
      const { data: { publicUrl } } = supabase.storage.from("course_materials").getPublicUrl(filePath); finalUrl = publicUrl; 
    } else { 
      if (!materialForm.link) { Swal.fire('แจ้งเตือน', 'กรุณาวางลิงก์', 'warning'); setUploading(false); return; } 
      finalUrl = materialForm.link; 
    } 
    await supabase.from("materials").insert([{ course_id: managedCourseId, module_id: materialForm.module_id || null, title: materialForm.title, file_url: finalUrl }]); 
    setMaterialForm({ module_id: "", title: "", file: null, link: "" }); fetchData(); Swal.fire('สำเร็จ!', 'อัปโหลดเอกสารสำเร็จ!', 'success'); setUploading(false); 
  };
  const handleUpdateMaterial = async (e) => { 
    e.preventDefault(); await supabase.from("materials").update({ title: editingMaterial.title }).eq("id", editingMaterial.id); 
    setEditingMaterial(null); fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตชื่อเอกสารสำเร็จ', showConfirmButton: false, timer: 1500 }); 
  };
  const handleDeleteMaterial = async (id) => { 
    const result = await Swal.fire({ title: 'ยืนยันการลบ', text: "ลบเอกสารประกอบการสอนนี้หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ลบเอกสาร' });
    if (!result.isConfirmed) return; await supabase.from("materials").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบเอกสารเรียบร้อยแล้ว', 'success');
  };

  const handleCreateAssignment = async (e) => { 
    e.preventDefault(); 
    if (!managedCourseId) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกวิชาก่อนสั่งงาน', 'warning'); return; }
    await supabase.from("assignments").insert([{ course_id: managedCourseId, module_id: assignForm.module_id || null, title: assignForm.title, description: assignForm.description }]); 
    const targetCourse = courses.find(c => c.id === managedCourseId);
    const { data: enrolledStudents } = await supabase.from("enrollments").select("profiles(telegram_chat_id)").eq("course_id", managedCourseId);
    if (enrolledStudents && enrolledStudents.length > 0) {
      enrolledStudents.forEach(student => {
         const chatId = student.profiles?.telegram_chat_id;
         if (chatId) { sendTelegramNotify(chatId, `📢 แจ้งเตือนงานใหม่!\nวิชา: ${targetCourse.course_name}\nเรื่อง: ${assignForm.title}\nคำชี้แจง: ${assignForm.description}`); }
      });
    }
    setAssignForm({ module_id: "", title: "", description: "" }); fetchData(); Swal.fire('สำเร็จ!', `สั่งงานเรียบร้อยแล้ว`, 'success'); 
  };
  const handleDeleteAssignment = async (id) => { 
    const result = await Swal.fire({ title: 'ยืนยันการลบ', text: "ลบคำสั่งงานนี้หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ลบงาน' });
    if (!result.isConfirmed) return; await supabase.from("assignments").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบคำสั่งงานเรียบร้อยแล้ว', 'success');
  };

  const handleGradeSubmit = async (e, subId) => { 
    e.preventDefault(); 
    await supabase.from("submissions").update({ score: gradeForm.score, teacher_feedback: gradeForm.feedback }).eq("id", subId); 
    const targetSub = submissions.find(s => s.id === subId);
    if (targetSub && targetSub.profiles?.telegram_chat_id) {
       sendTelegramNotify(targetSub.profiles.telegram_chat_id, `✅ ตรวจงานแล้ว!\nวิชา: ${targetSub.assignments?.courses?.course_name}\nงาน: ${targetSub.assignments?.title}\nได้คะแนน: ${gradeForm.score}\nคอมเมนต์: ${gradeForm.feedback || '-'}`);
    }
    setGradeForm({ id: "", score: "", feedback: "" }); setEditingGrade(null); fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกคะแนนสำเร็จ', showConfirmButton: false, timer: 1500 }); 
  };
  const handleBatchGradeSubmit = async (e) => {
    e.preventDefault();
    if (selectedSubIds.length === 0) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกงานที่ต้องการให้คะแนน', 'warning'); return; }
    if (!batchScore) { Swal.fire('แจ้งเตือน', 'กรุณาระบุคะแนนที่ต้องการให้', 'warning'); return; }
    await supabase.from("submissions").update({ score: batchScore }).in("id", selectedSubIds);
    const count = selectedSubIds.length;
    selectedSubIds.forEach(subId => {
       const targetSub = submissions.find(s => s.id === subId);
       if (targetSub && targetSub.profiles?.telegram_chat_id) { sendTelegramNotify(targetSub.profiles.telegram_chat_id, `✅ ตรวจงานแล้ว!\nวิชา: ${targetSub.assignments?.courses?.course_name}\nงาน: ${targetSub.assignments?.title}\nได้คะแนน: ${batchScore}`); }
    });
    setSelectedSubIds([]); setBatchScore(""); fetchData(); Swal.fire('บันทึกสำเร็จ!', `ให้คะแนนแบบกลุ่มเรียบร้อย`, 'success');
  };
  const toggleSubSelection = (id) => setSelectedSubIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleSaveQuiz = async (e) => { 
    e.preventDefault(); 
    if (!managedCourseId) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกวิชา', 'warning'); return; }
    for (let i = 0; i < questions.length; i++) { 
      if (!questions[i].question) { Swal.fire('แจ้งเตือน', `กรุณากรอกโจทย์ข้อที่ ${i + 1}`, 'warning'); return; }
      if (questions[i].options.some((opt) => opt.trim() === "")) { Swal.fire('แจ้งเตือน', `กรุณากรอกตัวเลือกให้ครบในข้อที่ ${i + 1}`, 'warning'); return; }
    } 
    if (editingQuiz) {
       await supabase.from("quizzes").update({ course_id: managedCourseId, module_id: quizForm.module_id || null, title: quizForm.title, time_limit: parseInt(quizForm.time_limit) || 0, questions: questions }).eq("id", editingQuiz.id); 
       Swal.fire('สำเร็จ!', 'อัปเดตแบบทดสอบเรียบร้อยแล้ว', 'success'); 
    } else {
       await supabase.from("quizzes").insert([{ course_id: managedCourseId, module_id: quizForm.module_id || null, title: quizForm.title, time_limit: parseInt(quizForm.time_limit) || 0, questions: questions }]); 
       Swal.fire('สำเร็จ!', 'สร้างแบบทดสอบเรียบร้อยแล้ว', 'success'); 
    }
    setEditingQuiz(null); setQuizForm({ module_id: "", title: "", time_limit: "" }); setQuestions([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]); fetchData(); 
  };
  const handleEditQuizClick = (quiz) => {
    setEditingQuiz(quiz); setQuizForm({ module_id: quiz.module_id || "", title: quiz.title, time_limit: quiz.time_limit || "" });
    setQuestions(JSON.parse(JSON.stringify(quiz.questions))); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEditQuiz = () => {
    setEditingQuiz(null); setQuizForm({ module_id: "", title: "", time_limit: "" }); setQuestions([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]);
  };
  const handleDeleteQuiz = async (id) => {
    const result = await Swal.fire({ title: 'ยืนยันการลบ', text: "ลบแบบทดสอบนี้หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e50914', confirmButtonText: 'ลบทิ้ง' });
    if (!result.isConfirmed) return; await supabase.from("quizzes").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบแบบทดสอบเรียบร้อยแล้ว', 'success');
  };
  const addQuestion = () => setQuestions([...questions, { question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]);
  const updateQuestion = (index, field, value) => { const newQs = [...questions]; newQs[index][field] = value; setQuestions(newQs); };
  const updateOption = (qIndex, optIndex, value) => { const newQs = [...questions]; newQs[qIndex].options[optIndex] = value; setQuestions(newQs); };
  const handleQuestionImageUpload = async (qIndex, e) => {
    const file = e.target.files[0]; if (!file) return;
    const fileExt = file.name.split('.').pop(); const fileName = `quiz_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('quiz_images').upload(fileName, file);
    if (uploadError) { Swal.fire('ข้อผิดพลาด', `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`, 'error'); return; }
    const { data: { publicUrl } } = supabase.storage.from('quiz_images').getPublicUrl(fileName);
    const newQs = [...questions]; newQs[qIndex].imageUrl = publicUrl; setQuestions(newQs); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 1500 });
  };

  const loadAttendanceRecords = () => {
    if (!managedCourseId || !attDate) return;
    const existing = attendances.filter(a => a.course_id === managedCourseId && a.date === attDate);
    const newRecords = {}; existing.forEach(a => newRecords[a.student_id] = a.status); setAttRecords(newRecords);
  };
  useEffect(() => { loadAttendanceRecords(); }, [managedCourseId, attDate, attendances]);

  const handleSaveAttendance = async () => {
    if (!managedCourseId) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกวิชา', 'warning');
    const studentsInCourse = enrollments.filter(e => e.course_id === managedCourseId);
    if (studentsInCourse.length === 0) return Swal.fire('แจ้งเตือน', 'ไม่มีนักเรียนในวิชานี้', 'warning');
    await supabase.from("attendances").delete().eq("course_id", managedCourseId).eq("date", attDate);
    const inserts = Object.keys(attRecords).map(sId => ({ course_id: managedCourseId, student_id: sId, date: attDate, status: attRecords[sId] }));
    if (inserts.length > 0) { await supabase.from("attendances").insert(inserts); }
    fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกเช็คชื่อสำเร็จ', showConfirmButton: false, timer: 1500 });
  };

  const handleExportCSV = () => { 
    if (submissions.length === 0) { Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลส่งงาน', 'info'); return; }
    let csvContent = "\uFEFFภาคเรียน,รหัสวิชา,วิชา,หน่วยกิต,กลุ่มเรียน/แผนก,ชิ้นงาน,รหัสนักศึกษา,ชื่อ-นามสกุล,คะแนน,สถานะ\n"; 
    submissions.forEach((sub) => { 
      const course = sub.assignments?.courses || {}; const status = sub.score !== null ? "ตรวจแล้ว" : "รอดำเนินการ"; 
      csvContent += `"${course.semester || "-"}","${course.course_code || "-"}","${course.course_name || "-"}","${course.credits || "-"}","${course.section || "-"}","${sub.assignments?.title || "-"}","${sub.profiles?.student_code || "ไม่มีรหัส"}","${sub.profiles?.full_name || "ไม่ระบุชื่อ"}","${sub.score !== null ? sub.score : "รอตรวจ"}","${status}"\n`; 
    }); 
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `สรุปงาน_${new Date().toISOString().split("T")[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  const handleExportQuizCSV = () => {
    if (quizSubmissions.length === 0) { Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลสอบ', 'info'); return; }
    let csvContent = "\uFEFFภาคเรียน,รหัสวิชา,วิชา,กลุ่มเรียน/แผนก,แบบทดสอบ,รหัสนักศึกษา,ชื่อ-นามสกุล,คะแนนที่ได้,คะแนนเต็ม,หมายเหตุ\n";
    quizSubmissions.forEach((qs) => {
      const course = qs.quizzes?.courses || {}; const cheatStatus = qs.is_cheated ? "ทุจริต(สลับหน้าจอ)" : "ปกติ";
      csvContent += `"${course.semester || "-"}","${course.course_code || "-"}","${course.course_name || "-"}","${course.section || "-"}","${qs.quizzes?.title || "-"}","${qs.profiles?.student_code || "-"}","${qs.profiles?.full_name || "-"}","${qs.score}","${qs.total_score}","${cheatStatus}"\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `สรุปสอบ_${new Date().toISOString().split("T")[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getFileIcon = (url) => {
    if (!url) return '🔗'; const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.pdf')) return '📕'; if (lowerUrl.includes('.doc') || lowerUrl.includes('.docx')) return '📝';
    if (lowerUrl.includes('.xls') || lowerUrl.includes('.xlsx')) return '📊'; if (lowerUrl.includes('.ppt') || lowerUrl.includes('.pptx')) return '📽️';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.png') || lowerUrl.includes('.jpeg')) return '🖼️'; return '📎';
  };

  const gradedCount = submissions.filter((s) => s.score !== null).length;
  const ungradedCount = submissions.filter((s) => s.score === null).length;
  const filteredSubmissions = gradeFilter ? submissions.filter(s => s.assignments?.title === gradeFilter) : submissions;
  const ungradedFiltered = filteredSubmissions.filter((s) => s.score === null && s.assignments?.course_id === managedCourseId);
  const gradeFilterOptions = Array.from(new Set(submissions.filter(s => s.assignments?.course_id === managedCourseId).map(s => s.assignments?.title)));

  const selectAllFiltered = () => {
    const allIds = ungradedFiltered.map(s => s.id);
    if (selectedSubIds.length === allIds.length && allIds.length > 0) setSelectedSubIds([]);
    else setSelectedSubIds(allIds);
  };

  const getGradeSummary = () => {
    if (!managedCourseId) return [];
    const studentsInCourse = enrollments.filter(e => e.course_id === managedCourseId);
    const courseStudentIds = studentsInCourse.map(e => e.student_id);
    const allKnownProfiles = {};
    submissions.forEach(s => { if (s.profiles && s.student_id) allKnownProfiles[s.student_id] = s.profiles; });
    quizSubmissions.forEach(q => { if (q.profiles && q.student_id) allKnownProfiles[q.student_id] = q.profiles; });

    const summary = courseStudentIds.map(sId => {
      const assignScores = submissions.filter(s => s.student_id === sId && s.assignments?.course_id === managedCourseId && s.score !== null).reduce((sum, s) => sum + s.score, 0);
      const quizScores = quizSubmissions.filter(qs => qs.student_id === sId && qs.quizzes?.course_id === managedCourseId && qs.score !== null).reduce((sum, qs) => sum + qs.score, 0);
      const total = assignScores + quizScores;
      let grade = "รอประเมิน";
      if (total >= 80) grade = "4"; else if (total >= 75) grade = "3.5"; else if (total >= 70) grade = "3";
      else if (total >= 65) grade = "2.5"; else if (total >= 60) grade = "2"; else if (total >= 55) grade = "1.5";
      else if (total >= 50) grade = "1"; else if (total > 0) grade = "0";
      return { student_id: sId, profile: allKnownProfiles[sId] || { student_code: '-', full_name: 'กำลังโหลด..' }, assignScores, quizScores, total, grade };
    });
    summary.sort((a, b) => (a.profile.student_code || "").localeCompare(b.profile.student_code || "")); return summary;
  };

  if (!session || session.role !== "teacher") return <Navigate to="/" />;

  const menuItems = [
    { id: 'analytics', icon: '📊', label: 'สถิติภาพรวม' }, 
    { id: 'courses', icon: '📚', label: 'จัดการวิชาเรียน' }, 
    { id: 'modules', icon: '🗂️', label: 'จัดการบทเรียน' },
    { id: 'materials', icon: '📂', label: 'เอกสารประกอบ' }, 
    { id: 'assignments', icon: '📝', label: 'สั่งงานและตรวจ' }, 
    { id: 'quizzes', icon: '✍️', label: 'แบบทดสอบ' }, 
    { id: 'attendance', icon: '🙋‍♂️', label: 'เช็คชื่อเข้าเรียน' },
    { id: 'grades', icon: '🏆', label: 'สรุปผลการเรียน' },
    { id: 'profile', icon: '👤', label: 'บัญชีของฉัน' }
  ];

  const needsCourseSelector = ['modules', 'materials', 'assignments', 'quizzes', 'attendance', 'grades'].includes(activeTab);

  return (
    <div className="app-layout font-app">

      {showAnnPopup && latestAnn && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1060, backdropFilter: 'blur(5px)' }}>
          <div className="theme-card w-100 slide-down mx-3 p-0 overflow-hidden border-0 shadow-lg" style={{ maxWidth: '400px' }}>
            <div className="bg-theme-red text-white p-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><span>📢</span> ประกาศใหม่!</h6>
              <button onClick={closeAnnPopup} className="btn-close btn-close-white"></button>
            </div>
            <div className="p-4 bg-white text-center">
              <h6 className="fw-bold text-theme-dark mb-2">{latestAnn.title}</h6>
              <p className="text-theme-dark bg-theme-gray p-3 rounded-4 small fw-bold mb-4 border border-light text-start">{latestAnn.content}</p>
              <div className="d-flex flex-column gap-2">
                <button onClick={closeAnnPopup} className="btn btn-theme-red w-100 rounded-pill fw-bold shadow-sm py-2">รับทราบ</button>
                <button onClick={hideAnnPopupForever} className="btn btn-light text-muted w-100 rounded-pill small fw-bold py-2 border">ไม่ต้องแสดงอีก</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="sidebar shadow-sm">
        <div className="d-flex align-items-center gap-3 mb-4 px-2 mt-2">
          <img src="/LOGO-Wangcc.png" alt="Logo" className="rounded-circle shadow-sm bg-white" style={{width:'45px', height:'45px', objectFit:'cover', border:'2px solid var(--theme-red)'}} />
          <h5 className="fw-bold m-0 text-theme-dark">สมาร์ท LMS</h5>
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

      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show d-lg-none" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0 d-lg-none" style={{ visibility: "visible", zIndex: 1045, width: "260px" }}>
            <div className="offcanvas-header p-4 bg-theme-dark text-white">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2">เมนูครูผู้สอน</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1" style={{ overflowY: 'auto' }}>
              {menuItems.map(item => (
                <button key={item.id} className={`nav-link-btn ${activeTab === item.id ? "active" : ""}`} onClick={() => handleTabChange(item.id)}>
                  <span className="fs-5">{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="main-content">
        
        <div className="mobile-only d-flex justify-content-between align-items-center p-3 bg-white shadow-sm sticky-top z-3">
          <div className="d-flex align-items-center gap-2">
            <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-theme-dark rounded-3 border" style={{width:'40px', height:'40px', padding:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <span style={{fontSize: '1.2rem', lineHeight: 1}}>☰</span>
            </button>
            <h6 className="fw-bold text-theme-dark m-0 d-none d-sm-block">สมาร์ท LMS</h6>
          </div>
          <div className="d-flex align-items-center gap-2">
             <h6 className="fw-bold m-0 text-theme-dark text-truncate" style={{maxWidth: '120px', fontSize:'13px'}}>{profileForm.full_name || 'ครูผู้สอน'}</h6>
             <button onClick={handleLogout} className="btn btn-outline-danger btn-sm rounded-pill fw-bold px-3 py-1">🚪 ออก</button>
          </div>
        </div>

        <div className="container-fluid p-3 p-md-4" style={{ maxWidth: '1000px' }}>
          
          {needsCourseSelector && (
            <div className="bg-theme-dark p-3 rounded-4 mb-4 shadow-sm d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 slide-down">
               <div>
                  <h6 className="fw-bold text-white mb-1">🎯 เลือกวิชาที่ต้องการจัดการ</h6>
                  <p className="text-white-50 small mb-0">ข้อมูลด้านล่างจะแสดงเฉพาะวิชาที่คุณเลือกไว้ตรงนี้เท่านั้น</p>
               </div>
               <select className="form-select border-0 shadow-none fw-bold" style={{maxWidth: '400px', cursor:'pointer'}} value={managedCourseId} onChange={(e) => setManagedCourseId(e.target.value)}>
                 {courses.length === 0 ? <option value="">ไม่มีวิชาที่เปิดสอน</option> : courses.map(c => (
                   <option key={c.id} value={c.id}>{c.course_name} (กลุ่ม: {c.section})</option>
                 ))}
               </select>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="fade-in row g-3">
              <div className="col-12 col-xl-8">
                <div className="hero-card mb-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 p-4">
                  <div className="d-flex align-items-center gap-3" style={{zIndex:2}}>
                     <div className="bg-white rounded-circle shadow-sm overflow-hidden d-flex justify-content-center align-items-center border border-2 border-white" style={{width: '60px', height: '60px', fontSize: '25px'}}>
                        {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👩‍🏫'}
                     </div>
                     <div><h4 className="fw-bold mb-1">สวัสดี, ครู{profileForm.full_name || ""}</h4><p className="text-white-50 mb-0 small">ภาพรวมการจัดการเรียนการสอน</p></div>
                  </div>
                  <button onClick={handleExportCSV} className="btn btn-light text-theme-red btn-sm fw-bold rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-2" style={{zIndex:2}}><span>📥</span> โหลดคะแนน (CSV)</button>
                </div>

                <div className="row g-2">
                  <div className="col-6 col-md-3"><div className="theme-card text-center p-3 h-100"><div className="bg-danger bg-opacity-10 text-danger border border-danger rounded-3 mx-auto mb-2 p-2 fs-5" style={{width:'40px', height:'40px'}}>📚</div><h3 className="fw-bold text-theme-dark mb-0">{courses.length}</h3><small className="text-muted fw-bold" style={{fontSize: '11px'}}>วิชาที่สอน</small></div></div>
                  <div className="col-6 col-md-3"><div className="theme-card text-center p-3 h-100"><div className="bg-theme-dark bg-opacity-10 text-theme-dark rounded-3 mx-auto mb-2 p-2 fs-5" style={{width:'40px', height:'40px'}}>📝</div><h3 className="fw-bold text-theme-dark mb-0">{assignments.length}</h3><small className="text-muted fw-bold" style={{fontSize: '11px'}}>งานทั้งหมด</small></div></div>
                  <div className="col-6 col-md-3"><div className="theme-card text-center p-3 h-100 border border-success"><div className="bg-success bg-opacity-10 text-success border border-success rounded-3 mx-auto mb-2 p-2 fs-5" style={{width:'40px', height:'40px'}}>✅</div><h3 className="fw-bold text-success mb-0">{gradedCount}</h3><small className="text-muted fw-bold" style={{fontSize: '11px'}}>ตรวจแล้ว</small></div></div>
                  <div className="col-6 col-md-3"><div className="theme-card text-center p-3 h-100 border border-danger"><div className="bg-danger bg-opacity-10 text-danger border border-danger rounded-3 mx-auto mb-2 p-2 fs-5" style={{width:'40px', height:'40px'}}>⏳</div><h3 className="fw-bold text-danger mb-0">{ungradedCount}</h3><small className="text-danger fw-bold" style={{fontSize: '11px'}}>รอตรวจ</small></div></div>
                </div>
              </div>

              <div className="col-12 col-xl-4">
                 {ungradedCount > 0 && (
                  <div className="theme-card bg-danger bg-opacity-10 border border-danger p-3 mb-3 slide-up">
                    <div className="d-flex align-items-center gap-3 mb-2">
                      <div className="fs-2 text-danger">⚠️</div>
                      <div><h6 className="fw-bold text-danger mb-1" style={{fontSize: '14px'}}>ต้องดำเนินการ</h6><p className="mb-0 small text-danger fw-bold" style={{fontSize: '11px'}}>คุณมีงานรอตรวจ {ungradedCount} ชิ้น</p></div>
                    </div>
                    <button onClick={() => {setActiveTab('assignments'); setAssignSubTab('grade')}} className="btn btn-theme-red btn-sm w-100 rounded-pill fw-bold shadow-sm py-2">เริ่มตรวจงาน</button>
                  </div>
                 )}
              </div>
            </div>
          )}

          {activeTab === "courses" && (
            <div className="fade-in">
               <div className="theme-card mb-4 p-4 border border-light">
                    <h5 className="fw-bold mb-3 text-theme-dark">✨ เปิดรายวิชาใหม่</h5>
                    <form onSubmit={handleCreateCourse}>
                      <div className="row g-2 mb-2">
                        <div className="col-md-3"><input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="รหัสวิชา" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required /></div>
                        <div className="col-md-6"><input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="ชื่อวิชา" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required /></div>
                        <div className="col-md-3"><input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="หน่วยกิต" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} required /></div>
                        <div className="col-md-10">
                          <select className="form-select theme-input bg-white text-dark fw-bold py-2" value={courseForm.section} onChange={(e) => setCourseForm({ ...courseForm, section: e.target.value })} required>
                            <option value="">-- เลือกกลุ่มเรียน/แผนก --</option>
                            {departments.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
                          </select>
                        </div>
                        <div className="col-md-2"><input type="text" className="form-control theme-input bg-white text-muted fw-bold py-2" placeholder="ภาคเรียน" value={courseForm.semester} readOnly /></div>
                        <div className="col-md-12 mt-3"><button type="submit" className="btn btn-theme-red w-100 rounded-pill fw-bold py-2 shadow-sm">บันทึกรายวิชา</button></div>
                      </div>
                    </form>
               </div>
                  
               <div className="d-flex justify-content-between align-items-center mb-3">
                 <h6 className="fw-bold text-theme-dark m-0">วิชาที่คุณดูแล</h6><span className="badge bg-theme-dark rounded-pill px-3 py-1">{courses.length} เปิดสอน</span>
               </div>
                  
               <div className="row g-3">
                 {courses.length === 0 && <p className="text-muted col-12 fw-bold small">ยังไม่ได้สร้างรายวิชา</p>}
                 {courses.map((c) => (
                   <div key={c.id} className="col-12 col-md-6 col-xl-4">
                     <div className="theme-card p-3 h-100 hover-card border border-light">
                       {editingCourse?.id === c.id ? (
                         <form onSubmit={handleUpdateCourse} className="d-flex flex-column gap-2">
                           <input type="text" className="form-control theme-input bg-white text-dark py-1" value={editingCourse.course_code} onChange={(e) => setEditingCourse({ ...editingCourse, course_code: e.target.value })} required />
                           <input type="text" className="form-control theme-input bg-white text-dark py-1" value={editingCourse.course_name} onChange={(e) => setEditingCourse({ ...editingCourse, course_name: e.target.value })} required />
                           <div className="d-flex gap-2">
                             <input type="text" className="form-control theme-input bg-white text-dark py-1" value={editingCourse.semester} onChange={(e) => setEditingCourse({ ...editingCourse, semester: e.target.value })} required />
                             <input type="text" className="form-control theme-input bg-white text-dark py-1" value={editingCourse.credits} onChange={(e) => setEditingCourse({ ...editingCourse, credits: e.target.value })} required />
                           </div>
                           <input type="text" className="form-control theme-input bg-white text-dark py-1" value={editingCourse.section} onChange={(e) => setEditingCourse({ ...editingCourse, section: e.target.value })} required />
                           <div className="d-flex gap-2 mt-2">
                             <button type="submit" className="btn btn-theme-red btn-sm w-50 rounded-pill fw-bold">บันทึก</button>
                             <button type="button" onClick={() => setEditingCourse(null)} className="btn btn-light btn-sm w-50 rounded-pill fw-bold border">ยกเลิก</button>
                           </div>
                         </form>
                       ) : (
                         <>
                           <div className="d-flex justify-content-between align-items-start mb-2">
                             <span className="badge bg-danger bg-opacity-10 text-danger border border-danger rounded-pill px-2 py-1 small">{c.course_code}</span>
                             <div className="d-flex gap-1">
                               <button onClick={() => setEditingCourse(c)} className="btn btn-light text-warning rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>✏️</span></button>
                               <button onClick={() => handleDeleteCourse(c.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>🗑️</span></button>
                             </div>
                           </div>
                           <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize:'14px'}}>{c.course_name}</h6>
                           <p className="text-muted mb-2 fw-bold" style={{fontSize:'11px'}}>ภาคเรียน: {c.semester || "-"} | หน่วยกิต: {c.credits || "-"}</p>
                           <span className="badge bg-theme-gray text-theme-dark border px-2 py-1 w-100 text-start" style={{fontSize:'11px'}}>กลุ่ม: {c.section}</span>
                         </>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === "modules" && managedCourseId && (
            <div className="fade-in row g-3">
              <div className="col-lg-5">
                <div className="theme-card p-4 h-100">
                  <h5 className="fw-bold mb-3 text-theme-dark">🗂️ สร้างบทเรียนใหม่</h5>
                  <form onSubmit={handleCreateModule} className="d-flex flex-column gap-2">
                    <input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="ชื่อบทเรียน (เช่น บทที่ 1)" value={moduleForm.title} onChange={(e) => setModuleForm({ title: e.target.value })} required />
                    <button type="submit" className="btn btn-theme-red rounded-pill fw-bold py-2 mt-2 shadow-sm">💾 บันทึกบทเรียน</button>
                  </form>
                </div>
              </div>
              
              <div className="col-lg-7">
                <h6 className="fw-bold text-theme-dark mb-3">บทเรียนทั้งหมดในวิชานี้</h6>
                <div className="d-flex flex-column gap-3">
                  {modules.filter(m => m.course_id === managedCourseId).length === 0 ? <p className="text-muted small fw-bold">ไม่มีบทเรียน</p> : 
                    modules.filter(m => m.course_id === managedCourseId).map(m => (
                      <div key={m.id} className="theme-card p-3 d-flex justify-content-between align-items-center hover-card border-start border-4 border-theme-red" style={{borderRadius: '12px'}}>
                        <span className="fw-bold text-theme-dark" style={{fontSize:'13px'}}>{m.title}</span>
                        <button onClick={() => handleDeleteModule(m.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>🗑️</span></button>
                      </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "materials" && managedCourseId && (
            <div className="fade-in row g-3">
              <div className="col-lg-5">
                <div className="theme-card p-4 h-100">
                  <h5 className="fw-bold mb-3 text-theme-dark">เพิ่มเอกสารประกอบ</h5>
                  <div className="d-flex bg-theme-gray p-1 rounded-pill mb-3 border border-light">
                    <button type="button" onClick={() => setUploadMode("file")} className={`btn btn-sm rounded-pill flex-grow-1 fw-bold ${uploadMode === "file" ? "btn-white shadow-sm text-theme-red" : "text-muted border-0"}`}>📂 อัปโหลดไฟล์</button>
                    <button type="button" onClick={() => setUploadMode("link")} className={`btn btn-sm rounded-pill flex-grow-1 fw-bold ${uploadMode === "link" ? "btn-white shadow-sm text-theme-red" : "text-muted border-0"}`}>🔗 ลิงก์ YouTube</button>
                  </div>
                  <form onSubmit={handleUploadMaterial} className="d-flex flex-column gap-2">
                    <select className="form-select theme-input bg-white text-dark py-2" value={materialForm.module_id} onChange={(e) => setMaterialForm({ ...materialForm, module_id: e.target.value })}>
                      <option value="">-- จัดเข้าบทเรียน (ไม่บังคับ) --</option>
                      {modules.filter(m => m.course_id === managedCourseId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                    <input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="หัวข้อเอกสาร" value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} required />
                    {uploadMode === "file" ? (
                      <input type="file" className="form-control theme-input bg-white text-dark py-1" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.png" onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] })} required />
                    ) : (
                      <input type="url" className="form-control theme-input bg-white text-dark py-2" placeholder="https://..." value={materialForm.link} onChange={(e) => setMaterialForm({ ...materialForm, link: e.target.value })} required />
                    )}
                    <button type="submit" className="btn btn-theme-red rounded-pill fw-bold py-2 mt-2 shadow-sm" disabled={uploading}>
                      {uploading ? "⏳ กำลังอัปโหลด..." : "💾 บันทึกเอกสาร"}
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="col-lg-7">
                <h6 className="fw-bold text-theme-dark mb-3">เอกสารในวิชานี้</h6>
                <div className="row g-2">
                  {materials.filter(m => m.course_id === managedCourseId).length === 0 ? <p className="text-muted col-12 fw-bold small">ยังไม่มีเอกสาร</p> : 
                    materials.filter(m => m.course_id === managedCourseId).map((m) => {
                    const ytThumb = getYoutubeThumbnail(m.file_url);
                    const moduleName = modules.find(mod => mod.id === m.module_id)?.title; 
                    return (
                      <div key={m.id} className="col-12 col-md-6">
                        <div className="theme-card p-3 d-flex flex-column h-100 hover-card border border-light">
                          <div className="d-flex align-items-start gap-2 mb-2">
                            <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none d-flex align-items-center justify-content-center" style={{ flexShrink: 0 }}>
                              {ytThumb ? (
                                 <div className="rounded-2 overflow-hidden shadow-sm" style={{ width: '60px', height: '45px', flexShrink: 0 }}><img src={ytThumb} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                              ) : (
                                 <div className="bg-danger bg-opacity-10 text-danger border border-danger rounded-2 d-flex align-items-center justify-content-center fs-5 p-2" style={{ width: '60px', height: '45px' }}>{getFileIcon(m.file_url)}</div>
                              )}
                            </a>
                            <div className="flex-grow-1 overflow-hidden">
                              {editingMaterial?.id === m.id ? (
                                <form onSubmit={handleUpdateMaterial} className="d-flex gap-1">
                                  <input type="text" className="form-control theme-input bg-white text-dark p-1" style={{fontSize:'12px'}} value={editingMaterial.title} onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })} required />
                                  <button type="submit" className="btn btn-theme-red btn-sm rounded-2 px-2">✔</button>
                                </form>
                              ) : (
                                <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                                  <h6 className="fw-bold mb-1 text-theme-dark text-truncate" style={{fontSize:'13px'}}>{m.title}</h6>
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="mt-auto d-flex justify-content-between align-items-end pt-2 border-top border-light">
                            <span className="badge bg-theme-gray text-theme-dark px-2 py-1 border" style={{fontSize:'10px'}}>{moduleName || "ไม่ระบุบทเรียน"}</span>
                            {!editingMaterial && (
                              <div className="d-flex gap-1">
                                <button onClick={() => setEditingMaterial(m)} className="btn btn-light text-warning rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>✏️</span></button>
                                <button onClick={() => handleDeleteMaterial(m.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>🗑️</span></button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "assignments" && managedCourseId && (
            <div className="fade-in">
              <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 mx-auto border border-light" style={{ maxWidth: "400px" }}>
                <button className={`btn btn-sm rounded-pill flex-grow-1 fw-bold py-2 ${assignSubTab === "create" ? "btn-theme-dark shadow-sm" : "btn-white text-muted border-0"}`} onClick={() => setAssignSubTab("create")}>➕ สั่งงานใหม่</button>
                <button className={`btn btn-sm rounded-pill flex-grow-1 fw-bold py-2 position-relative ${assignSubTab === "grade" ? "btn-theme-dark shadow-sm" : "btn-white text-muted border-0"}`} onClick={() => setAssignSubTab("grade")}>
                  ✔️ ตรวจงานในวิชานี้ {ungradedCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{fontSize:'10px'}}>{ungradedCount}</span>}
                </button>
              </div>
              
              {assignSubTab === "create" && (
                <div className="row g-3">
                  <div className="col-lg-5">
                    <div className="theme-card p-4 h-100">
                      <h5 className="fw-bold mb-3 text-theme-dark">สร้างคำสั่งงาน</h5>
                      <form onSubmit={handleCreateAssignment} className="d-flex flex-column gap-2">
                        <select className="form-select theme-input bg-white text-dark py-2" value={assignForm.module_id} onChange={(e) => setAssignForm({ ...assignForm, module_id: e.target.value })}>
                          <option value="">-- จัดเข้าบทเรียน (ไม่บังคับ) --</option>
                          {modules.filter(m => m.course_id === managedCourseId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                        <input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="หัวข้องาน" value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} required />
                        <textarea className="form-control theme-input bg-white text-dark py-2" placeholder="รายละเอียดและคำชี้แจง..." value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} rows="3" required />
                        <button type="submit" className="btn btn-theme-red rounded-pill fw-bold py-2 mt-2 shadow-sm">ส่งคำสั่งงาน</button>
                      </form>
                    </div>
                  </div>
                  <div className="col-lg-7">
                    <h6 className="fw-bold text-theme-dark mb-3">งานที่สั่งไปแล้วในวิชานี้</h6>
                    <div className="d-flex flex-column gap-2">
                      {assignments.filter(a => a.course_id === managedCourseId).length === 0 ? <p className="text-muted small fw-bold">ยังไม่มีการสั่งงาน</p> : 
                        assignments.filter(a => a.course_id === managedCourseId).map((a) => {
                         const moduleName = modules.find(mod => mod.id === a.module_id)?.title;
                         return (
                        <div key={a.id} className="theme-card p-0 overflow-hidden d-flex border border-light">
                          <div className="bg-theme-red" style={{ width: "6px" }}></div>
                          <div className="p-3 flex-grow-1">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              {moduleName && <span className="badge bg-theme-gray text-theme-dark border border-light px-2 py-1 rounded-pill" style={{fontSize:'10px'}}>{moduleName}</span>}
                              <button onClick={() => handleDeleteAssignment(a.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm ms-auto"><span style={{fontSize:'11px'}}>🗑️</span></button>
                            </div>
                            <h6 className="fw-bold mb-1 text-theme-dark" style={{fontSize:'14px'}}>{a.title}</h6>
                            <p className="text-muted mb-0 fw-bold" style={{fontSize:'12px'}}>{a.description}</p>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
              )}
              
              {assignSubTab === "grade" && (
                <div className="theme-card p-3 p-md-4">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
                      <h6 className="fw-bold m-0 text-theme-dark d-flex align-items-center gap-2">
                        <span>✔️</span> เลือกดูงานของนักเรียน
                      </h6>
                      <select className="form-select form-select-sm theme-input bg-white text-dark w-auto border shadow-sm py-1" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                        <option value="">ทั้งหมด ({submissions.filter(s => s.assignments?.course_id === managedCourseId).length} รายการ)</option>
                        {Array.from(new Set(submissions.filter(s => s.assignments?.course_id === managedCourseId).map(s => s.assignments?.title))).map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {filteredSubmissions.filter(s => s.assignments?.course_id === managedCourseId && (!gradeFilter || s.assignments?.title === gradeFilter)).length === 0 ? (
                      <div className="text-center text-muted py-5 fw-bold small"><span className="fs-2 d-block mb-2">📭</span>ยังไม่มีนักเรียนส่งงานนี้</div>
                    ) : (
                      <div className="row g-3">
                        {filteredSubmissions.filter(s => s.assignments?.course_id === managedCourseId && (!gradeFilter || s.assignments?.title === gradeFilter)).map((sub) => {
                          const ytThumb = getYoutubeThumbnail(sub.link_url);
                          return (
                          <div key={sub.id} className="col-12 col-xl-6">
                            <div className={`theme-card p-3 h-100 d-flex flex-column transition-all position-relative ${sub.score !== null ? 'border border-success bg-success bg-opacity-10' : 'border border-danger bg-white'}`}>
                              
                              <div className="d-flex justify-content-between align-items-start mb-2 pe-4">
                                <div>
                                  <span className="badge bg-light text-theme-dark border rounded-pill px-2 py-1" style={{fontSize:'10px'}}>{sub.profiles?.student_code || "-"}</span>
                                  <div className="fw-bold text-theme-dark mt-1" style={{fontSize:'14px'}}>{sub.profiles?.full_name || "ไม่ระบุชื่อ"}</div>
                                </div>
                                {sub.score !== null && editingGrade !== sub.id ? (
                                  <div className="text-success fw-bold bg-white px-2 py-1 rounded-pill shadow-sm border border-success d-flex align-items-center gap-1" style={{fontSize:'11px'}}>
                                    ✔ {sub.score} คะแนน
                                    <button onClick={() => { setEditingGrade(sub.id); setGradeForm({ id: sub.id, score: sub.score, feedback: sub.teacher_feedback || "" }); }} className="btn btn-sm btn-light rounded-circle p-0" style={{width:'20px', height:'20px'}}>✏️</button>
                                  </div>
                                ) : sub.score === null && editingGrade !== sub.id ? (
                                  <div className="text-danger fw-bold bg-danger bg-opacity-10 border border-danger px-2 py-1 rounded-pill" style={{fontSize:'11px'}}>⏳ รอตรวจ</div>
                                ) : null}
                              </div>
                              
                              <div className="bg-white border border-light rounded-3 p-2 mb-3 flex-grow-1 shadow-sm">
                                <strong className="text-theme-dark d-block mb-1 border-bottom border-light pb-1" style={{fontSize:'11px'}}>{sub.assignments?.title || "-"}</strong>
                                {sub.submitted_text && <p className="mb-2 text-theme-dark bg-theme-gray p-2 rounded-3 fw-bold" style={{fontSize:'12px'}}>"{sub.submitted_text}"</p>}
                                {sub.link_url && (
                                  <div className="mb-2">
                                    {ytThumb && <img src={ytThumb} alt="Preview" className="w-100 object-fit-cover rounded-3 mb-1 shadow-sm" style={{maxHeight:'100px'}} />}
                                    <a href={sub.link_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-dark rounded-pill px-3 fw-bold text-white py-1" style={{fontSize:'10px'}}>🔗 เปิดลิงก์ที่ส่ง</a>
                                  </div>
                                )}
                                {sub.file_url && (
                                  <div className="mb-1 mt-1"><a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-dark rounded-pill px-3 fw-bold bg-white py-1" style={{fontSize:'10px'}}>📂 โหลดไฟล์ที่แนบ</a></div>
                                )}
                              </div>

                              {(sub.score === null || editingGrade === sub.id) ? (
                                <form onSubmit={(e) => handleGradeSubmit(e, sub.id)} className="d-flex flex-column gap-2 slide-up">
                                  <textarea className="form-control theme-input bg-white text-dark py-1 px-2" placeholder="💬 คำติชม (ถ้ามี)..." value={gradeForm.id === sub.id ? gradeForm.feedback : ""} onChange={(e) => setGradeForm({ ...gradeForm, id: sub.id, feedback: e.target.value })} rows="1" style={{fontSize:'12px'}}></textarea>
                                  <div className="d-flex gap-2">
                                     <input type="number" className="form-control theme-input bg-white text-dark fw-bold flex-grow-1 py-1" placeholder="ให้คะแนน" required value={gradeForm.id === sub.id ? gradeForm.score : ""} onChange={(e) => setGradeForm({ ...gradeForm, id: sub.id, score: e.target.value })} style={{fontSize:'12px'}} />
                                     <button type="submit" className="btn btn-sm btn-theme-red rounded-pill fw-bold px-3 shadow-sm">บันทึก</button>
                                     {editingGrade === sub.id && <button type="button" onClick={() => setEditingGrade(null)} className="btn btn-sm btn-light rounded-pill fw-bold px-2 border">ยกเลิก</button>}
                                  </div>
                                </form>
                              ) : (
                                sub.teacher_feedback && <div className="bg-theme-gray p-2 rounded-3 mt-1 text-theme-dark fw-bold border" style={{fontSize:'11px'}}>💬 ครูตอบกลับ: {sub.teacher_feedback}</div>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {activeTab === "quizzes" && managedCourseId && (
            <div className="fade-in">
               <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 mx-auto border border-light" style={{ maxWidth: "400px" }}>
                <button className={`btn btn-sm rounded-pill flex-grow-1 fw-bold py-2 ${quizSubTab === "create" ? "btn-theme-dark shadow-sm" : "btn-white text-muted border-0"}`} onClick={() => { setQuizSubTab("create"); cancelEditQuiz(); }}>➕ สร้างข้อสอบ</button>
                <button className={`btn btn-sm rounded-pill flex-grow-1 fw-bold py-2 ${quizSubTab === "scores" ? "btn-theme-dark shadow-sm" : "btn-white text-muted border-0"}`} onClick={() => setQuizSubTab("scores")}>📊 ดูคะแนนสอบ</button>
              </div>
              
              {quizSubTab === "create" && (
                <>
                  <div className="theme-card mb-4 p-4 border border-light">
                      <h5 className="fw-bold mb-3 text-theme-dark">{editingQuiz ? '✏️ แก้ไขแบบทดสอบ' : '✨ สร้างแบบทดสอบในวิชานี้'}</h5>
                      
                      <form onSubmit={handleSaveQuiz}>
                        <div className="row g-2 mb-3">
                          <div className="col-md-6">
                            <select className="form-select theme-input bg-white text-dark py-2" value={quizForm.module_id} onChange={(e) => setQuizForm({ ...quizForm, module_id: e.target.value })}>
                              <option value="">-- จัดเข้าบทเรียน (ไม่บังคับ) --</option>
                              {modules.filter(m => m.course_id === managedCourseId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                            </select>
                          </div>
                          <div className="col-md-6">
                            <input type="number" className="form-control theme-input bg-white text-dark py-2" placeholder="เวลาสอบ (นาที) 0=ไม่จำกัด" value={quizForm.time_limit} onChange={(e) => setQuizForm({ ...quizForm, time_limit: e.target.value })} required />
                          </div>
                          <div className="col-md-12">
                            <input type="text" className="form-control theme-input bg-white text-dark py-2" placeholder="หัวข้อแบบทดสอบ" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} required />
                          </div>
                        </div>
                        
                        <h6 className="fw-bold mb-2 text-theme-dark d-flex align-items-center gap-2"><span>📋</span> ชุดคำถาม</h6>
                        {questions.map((q, qIndex) => (
                          <div className="bg-theme-gray p-3 rounded-3 mb-3 position-relative border border-light slide-down" key={qIndex}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-bold text-theme-dark bg-white px-2 py-1 rounded-pill shadow-sm" style={{fontSize:'11px'}}>ข้อที่ {qIndex + 1}</span>
                              {questions.length > 1 && (<button type="button" className="btn btn-white text-danger btn-sm rounded-pill shadow-sm px-2 fw-bold py-0" onClick={() => setQuestions(questions.filter((_, i) => i !== qIndex))}>ลบ</button>)}
                            </div>
                            <input type="text" className="form-control theme-input bg-white text-dark mb-2 shadow-sm py-2" placeholder="พิมพ์โจทย์คำถาม..." value={q.question} onChange={(e) => updateQuestion(qIndex, "question", e.target.value)} required />
                            <div className="mb-3">
                              <label className="fw-bold text-muted d-block mb-1" style={{fontSize:'11px'}}>🖼️ แนบรูปภาพประกอบ (ถ้ามี)</label>
                              <div className="d-flex align-items-center gap-2">
                                <input type="file" accept="image/*" className="form-control form-control-sm bg-white text-dark rounded-2 border-0 shadow-sm p-1 w-75" onChange={(e) => handleQuestionImageUpload(qIndex, e)} />
                                {q.imageUrl && <img src={q.imageUrl} alt="preview" style={{ height: '30px', borderRadius: '4px' }} />}
                              </div>
                            </div>
                            <div className="row g-2">
                              {q.options.map((opt, optIndex) => (
                                <div key={optIndex} className="col-md-6">
                                  <div className={`d-flex align-items-center gap-2 border rounded-3 p-1 bg-white transition-all ${q.correctOption === optIndex ? "border-danger border-2 shadow-sm bg-danger bg-opacity-10" : "border-light"}`}>
                                    <input className="form-check-input mt-0 ms-2" type="radio" name={`correct-${qIndex}`} style={{ width: "16px", height: "16px", accentColor: "var(--theme-red)" }} checked={q.correctOption === optIndex} onChange={() => updateQuestion(qIndex, "correctOption", optIndex)} />
                                    <input type="text" className="form-control form-control-sm border-0 bg-transparent fw-bold text-dark" placeholder={`ตัวเลือก ${optIndex + 1}`} value={opt} onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} required />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        <div className="d-flex flex-column flex-md-row gap-2 mt-3">
                          <button type="button" className="btn btn-sm btn-light text-theme-dark border border-dark rounded-pill fw-bold py-2 px-4" onClick={addQuestion}>+ เพิ่มโจทย์ข้อต่อไป</button>
                          <button type="submit" className="btn btn-sm btn-theme-red rounded-pill fw-bold flex-grow-1 py-2 shadow-sm">
                            {editingQuiz ? '💾 บันทึกการแก้ไข' : '💾 บันทึกแบบทดสอบ'}
                          </button>
                          {editingQuiz && <button type="button" className="btn btn-sm btn-dark rounded-pill fw-bold py-2 px-3 shadow-sm" onClick={cancelEditQuiz}>ยกเลิก</button>}
                        </div>
                      </form>
                  </div>
                  
                <h6 className="fw-bold mb-3 text-theme-dark">แบบทดสอบในวิชานี้</h6>
                <div className="row g-3">
                  {quizzes.filter(q => q.course_id === managedCourseId).length === 0 && <p className="text-muted col-12 fw-bold small">ยังไม่ได้สร้างแบบทดสอบ</p>}
                  {quizzes.filter(q => q.course_id === managedCourseId).map((q) => (
                    <div key={q.id} className="col-12 col-md-6 col-lg-4">
                      <div className="theme-card p-3 h-100 d-flex flex-column border border-light">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                           <span className="badge bg-theme-dark text-white px-2 py-1 rounded-pill" style={{fontSize:'10px'}}>{q.courses?.course_name || "-"}</span>
                           <div className="d-flex gap-1">
                             <button onClick={() => handleEditQuizClick(q)} className="btn btn-light text-warning rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>✏️</span></button>
                             <button onClick={() => handleDeleteQuiz(q.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'11px'}}>🗑️</span></button>
                           </div>
                        </div>
                        <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize:'14px'}}>{q.title}</h6>
                        <div className="mt-auto d-flex justify-content-between align-items-center pt-2">
                          <span className="text-muted fw-bold" style={{fontSize:'11px'}}>จำนวน {q.questions.length} ข้อ</span>
                          {q.time_limit > 0 && <span className="badge bg-danger text-white">⏳ {q.time_limit} นาที</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}

              {quizSubTab === "scores" && (
                 <div className="theme-card slide-up border border-light p-3 p-md-4">
                     <div className="d-flex justify-content-between align-items-center mb-3">
                       <h6 className="fw-bold m-0 text-theme-dark">ผลคะแนนแบบทดสอบ (เฉพาะวิชานี้)</h6>
                     </div>
                     
                     {quizSubmissions.filter(qs => qs.quizzes?.course_id === managedCourseId).length === 0 ? (
                       <div className="text-center text-muted py-5 fw-bold small"><span className="fs-2 d-block mb-2">📭</span>ยังไม่มีข้อมูลส่งข้อสอบ</div>
                     ) : (
                       <div className="table-responsive rounded-4 border border-light">
                         <table className="table table-hover align-middle mb-0 bg-white" style={{fontSize:'13px'}}>
                           <thead className="table-light"><tr><th className="py-2 px-3 text-theme-dark">แบบทดสอบ</th><th className="py-2 text-theme-dark">รหัสนักศึกษา</th><th className="py-2 text-theme-dark">ชื่อ-สกุล</th><th className="text-center py-2 text-theme-dark">คะแนน</th></tr></thead>
                           <tbody>
                             {quizSubmissions.filter(qs => qs.quizzes?.course_id === managedCourseId).map(qs => (
                               <tr key={qs.id}>
                                 <td className="px-3 text-theme-dark fw-bold">{qs.quizzes?.title || "-"}</td>
                                 <td className="text-muted fw-bold">{qs.profiles?.student_code || "-"}</td>
                                 <td className="fw-bold text-theme-dark">{qs.profiles?.full_name || "ไม่ระบุชื่อ"}</td>
                                 <td className="text-center">
                                   <span className="badge bg-success rounded-pill px-2 py-1 shadow-sm">{qs.score} / {qs.total_score}</span>
                                   {qs.is_cheated && <span className="badge bg-danger rounded-pill px-2 py-1 ms-1 shadow-sm" title="สลับหน้าจอ">🚨 ทุจริต</span>}
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}
                 </div>
              )}
            </div>
          )}

          {activeTab === "attendance" && managedCourseId && (
            <div className="fade-in theme-card p-4">
                 <h5 className="fw-bold text-theme-dark mb-4 d-flex align-items-center gap-2"><span>🙋‍♂️</span> เช็คชื่อเข้าเรียน</h5>
                 <div className="row g-2 mb-3 bg-theme-gray p-3 rounded-4 border border-light">
                   <div className="col-12">
                      <label className="fw-bold text-theme-dark mb-1" style={{fontSize:'12px'}}>วันที่สอน</label>
                      <input type="date" className="form-control theme-input bg-white text-dark py-2" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                   </div>
                 </div>

                 <div className="slide-up">
                   <div className="d-flex justify-content-between align-items-center mb-3">
                     <h6 className="fw-bold text-theme-dark m-0">รายชื่อนักเรียนในห้อง</h6>
                     <button onClick={handleSaveAttendance} className="btn btn-sm btn-theme-red rounded-pill px-3 py-2 fw-bold shadow-sm">💾 บันทึกข้อมูล</button>
                   </div>
                   <div className="table-responsive border border-light rounded-4 bg-white">
                     <table className="table align-middle mb-0" style={{fontSize:'13px'}}>
                        <thead className="table-light"><tr><th className="px-3 py-2">รหัส</th><th className="py-2">ชื่อ-สกุล</th><th className="py-2 text-center">สถานะ</th></tr></thead>
                        <tbody>
                          {enrollments.filter(e => e.course_id === managedCourseId).map(enroll => (
                            <tr key={enroll.student_id}>
                              <td className="px-3 text-muted fw-bold">{enroll.profiles?.student_code || '-'}</td>
                              <td className="fw-bold text-theme-dark">{enroll.profiles?.full_name || '-'}</td>
                              <td className="text-center">
                                <div className="btn-group shadow-sm bg-white rounded-3 p-1 border" role="group">
                                  {["มา", "สาย", "ลา", "ขาด"].map((status, i) => {
                                    const activeColors = ["#198754", "#ffc107", "#0dcaf0", "var(--theme-red)"];
                                    const isSelected = attRecords[enroll.student_id] === status;
                                    return (
                                      <button key={status} type="button" 
                                        className="btn btn-sm rounded-3 fw-bold px-2 py-1"
                                        style={{ backgroundColor: isSelected ? activeColors[i] : 'transparent', color: isSelected ? (i===1 || i===2 ? 'black' : 'white') : '#6c757d', border: 'none', transition: '0.2s', fontSize:'12px' }}
                                        onClick={() => setAttRecords({...attRecords, [enroll.student_id]: status})}>
                                        {status}
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {enrollments.filter(e => e.course_id === managedCourseId).length === 0 && (
                            <tr><td colSpan="3" className="text-center py-4 text-muted fw-bold">ยังไม่มีนักเรียนลงทะเบียนในวิชานี้</td></tr>
                          )}
                        </tbody>
                     </table>
                   </div>
                 </div>
            </div>
          )}

          {activeTab === "grades" && managedCourseId && (
            <div className="fade-in theme-card p-4">
                <h5 className="fw-bold text-theme-dark mb-4 d-flex align-items-center gap-2"><span>🏆</span> สรุปผลการเรียนและตัดเกรด</h5>

                <div className="slide-up table-responsive border border-light rounded-4 shadow-sm bg-white">
                  <table className="table table-hover align-middle mb-0" style={{fontSize:'13px'}}>
                    <thead className="table-light">
                      <tr className="text-center">
                        <th className="px-3 py-2 text-start text-theme-dark">รหัส</th>
                        <th className="py-2 text-start text-theme-dark">ชื่อ-สกุล</th>
                        <th className="py-2 text-theme-dark">คะแนนงาน</th>
                        <th className="py-2 text-theme-dark">คะแนนสอบ</th>
                        <th className="py-2 bg-dark text-white fw-bold">รวมสุทธิ</th>
                        <th className="py-2 bg-danger text-white fw-bold">เกรดที่ได้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getGradeSummary().map(row => (
                        <tr key={row.student_id} className="text-center">
                          <td className="px-3 text-start text-muted fw-bold">{row.profile.student_code}</td>
                          <td className="fw-bold text-theme-dark text-start">{row.profile.full_name}</td>
                          <td className="text-muted fw-bold">{row.assignScores}</td>
                          <td className="text-muted fw-bold">{row.quizScores}</td>
                          <td className="fw-bold text-theme-dark bg-theme-gray">{row.total}</td>
                          <td className="bg-danger bg-opacity-10"><span className={`badge ${row.grade === '0' || row.grade === 'รอประเมิน' ? 'bg-danger' : 'bg-success'} rounded-pill px-2 py-1 shadow-sm`}>{row.grade}</span></td>
                        </tr>
                      ))}
                      {getGradeSummary().length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted fw-bold">ไม่มีข้อมูลนักเรียน</td></tr>}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="fade-in row justify-content-center">
              <div className="col-12 col-md-8 col-xl-6">
                <h5 className="fw-bold text-theme-dark mb-3">บัญชีผู้ใช้</h5>
                <div className="hero-card mb-3 text-center p-4">
                  <div className="bg-white rounded-circle border border-4 border-white shadow-lg mx-auto mb-2 d-flex justify-content-center align-items-center overflow-hidden" style={{ width: "80px", height: "80px", fontSize: "30px", zIndex: 2, position: 'relative' }}>
                     {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👩‍🏫'}
                  </div>
                  <div style={{zIndex: 2, position: 'relative'}}>
                    <h5 className="fw-bold mb-1">ครู{profileForm.full_name || ""}</h5>
                    <p className="text-white-50 mb-0 small">{session?.user?.email}</p>
                  </div>
                </div>
                
                <div className="theme-card mb-4 border border-light p-3">
                  <h6 className="fw-bold mb-3 text-theme-dark text-center">แก้ไขข้อมูลส่วนตัว</h6>
                  <form onSubmit={handleUpdateProfile}>
                    <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>ชื่อ - นามสกุล</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} required style={{fontSize: '13px'}} /></div>
                    <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>ชื่อเล่น</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.nickname} onChange={(e) => setProfileForm({...profileForm, nickname: e.target.value})} style={{fontSize: '13px'}} /></div>
                    <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>เบอร์โทรศัพท์</label><input type="text" className="form-control theme-input bg-white text-dark py-2" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} style={{fontSize: '13px'}} /></div>
                    <div className="mb-3">
                      <label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>อัปโหลดรูปโปรไฟล์</label>
                      <input type="file" accept="image/*" className="form-control theme-input bg-white text-dark py-1" onChange={handleUploadAvatar} disabled={uploadingAvatar} style={{fontSize: '12px'}} />
                      {uploadingAvatar && <small className="text-danger mt-1 ms-2 d-block fw-bold" style={{fontSize: '10px'}}>⏳ กำลังอัปโหลด...</small>}
                    </div>
                    <hr className="my-3 border-light" />
                    
                    <h6 className="fw-bold mb-2 text-theme-dark d-flex align-items-center gap-2" style={{fontSize: '13px'}}><span>✈️</span> แจ้งเตือนผ่าน Telegram</h6>
                    <div className="bg-theme-dark text-white p-3 rounded-4 mb-3 shadow-sm">
                       <p className="mb-2 text-white-50" style={{fontSize: '11px'}}>1. กดปุ่มเพื่อเปิด Telegram และรับรหัส Chat ID จาก @getmyid_bot</p>
                       <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-theme-red rounded-pill px-3 py-1 shadow-sm mb-3 fw-bold" style={{fontSize: '11px'}}>👉 เปิดเพื่อรับรหัส Chat ID</a>
                       <p className="mb-1 text-white-50" style={{fontSize: '11px'}}>2. นำตัวเลข Chat ID มาวางที่นี่</p>
                       <input type="text" className="form-control bg-white text-dark border-0 rounded-pill px-3 py-2 fw-bold" placeholder="ตัวอย่าง 123456789" value={profileForm.telegram_chat_id || ''} onChange={e => setProfileForm({...profileForm, telegram_chat_id: e.target.value})} style={{fontSize: '13px'}} />
                       {profileForm.telegram_chat_id && <small className="text-success fw-bold d-block mt-2" style={{fontSize: '10px'}}>✅ ข้อมูล Chat ID พร้อมใช้งานแล้ว</small>}
                    </div>

                    <hr className="my-3 border-light" />

                    <h6 className="fw-bold mb-2 text-theme-dark" style={{fontSize: '13px'}}>ข้อมูลระบบ (แก้ไขไม่ได้)</h6>
                    <div className="mb-2"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>รหัสบุคลากร</label><input type="text" className="form-control theme-input bg-theme-gray text-muted py-2" value={profileForm.student_code} disabled style={{fontSize: '13px'}} /></div>
                    <div className="mb-3"><label className="form-label text-muted fw-bold px-2 mb-1" style={{fontSize: '11px'}}>แผนกวิชา</label><input type="text" className="form-control theme-input bg-theme-gray text-muted py-2" value={profileForm.department} disabled style={{fontSize: '13px'}} /></div>
                    <button type="submit" className="btn btn-theme-dark w-100 rounded-pill fw-bold py-2 shadow-sm" style={{fontSize: '14px'}}>💾 บันทึกข้อมูล</button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="bottom-nav d-md-none">
        <button onClick={() => handleTabChange('analytics')} className={`bottom-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}><span className="icon">📊</span>หน้าหลัก</button>
        <button onClick={() => handleTabChange('courses')} className={`bottom-nav-item ${activeTab === 'courses' ? 'active' : ''}`}><span className="icon">📚</span>วิชาเรียน</button>
        <button onClick={() => handleTabChange('assignments')} className={`bottom-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}><span className="icon">📝</span>ตรวจงาน</button>
        <button onClick={() => handleTabChange('profile')} className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}><span className="icon">👤</span>ฉัน</button>
      </div>
    </div>
  );
}