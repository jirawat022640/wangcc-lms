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
  const [viewingCourseStudents, setViewingCourseStudents] = useState(null);

  const [courseForm, setCourseForm] = useState({ code: "", name: "", section: "", semester: "", credits: "" });
  const [moduleForm, setModuleForm] = useState({ course_id: "", title: "" }); 
  const [assignForm, setAssignForm] = useState({ course_id: "", module_id: "", title: "", description: "" });
  
  // 🌟 เพิ่ม time_limit ในฟอร์มสร้างข้อสอบ
  const [quizForm, setQuizForm] = useState({ course_id: "", module_id: "", title: "", time_limit: "" });
  
  const [questions, setQuestions] = useState([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]);
  
  const [gradeForm, setGradeForm] = useState({ id: "", score: "", feedback: "" }); 
  const [editingGrade, setEditingGrade] = useState(null); 
  
  const [profileForm, setProfileForm] = useState({ 
    full_name: '', nickname: '', phone: '', avatar_url: '', student_code: '', department: '', telegram_chat_id: '' 
  });

  const [editingCourse, setEditingCourse] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [uploadMode, setUploadMode] = useState("file");
  const [materialForm, setMaterialForm] = useState({ course_id: "", module_id: "", title: "", file: null, link: "" });
  const [uploading, setUploading] = useState(false);

  const [gradeFilter, setGradeFilter] = useState("");
  const [selectedSubIds, setSelectedSubIds] = useState([]);
  const [batchScore, setBatchScore] = useState("");

  const [attCourse, setAttCourse] = useState("");
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attRecords, setAttRecords] = useState({});

  const [gradeSummaryCourse, setGradeSummaryCourse] = useState("");

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
      if (annData) setAnnouncements(annData);

      const { data: sysData } = await supabase.from('system_settings').select('current_semester').eq('id', 1).single();
      if (sysData) setCourseForm(prev => ({ ...prev, semester: sysData.current_semester }));

      const { data: deptData } = await supabase.from('departments').select('*').order('name');
      if (deptData) setDepartments(deptData);

      const { data: cData } = await supabase.from("courses").select("*").eq("teacher_id", session.user.id).order('created_at', { ascending: false });
      const coursesList = cData || [];
      setCourses(coursesList);

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
              ...sub,
              assignments: { ...assign, courses: course || {} },
              profiles: student || { student_code: "-", full_name: "ไม่ระบุชื่อ", telegram_chat_id: student?.telegram_chat_id || "" }
            };
          });
          
          enrichedSubs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setSubmissions(enrichedSubs);
        } else {
          setSubmissions([]);
        }

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
              return {
                ...qs,
                quizzes: { ...quiz, courses: course || {} },
                profiles: student || { student_code: "-", full_name: "ไม่ระบุชื่อ" }
              }
           });
           enrichedQS.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
           setQuizSubmissions(enrichedQS);
        } else {
           setQuizSubmissions([]);
        }
      }
    } catch (err) {
      console.error("Fetch Data Error:", err);
    }
  };

  const handleTabChange = (tab) => { setActiveTab(tab); setIsMenuOpen(false); setViewingCourseStudents(null); };
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleUploadAvatar = async (e) => {
    try {
      setUploadingAvatar(true);
      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `user_${session.user.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfileForm({ ...profileForm, avatar_url: publicUrl });
      
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 3000 });
    } catch (error) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถอัปโหลดรูปได้: ${error.message}`, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => { 
    e.preventDefault(); 
    await supabase.from("profiles").update({ 
      full_name: profileForm.full_name, nickname: profileForm.nickname, phone: profileForm.phone, avatar_url: profileForm.avatar_url,
      telegram_chat_id: profileForm.telegram_chat_id 
    }).eq("id", session.user.id); 
    fetchData(); Swal.fire('สำเร็จ!', 'บันทึกข้อมูลเรียบร้อย', 'success'); 
  };
  
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.section) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกกลุ่มเรียน/แผนก', 'warning'); return; }
    await supabase.from("courses").insert([{ 
      course_code: courseForm.code, course_name: courseForm.name, section: courseForm.section, 
      semester: courseForm.semester, credits: courseForm.credits, teacher_id: session.user.id 
    }]);
    setCourseForm(prev => ({ code: "", name: "", section: "", semester: prev.semester, credits: "" })); 
    fetchData(); Swal.fire('สำเร็จ!', 'เปิดรายวิชาใหม่เรียบร้อยแล้ว', 'success');
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!moduleForm.course_id || !moduleForm.title) return;
    await supabase.from("modules").insert([{ course_id: moduleForm.course_id, title: moduleForm.title }]);
    setModuleForm({ course_id: "", title: "" });
    fetchData();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'สร้างบทเรียนสำเร็จ!', showConfirmButton: false, timer: 1500 });
  };

  const handleDeleteModule = async (id) => {
    const result = await Swal.fire({ title: 'ลบบทเรียน?', text: "เอกสารและงานในบทนี้จะถูกนำออกจากหมวดหมู่ (แต่ไม่ถูกลบ)", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้ง' });
    if (!result.isConfirmed) return;
    await supabase.from("modules").delete().eq("id", id);
    fetchData();
  };

  const handleCreateAssignment = async (e) => { 
    e.preventDefault(); 
    if (!assignForm.course_id) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายวิชา', 'warning'); return; }
    
    await supabase.from("assignments").insert([{ 
      course_id: assignForm.course_id, 
      module_id: assignForm.module_id || null, 
      title: assignForm.title, 
      description: assignForm.description 
    }]); 
    
    const targetCourse = courses.find(c => c.id === assignForm.course_id);
    const courseName = targetCourse ? targetCourse.course_name : "วิชาของคุณ";
    
    const { data: enrolledStudents } = await supabase.from("enrollments").select("profiles(telegram_chat_id)").eq("course_id", assignForm.course_id);

    let notifyCount = 0;
    if (enrolledStudents && enrolledStudents.length > 0) {
      enrolledStudents.forEach(student => {
         const chatId = student.profiles?.telegram_chat_id;
         if (chatId) {
            const msg = `📢 แจ้งเตือนงานใหม่!\nวิชา: ${courseName}\nเรื่อง: ${assignForm.title}\nคำชี้แจง: ${assignForm.description}\n\nอย่าลืมเข้าไปดูรายละเอียดและส่งงานในระบบนะครับ ✌️`;
            sendTelegramNotify(chatId, msg);
            notifyCount++;
         }
      });
    }

    setAssignForm({ course_id: "", module_id: "", title: "", description: "" }); 
    fetchData(); 
    Swal.fire('สำเร็จ!', `สั่งงานเรียบร้อย\nส่งแจ้งเตือนผ่าน Telegram ให้นักเรียน ${notifyCount} คน`, 'success'); 
  };

  const handleCloneAssignment = (e) => {
    const id = e.target.value;
    if (!id) { setAssignForm(prev => ({ ...prev, title: "", description: "" })); return; }
    const target = assignments.find(a => a.id === id);
    if (target) setAssignForm(prev => ({ ...prev, title: target.title, description: target.description, module_id: target.module_id || "" }));
  };

  const handleCreateQuiz = async (e) => { 
    e.preventDefault(); 
    if (!quizForm.course_id) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายวิชา', 'warning'); return; }
    for (let i = 0; i < questions.length; i++) { 
      if (!questions[i].question) { Swal.fire('แจ้งเตือน', `กรุณากรอกโจทย์ข้อที่ ${i + 1}`, 'warning'); return; }
      if (questions[i].options.some((opt) => opt.trim() === "")) { Swal.fire('แจ้งเตือน', `กรุณากรอกตัวเลือกให้ครบในข้อที่ ${i + 1}`, 'warning'); return; }
    } 
    
    // 🌟 บันทึกเวลาสอบ (time_limit) ลงไปด้วย
    await supabase.from("quizzes").insert([{ 
      course_id: quizForm.course_id, 
      module_id: quizForm.module_id || null, 
      title: quizForm.title, 
      time_limit: parseInt(quizForm.time_limit) || 0,
      questions: questions 
    }]); 
    
    setQuizForm({ course_id: "", module_id: "", title: "", time_limit: "" }); 
    setQuestions([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]); 
    fetchData(); Swal.fire('สำเร็จ!', 'สร้างแบบทดสอบเรียบร้อยแล้ว', 'success'); 
  };

  const handleCloneQuiz = (e) => {
    const id = e.target.value;
    if (!id) { setQuizForm(prev => ({ ...prev, title: "", time_limit: "" })); setQuestions([{ question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]); return; }
    const target = quizzes.find(q => q.id === id);
    if (target) { setQuizForm(prev => ({ ...prev, title: target.title, module_id: target.module_id || "", time_limit: target.time_limit || "" })); setQuestions(JSON.parse(JSON.stringify(target.questions))); }
  };

  const handleUploadMaterial = async (e) => { 
    e.preventDefault(); 
    if (!materialForm.course_id) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายวิชา', 'warning'); return; }
    
    let finalUrl = ""; setUploading(true); 
    
    if (uploadMode === "file") { 
      if (!materialForm.file) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์', 'warning'); setUploading(false); return; } 
      const file = materialForm.file; 
      const fileExt = file.name.split(".").pop(); 
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`; 
      const filePath = `${materialForm.course_id}/${fileName}`; 
      
      const { error: uploadError } = await supabase.storage.from("course_materials").upload(filePath, file); 
      if (uploadError) { Swal.fire('ข้อผิดพลาด', `อัปโหลดไม่สำเร็จ: ${uploadError.message}`, 'error'); setUploading(false); return; } 
      const { data: { publicUrl } } = supabase.storage.from("course_materials").getPublicUrl(filePath); 
      finalUrl = publicUrl; 
    } else { 
      if (!materialForm.link) { Swal.fire('แจ้งเตือน', 'กรุณาวางลิงก์', 'warning'); setUploading(false); return; } 
      finalUrl = materialForm.link; 
    } 
    
    await supabase.from("materials").insert([{ course_id: materialForm.course_id, module_id: materialForm.module_id || null, title: materialForm.title, file_url: finalUrl }]); 
    setMaterialForm({ course_id: "", module_id: "", title: "", file: null, link: "" }); fetchData(); Swal.fire('สำเร็จ!', 'อัปโหลดเอกสารสำเร็จ!', 'success'); setUploading(false); 
  };

  const handleGradeSubmit = async (e, subId) => { 
    e.preventDefault(); 
    await supabase.from("submissions").update({ score: gradeForm.score, teacher_feedback: gradeForm.feedback }).eq("id", subId); 
    
    const targetSub = submissions.find(s => s.id === subId);
    if (targetSub && targetSub.profiles?.telegram_chat_id) {
       const msg = `✅ ตรวจงานแล้ว!\nวิชา: ${targetSub.assignments?.courses?.course_name}\nงาน: ${targetSub.assignments?.title}\nได้คะแนน: ${gradeForm.score}\nคอมเมนต์: ${gradeForm.feedback || '-'}`;
       sendTelegramNotify(targetSub.profiles.telegram_chat_id, msg);
    }

    setGradeForm({ id: "", score: "", feedback: "" }); 
    setEditingGrade(null); 
    fetchData(); 
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกคะแนนและคำแนะนำสำเร็จ', showConfirmButton: false, timer: 1500 }); 
  };

  const handleBatchGradeSubmit = async (e) => {
    e.preventDefault();
    if (selectedSubIds.length === 0) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกงานที่ต้องการให้คะแนน', 'warning'); return; }
    if (!batchScore) { Swal.fire('แจ้งเตือน', 'กรุณาระบุคะแนนที่ต้องการให้', 'warning'); return; }
    
    await supabase.from("submissions").update({ score: batchScore }).in("id", selectedSubIds);
    const count = selectedSubIds.length;
    
    selectedSubIds.forEach(subId => {
       const targetSub = submissions.find(s => s.id === subId);
       if (targetSub && targetSub.profiles?.telegram_chat_id) {
           const msg = `✅ ตรวจงานแล้ว!\nวิชา: ${targetSub.assignments?.courses?.course_name}\nงาน: ${targetSub.assignments?.title}\nได้คะแนน: ${batchScore}`;
           sendTelegramNotify(targetSub.profiles.telegram_chat_id, msg);
       }
    });

    setSelectedSubIds([]); setBatchScore(""); fetchData();
    Swal.fire('บันทึกสำเร็จ!', `บันทึกคะแนน ${batchScore} ให้กับ ${count} รายการ สำเร็จ!`, 'success');
  };

  const toggleSubSelection = (id) => setSelectedSubIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleDeleteCourse = async (id) => { 
    const result = await Swal.fire({ title: 'คำเตือน', text: "ลบวิชานี้หรือไม่? ข้อมูลงานและเอกสารจะถูกลบไปด้วย", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบวิชา' });
    if (!result.isConfirmed) return; 
    await supabase.from("courses").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบวิชาเรียบร้อยแล้ว', 'success');
  };

  const handleDeleteMaterial = async (id) => { 
    const result = await Swal.fire({ title: 'ยืนยันการลบ', text: "ลบเอกสารประกอบการสอนนี้หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเอกสาร' });
    if (!result.isConfirmed) return; 
    await supabase.from("materials").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบเอกสารเรียบร้อยแล้ว', 'success');
  };

  const handleDeleteAssignment = async (id) => { 
    const result = await Swal.fire({ title: 'ยืนยันการลบ', text: "ลบคำสั่งงานนี้หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบงาน' });
    if (!result.isConfirmed) return; 
    await supabase.from("assignments").delete().eq("id", id); fetchData(); Swal.fire('ลบแล้ว!', 'ลบคำสั่งงานเรียบร้อยแล้ว', 'success');
  };

  const handleUpdateCourse = async (e) => { 
    e.preventDefault(); 
    await supabase.from("courses").update({ course_code: editingCourse.course_code, course_name: editingCourse.course_name, section: editingCourse.section, semester: editingCourse.semester, credits: editingCourse.credits }).eq("id", editingCourse.id); 
    setEditingCourse(null); fetchData(); Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลวิชาสำเร็จ', 'success'); 
  };

  const handleUpdateMaterial = async (e) => { 
    e.preventDefault(); 
    await supabase.from("materials").update({ title: editingMaterial.title }).eq("id", editingMaterial.id); 
    setEditingMaterial(null); fetchData(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตชื่อเอกสารสำเร็จ', showConfirmButton: false, timer: 1500 }); 
  };

  const addQuestion = () => setQuestions([...questions, { question: "", imageUrl: "", options: ["", "", "", ""], correctOption: 0 }]);
  const updateQuestion = (index, field, value) => { const newQs = [...questions]; newQs[index][field] = value; setQuestions(newQs); };
  const updateOption = (qIndex, optIndex, value) => { const newQs = [...questions]; newQs[qIndex].options[optIndex] = value; setQuestions(newQs); };

  const handleQuestionImageUpload = async (qIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `quiz_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('quiz_images').upload(fileName, file);
    if (uploadError) {
      Swal.fire('ข้อผิดพลาด', `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`, 'error');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('quiz_images').getPublicUrl(fileName);
    
    const newQs = [...questions];
    newQs[qIndex].imageUrl = publicUrl;
    setQuestions(newQs);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปโหลดรูปภาพสำเร็จ!', showConfirmButton: false, timer: 1500 });
  };

  const loadAttendanceRecords = () => {
    if (!attCourse || !attDate) return;
    const existing = attendances.filter(a => a.course_id === attCourse && a.date === attDate);
    const newRecords = {};
    existing.forEach(a => newRecords[a.student_id] = a.status);
    setAttRecords(newRecords);
  };
  
  useEffect(() => { loadAttendanceRecords(); }, [attCourse, attDate, attendances]);

  const handleSaveAttendance = async () => {
    if (!attCourse) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกวิชา', 'warning');
    const studentsInCourse = enrollments.filter(e => e.course_id === attCourse);
    if (studentsInCourse.length === 0) return Swal.fire('แจ้งเตือน', 'ไม่มีนักเรียนในวิชานี้', 'warning');

    await supabase.from("attendances").delete().eq("course_id", attCourse).eq("date", attDate);

    const inserts = Object.keys(attRecords).map(sId => ({
      course_id: attCourse, student_id: sId, date: attDate, status: attRecords[sId]
    }));

    if (inserts.length > 0) {
      await supabase.from("attendances").insert(inserts);
    }
    fetchData();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกการเช็คชื่อสำเร็จ', showConfirmButton: false, timer: 1500 });
  };

  const handleExportCSV = () => { 
    if (submissions.length === 0) { Swal.fire('แจ้งเตือน', 'ยังไม่มีข้อมูลส่งงานให้ดาวน์โหลด', 'info'); return; }
    let csvContent = "\uFEFFภาคเรียน,รหัสวิชา,วิชา,หน่วยกิต,กลุ่มเรียน/แผนก,ชิ้นงาน,รหัสนักศึกษา,ชื่อ-นามสกุล,คะแนน,สถานะ\n"; 
    submissions.forEach((sub) => { 
      const course = sub.assignments?.courses || {}; 
      const status = sub.score !== null ? "ตรวจแล้ว" : "รอดำเนินการ"; 
      csvContent += `"${course.semester || "-"}","${course.course_code || "-"}","${course.course_name || "-"}","${course.credits || "-"}","${course.section || "-"}","${sub.assignments?.title || "-"}","${sub.profiles?.student_code || "ไม่มีรหัส"}","${sub.profiles?.full_name || "ไม่ระบุชื่อ"}","${sub.score !== null ? sub.score : "รอตรวจ"}","${status}"\n`; 
    }); 
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `สรุปคะแนนงาน_${new Date().toISOString().split("T")[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };

  const handleExportQuizCSV = () => {
    if (quizSubmissions.length === 0) { Swal.fire('แจ้งเตือน', 'ยังไม่มีข้อมูลคะแนนสอบ', 'info'); return; }
    let csvContent = "\uFEFFภาคเรียน,รหัสวิชา,วิชา,กลุ่มเรียน/แผนก,แบบทดสอบ,รหัสนักศึกษา,ชื่อ-นามสกุล,คะแนนที่ได้,คะแนนเต็ม,หมายเหตุ\n";
    quizSubmissions.forEach((qs) => {
      const course = qs.quizzes?.courses || {};
      const cheatStatus = qs.is_cheated ? "ทุจริต(สลับหน้าจอ)" : "ปกติ";
      csvContent += `"${course.semester || "-"}","${course.course_code || "-"}","${course.course_name || "-"}","${course.section || "-"}","${qs.quizzes?.title || "-"}","${qs.profiles?.student_code || "-"}","${qs.profiles?.full_name || "-"}","${qs.score}","${qs.total_score}","${cheatStatus}"\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `สรุปคะแนนสอบ_${new Date().toISOString().split("T")[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getFileIcon = (url) => {
    if (!url) return '🔗';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.pdf')) return '📕';
    if (lowerUrl.includes('.doc') || lowerUrl.includes('.docx')) return '📝';
    if (lowerUrl.includes('.xls') || lowerUrl.includes('.xlsx')) return '📊';
    if (lowerUrl.includes('.ppt') || lowerUrl.includes('.pptx')) return '📽️';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.png') || lowerUrl.includes('.jpeg')) return '🖼️';
    return '📎';
  };

  const gradedCount = submissions.filter((s) => s.score !== null).length;
  const ungradedCount = submissions.filter((s) => s.score === null).length;

  const filteredSubmissions = gradeFilter ? submissions.filter(s => `${s.assignments?.courses?.course_name} (${s.assignments?.courses?.section})` === gradeFilter) : submissions;
  const ungradedFiltered = filteredSubmissions.filter((s) => s.score === null);
  const gradeFilterOptions = Array.from(new Set(submissions.map(s => `${s.assignments?.courses?.course_name} (${s.assignments?.courses?.section})`)));

  const selectAllFiltered = () => {
    const allIds = ungradedFiltered.map(s => s.id);
    if (selectedSubIds.length === allIds.length && allIds.length > 0) setSelectedSubIds([]);
    else setSelectedSubIds(allIds);
  };

  const getGradeSummary = () => {
    if (!gradeSummaryCourse) return [];
    const studentsInCourse = enrollments.filter(e => e.course_id === gradeSummaryCourse);
    const courseStudentIds = studentsInCourse.map(e => e.student_id);
    
    const allKnownProfiles = {};
    submissions.forEach(s => { if (s.profiles && s.student_id) allKnownProfiles[s.student_id] = s.profiles; });
    quizSubmissions.forEach(q => { if (q.profiles && q.student_id) allKnownProfiles[q.student_id] = q.profiles; });

    const summary = courseStudentIds.map(sId => {
      const assignScores = submissions.filter(s => s.student_id === sId && s.assignments?.course_id === gradeSummaryCourse && s.score !== null).reduce((sum, s) => sum + s.score, 0);
      const quizScores = quizSubmissions.filter(qs => qs.student_id === sId && qs.quizzes?.course_id === gradeSummaryCourse && qs.score !== null).reduce((sum, qs) => sum + qs.score, 0);
      
      const total = assignScores + quizScores;
      let grade = "รอประเมิน";
      if (total >= 80) grade = "4";
      else if (total >= 75) grade = "3.5";
      else if (total >= 70) grade = "3";
      else if (total >= 65) grade = "2.5";
      else if (total >= 60) grade = "2";
      else if (total >= 55) grade = "1.5";
      else if (total >= 50) grade = "1";
      else if (total > 0) grade = "0";

      return {
        student_id: sId, profile: allKnownProfiles[sId] || { student_code: '-', full_name: 'กำลังโหลด..' },
        assignScores, quizScores, total, grade
      };
    });
    
    summary.sort((a, b) => (a.profile.student_code || "").localeCompare(b.profile.student_code || ""));
    return summary;
  };

  if (!session || session.role !== "teacher") return <Navigate to="/" />;

  return (
    <div className="bg-light min-vh-100 pb-5 font-app">
      
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center justify-content-between mb-4 z-3">
        <div className="d-flex align-items-center gap-3">
          <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-success rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '40px', height: '40px' }}><span className="fs-5">☰</span></button>
          <h5 className="fw-bold text-success m-0">Teacher Hub</h5>
        </div>
        <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>👩‍🏫</div>
      </div>

      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0" style={{ visibility: "visible", zIndex: 1045, width: "280px" }}>
            <div className="offcanvas-header p-4 bg-success text-white">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><span>🏫</span> เมนูการสอน</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1" style={{ overflowY: 'auto' }}>
              {[
                { id: 'analytics', icon: '📊', label: 'สถิติภาพรวม' }, 
                { id: 'courses', icon: '📚', label: 'จัดการวิชาเรียน' }, 
                { id: 'modules', icon: '🗂️', label: 'จัดการบทเรียน' },
                { id: 'materials', icon: '📂', label: 'เอกสารประกอบ' }, 
                { id: 'assignments', icon: '📝', label: 'งานและให้คะแนน' }, 
                { id: 'quizzes', icon: '✍️', label: 'แบบทดสอบและคะแนน' }, 
                { id: 'attendance', icon: '🙋‍♂️', label: 'เช็คชื่อเข้าเรียน' },
                { id: 'grades', icon: '🏆', label: 'สรุปเกรดรวม' },
                { id: 'profile', icon: '👤', label: 'บัญชีของฉัน' }
              ].map(item => (
                <button key={item.id} className={`btn text-start fw-bold py-3 px-4 rounded-4 transition-all ${activeTab === item.id ? "bg-success bg-opacity-10 text-success" : "bg-white text-muted border-0 hover-bg-light"}`} onClick={() => handleTabChange(item.id)}>
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

      <div className="container position-relative" style={{ maxWidth: '1000px' }}>
        
        {/* TAB 1: 📊 ภาพรวม & สถิติ */}
        {activeTab === "analytics" && (
          <div className="fade-in">
            <div className="card shadow-sm border-0 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, #198754 0%, #146c43 100%)' }}>
              <div className="card-body p-4 p-md-5 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 text-white">
                <div className="d-flex align-items-center gap-3">
                   <div className="bg-white rounded-circle shadow-sm overflow-hidden d-flex justify-content-center align-items-center" style={{width: '60px', height: '60px', fontSize: '25px'}}>
                      {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👩‍🏫'}
                   </div>
                   <div><h3 className="fw-bold mb-1">สวัสดี, ครู{profileForm.full_name || ""} 👋</h3><p className="text-white-50 mb-0">ยินดีต้อนรับกลับสู่ระบบการจัดการเรียนการสอน</p></div>
                </div>
                <button onClick={handleExportCSV} className="btn btn-light text-success fw-bold rounded-pill px-4 py-3 shadow-sm d-flex align-items-center gap-2"><span>📥</span> โหลดคะแนนงาน (CSV)</button>
              </div>
            </div>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3"><div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white"><div className="bg-primary bg-opacity-10 text-primary rounded-circle mx-auto mb-2 p-2 fs-4" style={{width:'50px', height:'50px'}}>📚</div><h2 className="fw-bold text-dark mb-0">{courses.length}</h2><small className="text-muted fw-bold text-uppercase">วิชาที่สอน</small></div></div>
              <div className="col-6 col-md-3"><div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white"><div className="bg-info bg-opacity-10 text-info rounded-circle mx-auto mb-2 p-2 fs-4" style={{width:'50px', height:'50px'}}>📝</div><h2 className="fw-bold text-dark mb-0">{assignments.length}</h2><small className="text-muted fw-bold text-uppercase">งานทั้งหมด</small></div></div>
              <div className="col-6 col-md-3"><div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white"><div className="bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-2 p-2 fs-4" style={{width:'50px', height:'50px'}}>✅</div><h2 className="fw-bold text-success mb-0">{gradedCount}</h2><small className="text-muted fw-bold text-uppercase">ตรวจแล้ว</small></div></div>
              <div className="col-6 col-md-3"><div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-white"><div className="bg-warning bg-opacity-10 text-warning rounded-circle mx-auto mb-2 p-2 fs-4" style={{width:'50px', height:'50px'}}>⏳</div><h2 className="fw-bold text-warning mb-0">{ungradedCount}</h2><small className="text-muted fw-bold text-uppercase">รอการตรวจ</small></div></div>
            </div>
          </div>
        )}

        {/* TAB 2: 📚 จัดการวิชา */}
        {activeTab === "courses" && (
          <div className="fade-in">
             <div className="card border-0 shadow-sm rounded-4 mb-5 overflow-hidden">
                  <div className="card-body p-4 bg-white">
                    <h5 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2"><span>✨</span> เปิดรายวิชาใหม่</h5>
                    <form onSubmit={handleCreateCourse}>
                      <div className="row g-3 mb-3">
                        <div className="col-md-3"><input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="รหัสวิชา" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required /></div>
                        <div className="col-md-6"><input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="ชื่อวิชา" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required /></div>
                        <div className="col-md-3"><input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="หน่วยกิต" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} required /></div>
                        <div className="col-md-10">
                          <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary fw-bold" value={courseForm.section} onChange={(e) => setCourseForm({ ...courseForm, section: e.target.value })} required>
                            <option value="">-- เลือกกลุ่มเรียน/แผนก --</option>
                            {departments.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
                          </select>
                        </div>
                        <div className="col-md-2"><input type="text" className="form-control bg-light border-0 rounded-4 p-3 text-secondary fw-bold" placeholder="ภาคเรียน" value={courseForm.semester} readOnly /></div>
                        <div className="col-md-12 mt-4"><button type="submit" className="btn btn-success w-100 rounded-4 fw-bold p-3 shadow-sm custom-btn">บันทึกรายวิชา</button></div>
                      </div>
                    </form>
                  </div>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold text-dark m-0">วิชาที่คุณดูแล</h5><span className="badge bg-success rounded-pill px-3 py-2">{courses.length} วิชา</span>
                </div>
                
                <div className="row g-3">
                  {courses.length === 0 && <p className="text-muted">ยังไม่ได้เปิดรายวิชา</p>}
                  {courses.map((c) => { 
                    const studentCount = enrollments.filter((e) => e.course_id === c.id).length; 
                    return (
                      <div key={c.id} className="col-md-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-card">
                          {editingCourse?.id === c.id ? (
                            <div className="card-body p-4">
                              <form onSubmit={handleUpdateCourse} className="d-flex flex-column gap-2">
                                <input type="text" className="form-control bg-light border-0 rounded-3" value={editingCourse.course_code} onChange={(e) => setEditingCourse({ ...editingCourse, course_code: e.target.value })} required />
                                <input type="text" className="form-control bg-light border-0 rounded-3" value={editingCourse.course_name} onChange={(e) => setEditingCourse({ ...editingCourse, course_name: e.target.value })} required />
                                <div className="d-flex gap-2">
                                  <input type="text" className="form-control bg-light border-0 rounded-3" value={editingCourse.semester} onChange={(e) => setEditingCourse({ ...editingCourse, semester: e.target.value })} required />
                                  <input type="text" className="form-control bg-light border-0 rounded-3" value={editingCourse.credits} onChange={(e) => setEditingCourse({ ...editingCourse, credits: e.target.value })} required />
                                </div>
                                <input type="text" className="form-control bg-light border-0 rounded-3" value={editingCourse.section} onChange={(e) => setEditingCourse({ ...editingCourse, section: e.target.value })} required />
                                <div className="d-flex gap-2 mt-3">
                                  <button type="submit" className="btn btn-success btn-sm w-50 rounded-pill fw-bold">บันทึก</button>
                                  <button type="button" onClick={() => setEditingCourse(null)} className="btn btn-light btn-sm w-50 rounded-pill fw-bold">ยกเลิก</button>
                                </div>
                              </form>
                            </div>
                          ) : (
                            <>
                              <div className="card-body p-4">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-2">{c.course_code}</span>
                                  <div>
                                    <button onClick={() => setEditingCourse(c)} className="btn btn-light text-warning rounded-circle p-1 me-1 shadow-sm"><span style={{fontSize:'12px'}}>✏️</span></button>
                                    <button onClick={() => handleDeleteCourse(c.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                                  </div>
                                </div>
                                <h5 className="fw-bold mb-1 text-dark">{c.course_name}</h5>
                                <p className="text-muted small mb-3">ภาค: {c.semester || "-"} | กิต: {c.credits || "-"}</p>
                                <span className="badge bg-light text-dark border px-3 py-2 w-100 text-start">กลุ่ม: {c.section}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
          </div>
        )}

        {/* TAB: หมวดหมู่บทเรียน */}
        {activeTab === "modules" && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4 text-dark">🗂️ สร้างบทเรียนใหม่</h5>
                  <form onSubmit={handleCreateModule} className="d-flex flex-column gap-3">
                    <select className="form-select custom-input bg-light border-0 rounded-4 p-3 fw-bold text-secondary" value={moduleForm.course_id} onChange={(e) => setModuleForm({ ...moduleForm, course_id: e.target.value })} required>
                      <option value="">-- เลือกรายวิชา --</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                    </select>
                    <input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="ชื่อบทเรียน (เช่น บทที่ 1)" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required />
                    <button type="submit" className="btn btn-success rounded-4 fw-bold py-3 mt-2 shadow-sm custom-btn">💾 เพิ่มบทเรียน</button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="col-lg-7">
              <h5 className="fw-bold text-dark mb-4">หมวดหมู่บทเรียนทั้งหมด ({modules.length})</h5>
              <div className="d-flex flex-column gap-3">
                {courses.map(course => {
                  const courseModules = modules.filter(m => m.course_id === course.id);
                  if(courseModules.length === 0) return null;
                  return (
                    <div key={course.id} className="mb-4">
                      <h6 className="fw-bold text-success mb-3 px-2 border-start border-4 border-success">{course.course_name}</h6>
                      <div className="d-flex flex-column gap-2">
                        {courseModules.map(m => (
                          <div key={m.id} className="bg-white shadow-sm rounded-4 p-3 d-flex justify-content-between align-items-center hover-card border-start border-4 border-primary">
                            <span className="fw-bold text-dark">{m.title}</span>
                            <button onClick={() => handleDeleteModule(m.id)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 📂 เอกสาร */}
        {activeTab === "materials" && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4 text-dark">เพิ่มเอกสารใหม่</h5>
                  <div className="d-flex bg-light p-1 rounded-pill mb-4 shadow-sm">
                    <button type="button" onClick={() => setUploadMode("file")} className={`btn rounded-pill flex-grow-1 fw-bold ${uploadMode === "file" ? "btn-white shadow-sm text-success" : "text-muted border-0"}`}>📂 อัปโหลด</button>
                    <button type="button" onClick={() => setUploadMode("link")} className={`btn rounded-pill flex-grow-1 fw-bold ${uploadMode === "link" ? "btn-white shadow-sm text-success" : "text-muted border-0"}`}>🔗 วางลิงก์ YouTube</button>
                  </div>
                  <form onSubmit={handleUploadMaterial} className="d-flex flex-column gap-3">
                    <select className="form-select custom-input bg-light border-0 rounded-4 p-3 fw-bold text-secondary" value={materialForm.course_id} onChange={(e) => setMaterialForm({ ...materialForm, course_id: e.target.value })} required>
                      <option value="">-- เลือกรายวิชา --</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                    </select>
                    <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary" value={materialForm.module_id} onChange={(e) => setMaterialForm({ ...materialForm, module_id: e.target.value })}>
                      <option value="">-- จัดอยู่ในบทเรียน (ไม่บังคับ) --</option>
                      {modules.filter(m => m.course_id === materialForm.course_id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                    <input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="ชื่อเอกสาร" value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} required />
                    {uploadMode === "file" ? (
                      <input type="file" className="form-control custom-input bg-light border-0 rounded-4 p-3" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.png" onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] })} required />
                    ) : (
                      <input type="url" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="https://..." value={materialForm.link} onChange={(e) => setMaterialForm({ ...materialForm, link: e.target.value })} required />
                    )}
                    <button type="submit" className="btn btn-success rounded-4 fw-bold py-3 mt-2 shadow-sm custom-btn" disabled={uploading}>
                      {uploading ? "⏳ กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="col-lg-7">
              <h5 className="fw-bold text-dark mb-4">เอกสารในระบบ ({materials.length})</h5>
              <div className="d-flex flex-column gap-3">
                {materials.length === 0 && <p className="text-muted">ยังไม่มีเอกสาร</p>}
                {materials.map((m) => {
                  const ytThumb = getYoutubeThumbnail(m.file_url);
                  const moduleName = modules.find(mod => mod.id === m.module_id)?.title; 
                  return (
                    <div key={m.id} className="bg-white shadow-sm rounded-4 p-3 d-flex flex-row align-items-center gap-3 hover-card">
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none d-flex align-items-center justify-content-center" style={{ flexShrink: 0, transition: '0.2s' }}>
                        {ytThumb ? (
                           <div className="rounded-3 overflow-hidden shadow-sm" style={{ width: '80px', height: '55px', flexShrink: 0 }}>
                              <img src={ytThumb} alt="youtube thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           </div>
                        ) : (
                           <div className="bg-success bg-opacity-10 text-success rounded-3 d-flex align-items-center justify-content-center fs-4 p-3">
                             {getFileIcon(m.file_url)}
                           </div>
                        )}
                      </a>
                      <div className="flex-grow-1 overflow-hidden">
                        {editingMaterial?.id === m.id ? (
                          <form onSubmit={handleUpdateMaterial} className="d-flex gap-2">
                            <input type="text" className="form-control bg-light border-0 rounded-pill form-control-sm" value={editingMaterial.title} onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })} required />
                            <button type="submit" className="btn btn-success btn-sm rounded-pill px-3">✔</button>
                          </form>
                        ) : (
                          <>
                            <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                              <h6 className="fw-bold mb-1 text-dark text-truncate hover-primary" style={{ transition: 'color 0.2s' }}>{m.title}</h6>
                            </a>
                            <p className="text-muted small mb-0 text-truncate">{m.courses?.course_name || "-"} {moduleName && <span className="text-primary">[{moduleName}]</span>}</p>
                          </>
                        )}
                      </div>
                      {!editingMaterial && (
                        <div className="d-flex flex-column gap-2 flex-shrink-0">
                          <button onClick={() => setEditingMaterial(m)} className="btn btn-light text-warning rounded-circle p-1 shadow-sm"><span style={{fontSize:'12px'}}>✏️</span></button>
                          <button onClick={() => handleDeleteMaterial(m.id)} className="btn btn-light text-danger rounded-circle p-1 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 📝 งาน & ตรวจให้คะแนน */}
        {activeTab === "assignments" && (
          <div className="fade-in">
            <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 mx-auto" style={{ maxWidth: "400px" }}>
              <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 ${assignSubTab === "create" ? "btn-success shadow-sm" : "btn-white text-muted"}`} onClick={() => setAssignSubTab("create")}>➕ สั่งงานใหม่</button>
              <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 position-relative ${assignSubTab === "grade" ? "btn-success shadow-sm" : "btn-white text-muted"}`} onClick={() => setAssignSubTab("grade")}>
                ✔️ ตรวจงาน {ungradedCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{ungradedCount}</span>}
              </button>
            </div>
            
            {assignSubTab === "create" && (
              <div className="row g-4">
                <div className="col-lg-5">
                  <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                    <div className="card-body p-4">
                      <h5 className="fw-bold mb-4 text-dark">สร้างคำสั่งงาน</h5>
                      <form onSubmit={handleCreateAssignment} className="d-flex flex-column gap-3">
                        <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary fw-bold" value={assignForm.course_id} onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })} required>
                          <option value="">-- เลือกรายวิชา --</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                        </select>
                        <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary" value={assignForm.module_id} onChange={(e) => setAssignForm({ ...assignForm, module_id: e.target.value })}>
                          <option value="">-- จัดอยู่ในบทเรียน (ไม่บังคับ) --</option>
                          {modules.filter(m => m.course_id === assignForm.course_id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                        <input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="หัวข้องาน" value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} required />
                        <textarea className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="รายละเอียดและคำชี้แจง..." value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} rows="4" required />
                        <button type="submit" className="btn btn-success rounded-4 fw-bold py-3 mt-2 shadow-sm custom-btn">ส่งคำสั่งงาน</button>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="col-lg-7">
                  <h5 className="fw-bold text-dark mb-4">งานที่สั่งไปแล้ว ({assignments.length})</h5>
                  <div className="d-flex flex-column gap-3">
                    {assignments.map((a) => {
                       const moduleName = modules.find(mod => mod.id === a.module_id)?.title;
                       return (
                      <div key={a.id} className="bg-white border-0 shadow-sm rounded-4 overflow-hidden position-relative d-flex">
                        <div className="bg-success" style={{ width: "8px" }}></div>
                        <div className="p-4 flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <span className="badge bg-light text-success border px-3 py-2 rounded-pill">{a.courses?.course_name} {moduleName && `[${moduleName}]`}</span>
                            <button onClick={() => handleDeleteAssignment(a.id)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                          </div>
                          <h5 className="fw-bold mb-2 text-dark">{a.title}</h5>
                          <p className="text-muted small mb-0 bg-light p-3 rounded-4">{a.description}</p>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            )}
            
            {assignSubTab === "grade" && (
              <div className="card border-0 shadow-sm rounded-4 bg-white">
                <div className="card-body p-4 p-md-5">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <h5 className="fw-bold m-0 text-dark d-flex align-items-center gap-2">
                      <span>✔️</span> รอตรวจและให้คะแนน <span className="badge bg-warning text-dark rounded-pill fs-6">{ungradedCount} งาน</span>
                    </h5>
                    <select className="form-select border-2 border-light bg-light rounded-pill fw-bold text-dark shadow-sm" style={{ maxWidth: '300px' }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                      <option value="">ทั้งหมด ({submissions.length} รายการ)</option>
                      {gradeFilterOptions.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div className="text-center text-muted py-5"><span className="fs-1 d-block mb-3">📭</span>ไม่มีงานสำหรับวิชานี้</div>
                  ) : (
                    <div className="row g-4">
                      {filteredSubmissions.map((sub) => {
                        const ytThumb = getYoutubeThumbnail(sub.link_url);
                        return (
                        <div key={sub.id} className="col-12 col-xl-6">
                          <div className={`border rounded-4 p-4 h-100 d-flex flex-column transition-all position-relative ${sub.score !== null ? 'border-success bg-success bg-opacity-10' : 'border-warning bg-white shadow-sm hover-card'}`}>
                            
                            <div className="d-flex justify-content-between align-items-start mb-3 pe-4">
                              <div>
                                <span className="badge bg-dark text-white rounded-pill px-3 py-2 me-2">{sub.assignments?.courses?.section || "-"}</span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2">{sub.profiles?.student_code || "-"}</span>
                                <div className="fw-bold text-dark mt-2 fs-5">{sub.profiles?.full_name || "ไม่ระบุชื่อ"}</div>
                              </div>
                              {sub.score !== null && editingGrade !== sub.id ? (
                                <div className="text-success fw-bold bg-white px-3 py-2 rounded-pill shadow-sm border border-success mt-1 d-flex align-items-center gap-2">
                                  ✔ {sub.score} คะแนน
                                  <button onClick={() => {
                                     setEditingGrade(sub.id);
                                     setGradeForm({ id: sub.id, score: sub.score, feedback: sub.teacher_feedback || "" });
                                  }} className="btn btn-sm btn-light rounded-circle p-1" title="แก้ไขคะแนนและคำติชม">✏️</button>
                                </div>
                              ) : sub.score === null && editingGrade !== sub.id ? (
                                <div className="text-warning fw-bold bg-warning bg-opacity-10 px-3 py-2 rounded-pill border border-warning text-dark mt-1">⏳ รอตรวจ</div>
                              ) : null}
                            </div>
                            
                            <div className="bg-light rounded-4 p-3 mb-4 flex-grow-1">
                              <strong className="text-success small d-block mb-2 border-bottom pb-2">{sub.assignments?.courses?.course_name || "-"} : {sub.assignments?.title || "-"}</strong>
                              
                              {sub.submitted_text && <p className="mb-2 text-dark lh-base bg-white p-2 rounded-3 border">"{sub.submitted_text}"</p>}
                              {sub.link_url && (
                                <div className="mb-2">
                                  {ytThumb && <img src={ytThumb} alt="Preview" className="w-100 object-fit-cover rounded-3 mb-1" />}
                                  <a href={sub.link_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-3">🔗 เปิดลิงก์ที่เด็กส่ง</a>
                                </div>
                              )}
                              {sub.file_url && (
                                <div className="mb-2"><a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary rounded-pill px-3">📂 โหลดไฟล์ที่แนบ</a></div>
                              )}
                            </div>

                            {(sub.score === null || editingGrade === sub.id) ? (
                              <form onSubmit={(e) => handleGradeSubmit(e, sub.id)} className="d-flex flex-column gap-2 slide-up">
                                <textarea className="form-control custom-input bg-white border-light rounded-4 p-2 small" placeholder="พิมพ์คำแนะนำ/ฟีดแบ็ก (ถ้ามี)..." value={gradeForm.id === sub.id ? gradeForm.feedback : ""} onChange={(e) => setGradeForm({ ...gradeForm, id: sub.id, feedback: e.target.value })} rows="2"></textarea>
                                <div className="d-flex gap-2">
                                   <input type="number" className="form-control custom-input bg-white border-warning rounded-pill px-4 fw-bold flex-grow-1" placeholder="ระบุคะแนน" required value={gradeForm.id === sub.id ? gradeForm.score : ""} onChange={(e) => setGradeForm({ ...gradeForm, id: sub.id, score: e.target.value })} />
                                   <button type="submit" className="btn btn-success rounded-pill fw-bold px-4 shadow-sm custom-btn">บันทึก</button>
                                   {editingGrade === sub.id && (
                                     <button type="button" onClick={() => setEditingGrade(null)} className="btn btn-light rounded-pill fw-bold px-3">ยกเลิก</button>
                                   )}
                                </div>
                              </form>
                            ) : (
                              sub.teacher_feedback && <div className="bg-white p-3 rounded-4 border mt-2 small text-primary">💬 ครู: {sub.teacher_feedback}</div>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🌟 TAB 5: 📝 ข้อสอบ (พร้อมฟีเจอร์แนบรูปภาพในโจทย์ และกำหนดเวลา) */}
        {activeTab === "quizzes" && (
          <div className="fade-in">
             <div className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4 mx-auto" style={{ maxWidth: "400px" }}>
              <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 ${quizSubTab === "create" ? "btn-success shadow-sm" : "btn-white text-muted"}`} onClick={() => setQuizSubTab("create")}>➕ สร้างข้อสอบ</button>
              <button className={`btn rounded-pill flex-grow-1 fw-bold py-2 ${quizSubTab === "scores" ? "btn-success shadow-sm" : "btn-white text-muted"}`} onClick={() => setQuizSubTab("scores")}>📊 ดูคะแนนสอบ</button>
            </div>
            
            {quizSubTab === "create" && (
              <>
                <div className="card border-0 shadow-sm rounded-4 mb-5 bg-white">
                  <div className="card-body p-4 p-md-5">
                    <h5 className="fw-bold mb-4 text-dark">✨ สร้างแบบทดสอบใหม่</h5>
                    
                    {quizzes.length > 0 && (
                      <div className="mb-4 p-3 bg-light rounded-4 border">
                        <label className="form-label small fw-bold text-success mb-2">🔄 คัดลอกชุดคำถามจากข้อสอบเดิม</label>
                        <select className="form-select border-0 shadow-sm rounded-3" onChange={handleCloneQuiz}>
                          <option value="">-- เลือกข้อสอบที่เคยสร้างไว้ --</option>
                          {quizzes.map(q => <option key={q.id} value={q.id}>{q.courses?.course_name} : {q.title}</option>)}
                        </select>
                      </div>
                    )}

                    <form onSubmit={handleCreateQuiz}>
                      {/* 🌟 เพิ่มช่องเวลาสอบ */}
                      <div className="row g-3 mb-4">
                        <div className="col-md-4">
                          <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary fw-bold" value={quizForm.course_id} onChange={(e) => setQuizForm({ ...quizForm, course_id: e.target.value })} required>
                            <option value="">-- เลือกรายวิชา --</option>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <select className="form-select custom-input bg-light border-0 rounded-4 p-3 text-secondary" value={quizForm.module_id} onChange={(e) => setQuizForm({ ...quizForm, module_id: e.target.value })}>
                            <option value="">-- บทเรียน (ไม่บังคับ) --</option>
                            {modules.filter(m => m.course_id === quizForm.course_id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <input type="number" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="เวลาสอบ (นาที) *0=ไม่จำกัด" value={quizForm.time_limit} onChange={(e) => setQuizForm({ ...quizForm, time_limit: e.target.value })} required />
                        </div>
                        <div className="col-md-12">
                          <input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="หัวข้อแบบทดสอบ" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} required />
                        </div>
                      </div>
                      
                      <h6 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2"><span>📋</span> ชุดคำถาม</h6>
                      {questions.map((q, qIndex) => (
                        <div key={qIndex} className="bg-light p-4 rounded-4 mb-4 position-relative border slide-down">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fw-bold text-success bg-white px-3 py-1 rounded-pill shadow-sm">ข้อที่ {qIndex + 1}</span>
                            {questions.length > 1 && (<button type="button" className="btn btn-white text-danger btn-sm rounded-pill shadow-sm px-3 fw-bold" onClick={() => setQuestions(questions.filter((_, i) => i !== qIndex))}>ลบข้อนี้</button>)}
                          </div>
                          
                          <input type="text" className="form-control custom-input border-0 rounded-4 p-3 mb-3 shadow-sm" placeholder="พิมพ์โจทย์คำถาม..." value={q.question} onChange={(e) => updateQuestion(qIndex, "question", e.target.value)} required />
                          
                          <div className="mb-4">
                            <label className="small fw-bold text-muted d-block mb-1">🖼️ แนบรูปภาพประกอบโจทย์ (ถ้ามี)</label>
                            <div className="d-flex align-items-center gap-3">
                              <input type="file" accept="image/*" className="form-control bg-white rounded-3 border-0 shadow-sm p-2 w-75" onChange={(e) => handleQuestionImageUpload(qIndex, e)} />
                              {q.imageUrl && <img src={q.imageUrl} alt="preview" style={{ height: '40px', borderRadius: '5px' }} />}
                            </div>
                          </div>

                          <div className="row g-3">
                            {q.options.map((opt, optIndex) => (
                              <div key={optIndex} className="col-md-6">
                                <div className={`d-flex align-items-center gap-3 border rounded-4 p-2 bg-white transition-all ${q.correctOption === optIndex ? "border-success border-2 shadow-sm bg-success bg-opacity-10" : "border-light"}`}>
                                  <input className="form-check-input mt-0 ms-2" type="radio" name={`correct-${qIndex}`} style={{ width: "24px", height: "24px" }} checked={q.correctOption === optIndex} onChange={() => updateQuestion(qIndex, "correctOption", optIndex)} />
                                  <input type="text" className="form-control border-0 bg-transparent fw-bold" placeholder={`ตัวเลือกที่ ${optIndex + 1}`} value={opt} onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} required />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="d-flex flex-column flex-md-row gap-3 mt-4">
                        <button type="button" className="btn btn-light text-success border border-success rounded-pill fw-bold py-3 px-5 custom-btn-outline" onClick={addQuestion}>+ เพิ่มโจทย์ข้อต่อไป</button>
                        <button type="submit" className="btn btn-success rounded-pill fw-bold flex-grow-1 py-3 shadow-sm custom-btn">💾 บันทึกแบบทดสอบ</button>
                      </div>
                    </form>
                  </div>
              </div>
                
              <h5 className="fw-bold mb-3 text-dark">แบบทดสอบที่สร้างไว้แล้ว</h5>
              <div className="row g-3">
                {quizzes.length === 0 && <p className="text-muted">ยังไม่มีแบบทดสอบ</p>}
                {quizzes.map((q) => (
                  <div key={q.id} className="col-md-6 col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white hover-card">
                      <strong className="text-success small mb-3 bg-success bg-opacity-10 d-inline-block px-3 py-2 rounded-pill align-self-start">{q.courses?.course_name || "-"} ({q.courses?.section || "-"})</strong>
                      <span className="fw-bold fs-5 mb-2 text-dark">{q.title}</span>
                      <span className="text-muted small mt-auto fw-bold d-block">จำนวน {q.questions.length} ข้อ</span>
                      {q.time_limit > 0 && <span className="badge bg-warning text-dark mt-2">⏳ {q.time_limit} นาที</span>}
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}

            {quizSubTab === "scores" && (
               <div className="card border-0 shadow-sm rounded-4 bg-white slide-up">
                 <div className="card-body p-4 p-md-5">
                   <div className="d-flex justify-content-between align-items-center mb-4">
                     <h5 className="fw-bold m-0 text-dark">ผลคะแนนแบบทดสอบ (ตรวจอัตโนมัติ)</h5>
                     <button onClick={handleExportQuizCSV} className="btn btn-success rounded-pill fw-bold px-4 shadow-sm">📥 โหลดคะแนนสอบ (CSV)</button>
                   </div>
                   
                   {quizSubmissions.length === 0 ? (
                     <div className="text-center text-muted py-5"><span className="fs-1 d-block mb-3">📭</span>ยังไม่มีนักเรียนส่งข้อสอบ</div>
                   ) : (
                     <div className="table-responsive rounded-4 border">
                       <table className="table table-hover align-middle mb-0">
                         <thead className="table-light"><tr><th className="px-4 py-3">วิชา / กลุ่ม</th><th className="py-3">ชื่อแบบทดสอบ</th><th className="py-3">รหัสนักศึกษา</th><th className="py-3">ชื่อ - นามสกุล</th><th className="text-center py-3">คะแนนที่ได้</th></tr></thead>
                         <tbody>
                           {quizSubmissions.map(qs => (
                             <tr key={qs.id}>
                               <td className="px-4 fw-bold text-secondary">{qs.quizzes?.courses?.course_name || "-"} <br/><small className="text-muted">({qs.quizzes?.courses?.section || "-"})</small></td>
                               <td className="text-dark">{qs.quizzes?.title || "-"}</td>
                               <td>{qs.profiles?.student_code || "-"}</td>
                               <td className="fw-bold text-dark">{qs.profiles?.full_name || "ไม่ระบุชื่อ"}</td>
                               <td className="text-center">
                                 <span className="badge bg-success rounded-pill px-3 py-2 fs-6 shadow-sm">{qs.score} / {qs.total_score}</span>
                                 {qs.is_cheated && <span className="badge bg-danger rounded-pill px-2 py-1 ms-2 shadow-sm" title="สลับหน้าจอขณะสอบ">🚨 ทุจริต</span>}
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   )}
                 </div>
               </div>
            )}
          </div>
        )}

        {/* 🌟 TAB 6: ระบบเช็คชื่อ */}
        {activeTab === "attendance" && (
          <div className="fade-in card border-0 shadow-sm rounded-4 bg-white mb-5">
            <div className="card-body p-4 p-md-5">
               <h4 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2"><span>🙋‍♂️</span> เช็คชื่อเข้าเรียน</h4>
               <div className="row g-3 mb-4 bg-light p-4 rounded-4">
                 <div className="col-md-6">
                    <label className="fw-bold text-muted small mb-2">เลือกรายวิชา/กลุ่มเรียน</label>
                    <select className="form-select border-0 shadow-sm rounded-3 py-2 fw-bold" value={attCourse} onChange={(e) => setAttCourse(e.target.value)}>
                      <option value="">-- กรุณาเลือก --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                    </select>
                 </div>
                 <div className="col-md-6">
                    <label className="fw-bold text-muted small mb-2">วันที่สอน</label>
                    <input type="date" className="form-control border-0 shadow-sm rounded-3 py-2 fw-bold" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                 </div>
               </div>

               {attCourse && (
                 <div className="slide-up">
                   <div className="d-flex justify-content-between align-items-center mb-3">
                     <h6 className="fw-bold text-dark">รายชื่อนักเรียน</h6>
                     <button onClick={handleSaveAttendance} className="btn btn-success rounded-pill px-4 fw-bold shadow-sm custom-btn">💾 บันทึกการเข้าเรียน</button>
                   </div>
                   <div className="table-responsive border rounded-4">
                     <table className="table align-middle mb-0">
                        <thead className="table-light"><tr><th className="px-4 py-3">รหัส</th><th className="py-3">ชื่อ-สกุล</th><th className="py-3 text-center">สถานะการเข้าเรียน</th></tr></thead>
                        <tbody>
                          {enrollments.filter(e => e.course_id === attCourse).map(enroll => (
                            <tr key={enroll.student_id}>
                              <td className="px-4">{enroll.profiles?.student_code || '-'}</td>
                              <td className="fw-bold text-dark">{enroll.profiles?.full_name || '-'}</td>
                              <td className="text-center">
                                <div className="btn-group shadow-sm" role="group">
                                  {["มา", "สาย", "ลา", "ขาด"].map((status, i) => {
                                    const colors = ["outline-success", "outline-warning", "outline-info", "outline-danger"];
                                    const activeColors = ["success", "warning", "info", "danger"];
                                    const isSelected = attRecords[enroll.student_id] === status;
                                    return (
                                      <button key={status} type="button" 
                                        className={`btn btn-sm ${isSelected ? `btn-${activeColors[i]} text-white` : `btn-${colors[i]} bg-white`}`}
                                        onClick={() => setAttRecords({...attRecords, [enroll.student_id]: status})}>
                                        {status}
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {enrollments.filter(e => e.course_id === attCourse).length === 0 && (
                            <tr><td colSpan="3" className="text-center py-4 text-muted">ยังไม่มีนักเรียนลงทะเบียนในวิชานี้</td></tr>
                          )}
                        </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* 🌟 TAB 7: สรุปเกรดรวม */}
        {activeTab === "grades" && (
          <div className="fade-in card border-0 shadow-sm rounded-4 bg-white mb-5">
            <div className="card-body p-4 p-md-5">
              <h4 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2"><span>🏆</span> สรุปผลการเรียนและตัดเกรด</h4>
              <div className="bg-light p-4 rounded-4 mb-4">
                <label className="fw-bold text-muted small mb-2">เลือกรายวิชาเพื่อประมวลผล</label>
                <select className="form-select border-0 shadow-sm rounded-3 py-3 fw-bold fs-5 text-primary" value={gradeSummaryCourse} onChange={(e) => setGradeSummaryCourse(e.target.value)}>
                  <option value="">-- กรุณาเลือกรายวิชา --</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_name} ({c.section})</option>)}
                </select>
              </div>

              {gradeSummaryCourse && (
                <div className="slide-up table-responsive border rounded-4 shadow-sm">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr className="text-center">
                        <th className="px-4 py-3 text-start">รหัส</th>
                        <th className="py-3 text-start">ชื่อ-สกุล</th>
                        <th className="py-3">คะแนนเก็บ (งาน)</th>
                        <th className="py-3">คะแนนสอบ (ควิซ)</th>
                        <th className="py-3 bg-warning bg-opacity-10 fw-bold">รวมสุทธิ</th>
                        <th className="py-3 bg-success bg-opacity-10 fw-bold">เกรดประเมิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getGradeSummary().map(row => (
                        <tr key={row.student_id} className="text-center">
                          <td className="px-4 text-start">{row.profile.student_code}</td>
                          <td className="fw-bold text-dark text-start">{row.profile.full_name}</td>
                          <td className="text-muted">{row.assignScores}</td>
                          <td className="text-muted">{row.quizScores}</td>
                          <td className="fw-bold fs-5 text-primary bg-warning bg-opacity-10">{row.total}</td>
                          <td className="bg-success bg-opacity-10"><span className={`badge ${row.grade === '0' || row.grade === 'รอประเมิน' ? 'bg-danger' : 'bg-success'} rounded-pill px-3 py-2 fs-6 shadow-sm`}>{row.grade}</span></td>
                        </tr>
                      ))}
                      {getGradeSummary().length === 0 && <tr><td colSpan="6" className="text-center py-5 text-muted">ไม่มีข้อมูลนักเรียน</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: บัญชีของฉัน */}
        {activeTab === "profile" && (
          <div className="fade-in d-flex flex-column align-items-center">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white w-100" style={{ maxWidth: "500px" }}>
              <div className="p-5 text-center position-relative" style={{ background: 'linear-gradient(135deg, #198754 0%, #146c43 100%)' }}>
                <div className="bg-white rounded-circle position-absolute start-50 translate-middle border border-4 border-white shadow-sm d-flex justify-content-center align-items-center overflow-hidden" style={{ width: "90px", height: "90px", top: "100%", fontSize: "36px" }}>
                   {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="Profile" className="w-100 h-100" style={{objectFit: 'cover'}}/> : '👩‍🏫'}
                </div>
              </div>
              <div className="card-body pt-5 px-4 pb-5 text-center mt-3"><h4 className="fw-bold mb-1 text-dark">ครู{profileForm.full_name || ""}</h4><p className="text-muted mb-0">{session?.user?.email}</p></div>
            </div>
            
            <div className="card border-0 shadow-sm rounded-4 bg-white w-100 mb-4" style={{ maxWidth: "500px" }}>
              <div className="card-body p-4 p-md-5">
                <h5 className="fw-bold mb-4 text-dark text-center">แก้ไขข้อมูลส่วนตัว</h5>
                <form onSubmit={handleUpdateProfile}>
                  <div className="mb-3"><label className="form-label text-muted small fw-bold ms-2">ชื่อ - นามสกุล</label><input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3 fw-bold" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} required /></div>
                  <div className="mb-3"><label className="form-label text-muted small fw-bold ms-2">ชื่อเล่น</label><input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3" value={profileForm.nickname} onChange={(e) => setProfileForm({...profileForm, nickname: e.target.value})} placeholder="ระบุชื่อเล่น" /></div>
                  <div className="mb-3"><label className="form-label text-muted small fw-bold ms-2">เบอร์โทรศัพท์</label><input type="text" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-3" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} placeholder="08X-XXX-XXXX" /></div>
                  <div className="mb-4">
                    <label className="form-label text-muted small fw-bold ms-2">รูปโปรไฟล์ (อัปโหลดจากเครื่อง)</label>
                    <input type="file" accept="image/*" className="form-control custom-input bg-light border-0 rounded-pill px-4 py-2" onChange={handleUploadAvatar} disabled={uploadingAvatar} />
                    {uploadingAvatar && <small className="text-success mt-2 ms-2 d-block fw-bold">⏳ กำลังอัปโหลด...</small>}
                  </div>
                  <hr className="my-4 border-light" />
                  
                  {/* 🌟 ส่วนเชื่อมต่อ Telegram สำหรับคุณครู */}
                  <h6 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2"><span>✈️</span> การแจ้งเตือนผ่าน Telegram</h6>
                  <div className="bg-success bg-opacity-10 p-3 rounded-4 mb-4 border border-success border-opacity-25">
                     <p className="small text-dark mb-2">1. กดปุ่มด้านล่างเพื่อเปิด Telegram และรับรหัส Chat ID ของคุณจากบอท @getmyid_bot</p>
                     <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-success rounded-pill px-3 shadow-sm mb-3">👉 เปิด Telegram รับรหัส</a>
                     <p className="small text-dark mb-2">2. นำตัวเลข Chat ID (เช่น 123456789) มากรอกในช่องด้านล่าง</p>
                     <input type="text" className="form-control custom-input bg-white border-0 rounded-pill px-4 py-3" placeholder="ระบุ Telegram Chat ID" value={profileForm.telegram_chat_id || ''} onChange={e => setProfileForm({...profileForm, telegram_chat_id: e.target.value})} />
                     {profileForm.telegram_chat_id && <small className="text-success fw-bold d-block mt-2">✅ ข้อมูล Chat ID พร้อมใช้งานแล้ว</small>}
                  </div>

                  <hr className="my-4 border-light" />

                  <h6 className="fw-bold mb-3 text-dark">ข้อมูลของระบบ (แก้ไขไม่ได้)</h6>
                  <div className="mb-3"><label className="form-label text-muted small fw-bold ms-2">รหัสบุคลากร</label><input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-3 text-muted" value={profileForm.student_code} disabled /></div>
                  <div className="mb-4"><label className="form-label text-muted small fw-bold ms-2">แผนกวิชา</label><input type="text" className="form-control bg-light border-0 rounded-pill px-4 py-3 text-muted" value={profileForm.department} disabled /></div>
                  <button type="submit" className="btn btn-success w-100 rounded-pill fw-bold py-3 shadow-sm custom-btn">💾 บันทึกข้อมูล</button>
                </form>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: '120px', width: '100%' }}></div>

      </div>

      <style>{`
        .font-app { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; } 
        .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .transition-all { transition: all 0.3s ease; } 
        .hover-bg-light:hover { background-color: #f8f9fa !important; } 
        .hover-card { transition: transform 0.2s, box-shadow 0.2s; } 
        .hover-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; } 
        .custom-input { transition: all 0.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); } 
        .custom-input:focus { box-shadow: 0 0 0 4px rgba(25, 135, 84, 0.15) !important; background-color: #fff !important; } 
        .custom-btn { transition: all 0.3s; } 
        .custom-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(25, 135, 84, 0.3) !important; } 
        .custom-btn-outline:hover { background-color: rgba(25, 135, 84, 0.1); } 
        .hover-primary:hover { color: #198754 !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } 
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes slideDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}