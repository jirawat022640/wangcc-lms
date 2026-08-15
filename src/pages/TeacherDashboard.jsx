import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function TeacherDashboard({ session, handleLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("analytics");
  const [assignSubTab, setAssignSubTab] = useState("create");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  // อัปเดต: เก็บข้อมูลนักศึกษาที่ลงทะเบียน และวิชาที่กำลังกดดูรายชื่อ
  const [enrollments, setEnrollments] = useState([]);
  const [viewingCourseStudents, setViewingCourseStudents] = useState(null);

  const [courseForm, setCourseForm] = useState({
    code: "",
    name: "",
    section: "",
    semester: "",
    credits: "",
  });
  const [assignForm, setAssignForm] = useState({
    course_id: "",
    title: "",
    description: "",
  });
  const [quizForm, setQuizForm] = useState({ course_id: "", title: "" });
  const [questions, setQuestions] = useState([
    { question: "", options: ["", "", "", ""], correctOption: 0 },
  ]);
  const [gradeForm, setGradeForm] = useState({ id: "", score: "" });
  const [profileName, setProfileName] = useState("");

  const [editingCourse, setEditingCourse] = useState(null);
  const [editingAssign, setEditingAssign] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [uploadMode, setUploadMode] = useState("file");
  const [materialForm, setMaterialForm] = useState({
    course_id: "",
    title: "",
    file: null,
    link: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (session?.role === "teacher") fetchData();
  }, [session]);

  const fetchData = async () => {
    const { data: pData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();
    if (pData?.full_name) setProfileName(pData.full_name);

    const { data: cData } = await supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", session.user.id)
      .order("created_at", { ascending: false });
    if (cData) setCourses(cData);

    // อัปเดต: ดึงข้อมูลรายชื่อนักเรียนที่ลงทะเบียนในวิชาของครูคนนี้
    const myCourseIds = cData ? cData.map((c) => c.id) : [];
    if (myCourseIds.length > 0) {
      const { data: eData } = await supabase
        .from("enrollments")
        .select("course_id, profiles(student_code, full_name)")
        .in("course_id", myCourseIds);
      if (eData) setEnrollments(eData);
    }

    const { data: aData } = await supabase
      .from("assignments")
      .select("*, courses!inner(course_name, section, teacher_id)")
      .eq("courses.teacher_id", session.user.id)
      .order("created_at", { ascending: false });
    if (aData) setAssignments(aData);

    const { data: sData } = await supabase
      .from("submissions")
      .select(
        "*, profiles!inner(student_code, full_name), assignments!inner(title, courses!inner(course_name, section, semester, credits, teacher_id))",
      )
      .eq("assignments.courses.teacher_id", session.user.id)
      .order("created_at", { ascending: false });
    if (sData) setSubmissions(sData);

    const { data: mData } = await supabase
      .from("materials")
      .select("*, courses!inner(course_name, section, teacher_id)")
      .eq("courses.teacher_id", session.user.id)
      .order("created_at", { ascending: false });
    if (mData) setMaterials(mData);

    const { data: qData } = await supabase
      .from("quizzes")
      .select("*, courses!inner(course_name, section, teacher_id)")
      .eq("courses.teacher_id", session.user.id)
      .order("created_at", { ascending: false });
    if (qData) setQuizzes(qData);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
    setViewingCourseStudents(null);
  };
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    await supabase
      .from("profiles")
      .update({ full_name: profileName })
      .eq("id", session.user.id);
    alert("บันทึกสำเร็จ");
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    await supabase
      .from("courses")
      .insert([
        {
          course_code: courseForm.code,
          course_name: courseForm.name,
          section: courseForm.section,
          semester: courseForm.semester,
          credits: courseForm.credits,
          teacher_id: session.user.id,
        },
      ]);
    setCourseForm({
      code: "",
      name: "",
      section: "",
      semester: "",
      credits: "",
    });
    fetchData();
    alert("สร้างรายวิชาสำเร็จ");
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.course_id) return alert("กรุณาเลือกรายวิชา");
    await supabase
      .from("assignments")
      .insert([
        {
          course_id: assignForm.course_id,
          title: assignForm.title,
          description: assignForm.description,
        },
      ]);
    setAssignForm({ course_id: "", title: "", description: "" });
    fetchData();
    alert("สั่งงานสำเร็จ");
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!quizForm.course_id) return alert("กรุณาเลือกรายวิชา");
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question) return alert(`กรุณากรอกโจทย์ข้อที่ ${i + 1}`);
      if (questions[i].options.some((opt) => opt.trim() === ""))
        return alert(`กรุณากรอกตัวเลือกให้ครบในข้อที่ ${i + 1}`);
    }
    await supabase
      .from("quizzes")
      .insert([
        {
          course_id: quizForm.course_id,
          title: quizForm.title,
          questions: questions,
        },
      ]);
    setQuizForm({ course_id: "", title: "" });
    setQuestions([
      { question: "", options: ["", "", "", ""], correctOption: 0 },
    ]);
    fetchData();
    alert("สร้างแบบทดสอบสำเร็จ");
  };

  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.course_id) return alert("กรุณาเลือกรายวิชา");
    let finalUrl = "";
    setUploading(true);
    if (uploadMode === "file") {
      if (!materialForm.file) {
        alert("กรุณาเลือกไฟล์");
        setUploading(false);
        return;
      }
      const file = materialForm.file;
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${materialForm.course_id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("course_materials")
        .upload(filePath, file);
      if (uploadError) {
        alert(`อัปโหลดไม่สำเร็จ: ${uploadError.message}`);
        setUploading(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("course_materials").getPublicUrl(filePath);
      finalUrl = publicUrl;
    } else {
      if (!materialForm.link) {
        alert("กรุณาวางลิงก์");
        setUploading(false);
        return;
      }
      finalUrl = materialForm.link;
    }
    await supabase
      .from("materials")
      .insert([
        {
          course_id: materialForm.course_id,
          title: materialForm.title,
          file_url: finalUrl,
        },
      ]);
    setMaterialForm({ course_id: "", title: "", file: null, link: "" });
    fetchData();
    alert("สำเร็จ!");
    setUploading(false);
  };

  const handleGradeSubmit = async (e, subId) => {
    e.preventDefault();
    await supabase
      .from("submissions")
      .update({ score: gradeForm.score })
      .eq("id", subId);
    setGradeForm({ id: "", score: "" });
    fetchData();
    alert("บันทึกคะแนนสำเร็จ");
  };
  const handleDeleteCourse = async (id) => {
    if (!window.confirm("⚠️ ลบวิชานี้หรือไม่?")) return;
    await supabase.from("courses").delete().eq("id", id);
    fetchData();
  };
  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("⚠️ ลบเอกสารนี้หรือไม่?")) return;
    await supabase.from("materials").delete().eq("id", id);
    fetchData();
  };
  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("⚠️ ลบคำสั่งงานนี้หรือไม่?")) return;
    await supabase.from("assignments").delete().eq("id", id);
    fetchData();
  };
  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    await supabase
      .from("courses")
      .update({
        course_code: editingCourse.course_code,
        course_name: editingCourse.course_name,
        section: editingCourse.section,
        semester: editingCourse.semester,
        credits: editingCourse.credits,
      })
      .eq("id", editingCourse.id);
    setEditingCourse(null);
    fetchData();
    alert("อัปเดตวิชาสำเร็จ");
  };
  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    await supabase
      .from("materials")
      .update({ title: editingMaterial.title })
      .eq("id", editingMaterial.id);
    setEditingMaterial(null);
    fetchData();
    alert("อัปเดตสำเร็จ");
  };
  const handleUpdateAssignment = async (e) => {
    e.preventDefault();
    await supabase
      .from("assignments")
      .update({
        title: editingAssign.title,
        description: editingAssign.description,
      })
      .eq("id", editingAssign.id);
    setEditingAssign(null);
    fetchData();
    alert("อัปเดตสำเร็จ");
  };

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctOption: 0 },
    ]);
  const updateQuestion = (index, field, value) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };
  const updateOption = (qIndex, optIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].options[optIndex] = value;
    setQuestions(newQs);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0)
      return alert("ยังไม่มีข้อมูลการส่งงานสำหรับดาวน์โหลดครับ");
    let csvContent =
      "\uFEFFภาคเรียน,รหัสวิชา,วิชา,หน่วยกิต,กลุ่มเรียน/แผนก,ชิ้นงาน,รหัสนักศึกษา,ชื่อ-นามสกุล,คะแนน,สถานะ\n";
    submissions.forEach((sub) => {
      const course = sub.assignments.courses;
      const status = sub.score !== null ? "ตรวจแล้ว" : "รอดำเนินการ";
      csvContent += `"${course.semester || "-"}","${course.course_code || "-"}","${course.course_name}","${course.credits || "-"}","${course.section}","${sub.assignments.title}","${sub.profiles?.student_code || "ไม่มีรหัส"}","${sub.profiles?.full_name || "ไม่ระบุชื่อ"}","${sub.score !== null ? sub.score : "รอตรวจ"}","${status}"\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `สรุปคะแนน_LMS_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const gradedCount = submissions.filter((s) => s.score !== null).length;
  const ungradedCount = submissions.filter((s) => s.score === null).length;

  if (!session || session.role !== "teacher") return <Navigate to="/" />;

  return (
    <div className="bg-light min-vh-100 pb-5">
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center mb-4 gap-3">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="btn btn-light text-dark rounded-3 border-0 fs-4 px-3 py-1 shadow-sm"
        >
          ☰
        </button>
        <h4 className="fw-bold text-success m-0 flex-grow-1">Teacher Portal</h4>
      </div>

      {isMenuOpen && (
        <>
          <div
            className="offcanvas-backdrop fade show"
            style={{ display: "block", zIndex: 1040 }}
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div
            className="offcanvas offcanvas-start show shadow-lg border-0"
            style={{ visibility: "visible", zIndex: 1045, width: "300px" }}
            tabIndex="-1"
          >
            <div className="offcanvas-header border-bottom p-4">
              <h5 className="offcanvas-title fw-bold text-success m-0">
                เมนูจัดการระบบ
              </h5>
              <button
                type="button"
                className="btn-close text-reset"
                onClick={() => setIsMenuOpen(false)}
              ></button>
            </div>
            <div className="offcanvas-body d-flex flex-column gap-2 p-4 bg-light">
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "analytics" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("analytics")}
              >
                📊 ภาพรวม & สถิติ
              </button>
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "courses" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("courses")}
              >
                📚 จัดการวิชา
              </button>
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "materials" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("materials")}
              >
                📎 เอกสารการสอน
              </button>
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "assignments" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("assignments")}
              >
                📝 งาน & ตรวจงาน
              </button>
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "quizzes" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("quizzes")}
              >
                📝 สร้างแบบทดสอบ
              </button>
              <button
                className={`btn text-start fw-bold py-3 px-4 rounded-4 ${activeTab === "profile" ? "btn-success shadow-sm" : "bg-white text-muted border-0"}`}
                onClick={() => handleTabChange("profile")}
              >
                👤 บัญชีส่วนตัว
              </button>
              <hr className="my-4 text-secondary" />
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
                className="btn btn-outline-danger bg-white rounded-pill fw-bold py-3 shadow-sm mt-auto"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </>
      )}

      <div className="container">
        {/* TAB 1: 📊 ภาพรวม & สถิติ (โค้ดเดิม) */}
        {activeTab === "analytics" && (
          <div className="fade-in">
            <div className="card shadow-sm border-0 rounded-4 bg-success text-white mb-4 overflow-hidden">
              <div className="card-body p-4 p-md-5 position-relative">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                  <div>
                    <h3 className="fw-bold mb-1">
                      ยินดีต้อนรับ, ครู{profileName || ""} 👋
                    </h3>
                    <p className="text-white-50 mb-0">
                      นี่คือสรุปผลการจัดการเรียนการสอนของคุณ
                    </p>
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="btn btn-light text-success fw-bold rounded-pill px-4 py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                  >
                    <span>📥</span> ดาวน์โหลดคะแนน (CSV)
                  </button>
                </div>
              </div>
            </div>
            <div className="alert alert-danger border-0 shadow-sm rounded-4 d-flex align-items-start gap-3 p-4 mb-4">
              <div
                className="bg-danger text-white rounded-circle d-flex justify-content-center align-items-center flex-shrink-0"
                style={{ width: "40px", height: "40px" }}
              >
                ⚠️
              </div>
              <div>
                <h6 className="fw-bold mb-2">
                  แจ้งเตือนผู้เรียนกลุ่มเสี่ยง (Risk Alert)
                </h6>
                <p className="mb-2 small text-muted">
                  ระบบตรวจพบผู้เรียนที่ค้างส่งงานเกิน 2 ครั้ง
                  หรือมีคะแนนเฉลี่ยต่ำกว่า 50%
                </p>
                <div className="bg-white rounded-3 p-3 text-dark small fw-bold">
                  <div className="mb-1">
                    • รหัส: 6620002 | สาเหตุ: ขาดส่งงานเกิน 2 ครั้ง
                  </div>
                  <div>• รหัส: 6620005 | สาเหตุ: คะแนนเฉลี่ยสอบต่ำกว่า 50%</div>
                </div>
              </div>
            </div>
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 text-center h-100">
                  <h6 className="text-muted fw-bold mb-2 small text-uppercase">
                    วิชาที่เปิดสอน
                  </h6>
                  <h1 className="display-5 fw-bold text-dark mb-0">
                    {courses.length}
                  </h1>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 text-center h-100">
                  <h6 className="text-muted fw-bold mb-2 small text-uppercase">
                    งานที่สั่งทั้งหมด
                  </h6>
                  <h1 className="display-5 fw-bold text-dark mb-0">
                    {assignments.length}
                  </h1>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card bg-success bg-opacity-10 border-0 shadow-sm rounded-4 p-3 text-center h-100">
                  <h6 className="text-success fw-bold mb-2 small text-uppercase">
                    ตรวจแล้ว
                  </h6>
                  <h1 className="display-5 fw-bold text-success mb-0">
                    {gradedCount}
                  </h1>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card bg-warning bg-opacity-10 border-0 shadow-sm rounded-4 p-3 text-center h-100">
                  <h6 className="text-warning fw-bold mb-2 small text-uppercase">
                    รอการตรวจ
                  </h6>
                  <h1 className="display-5 fw-bold text-warning mb-0">
                    {ungradedCount}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 📚 จัดการวิชา (อัปเดตดูรายชื่อผู้เรียน) */}
        {activeTab === "courses" && (
          <div className="fade-in">
            {viewingCourseStudents ? (
              // โหมดดูรายชื่อนักเรียน
              <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-header bg-success text-white p-4 rounded-top-4 d-flex justify-content-between align-items-center">
                  <h5 className="fw-bold mb-0">
                    👥 รายชื่อนักเรียน: {viewingCourseStudents.course_name}
                  </h5>
                  <button
                    onClick={() => setViewingCourseStudents(null)}
                    className="btn btn-light btn-sm fw-bold rounded-pill text-success"
                  >
                    ย้อนกลับ
                  </button>
                </div>
                <div className="card-body p-4">
                  {enrollments.filter(
                    (e) => e.course_id === viewingCourseStudents.id,
                  ).length === 0 ? (
                    <p className="text-center text-muted py-4">
                      ยังไม่มีนักเรียนลงทะเบียนในวิชานี้
                    </p>
                  ) : (
                    <div className="row g-3">
                      {enrollments
                        .filter((e) => e.course_id === viewingCourseStudents.id)
                        .map((student, idx) => (
                          <div key={idx} className="col-md-6 col-lg-4">
                            <div className="card border-light shadow-sm rounded-3">
                              <div className="card-body p-3 d-flex align-items-center gap-3">
                                <div
                                  className="bg-success bg-opacity-10 text-success rounded-circle flex-shrink-0 d-flex justify-content-center align-items-center"
                                  style={{
                                    width: "40px",
                                    height: "40px",
                                    fontSize: "20px",
                                  }}
                                >
                                  👨‍🎓
                                </div>
                                <div>
                                  <h6 className="fw-bold mb-0">
                                    {student.profiles?.full_name ||
                                      "ยังไม่ระบุชื่อ"}
                                  </h6>
                                  <small className="text-muted">
                                    รหัส:{" "}
                                    {student.profiles?.student_code ||
                                      "ไม่มีรหัส"}
                                  </small>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // โหมดจัดการวิชาปกติ
              <>
                <div className="card border-0 shadow-sm rounded-4 mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">✨ เปิดรายวิชาใหม่</h5>
                    <form onSubmit={handleCreateCourse}>
                      <div className="row g-3 mb-3">
                        <div className="col-md-3">
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-3 p-3"
                            placeholder="รหัสวิชา (เช่น 30000-1201)"
                            value={courseForm.code}
                            onChange={(e) =>
                              setCourseForm({
                                ...courseForm,
                                code: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="col-md-5">
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-3 p-3"
                            placeholder="ชื่อวิชา"
                            value={courseForm.name}
                            onChange={(e) =>
                              setCourseForm({
                                ...courseForm,
                                name: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="col-md-4">
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-3 p-3"
                            placeholder="กลุ่ม/แผนก (เช่น ช่างยนต์ ปวช.1)"
                            value={courseForm.section}
                            onChange={(e) =>
                              setCourseForm({
                                ...courseForm,
                                section: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="row g-3 align-items-center">
                        <div className="col-md-3">
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-3 p-3"
                            placeholder="ภาคเรียน (เช่น 1/2569)"
                            value={courseForm.semester}
                            onChange={(e) =>
                              setCourseForm({
                                ...courseForm,
                                semester: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-3 p-3"
                            placeholder="หน่วยกิต (เช่น 3)"
                            value={courseForm.credits}
                            onChange={(e) =>
                              setCourseForm({
                                ...courseForm,
                                credits: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <button
                            type="submit"
                            className="btn btn-success w-100 rounded-3 fw-bold p-3 shadow-sm"
                          >
                            บันทึกรายวิชา
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                <h6 className="fw-bold text-muted mb-3">
                  รายวิชาที่คุณดูแล ({courses.length})
                </h6>
                <div className="row g-3">
                  {courses.map((c) => {
                    const studentCount = enrollments.filter(
                      (e) => e.course_id === c.id,
                    ).length;
                    return (
                      <div key={c.id} className="col-md-6 col-lg-4">
                        <div className="card border-0 shadow-sm rounded-4 h-100 position-relative d-flex flex-column">
                          {editingCourse?.id === c.id ? (
                            <div className="card-body p-3">
                              <form
                                onSubmit={handleUpdateCourse}
                                className="d-flex flex-column gap-2"
                              >
                                <input
                                  type="text"
                                  className="form-control bg-light border-0 rounded-3"
                                  value={editingCourse.course_code}
                                  onChange={(e) =>
                                    setEditingCourse({
                                      ...editingCourse,
                                      course_code: e.target.value,
                                    })
                                  }
                                  required
                                />
                                <input
                                  type="text"
                                  className="form-control bg-light border-0 rounded-3"
                                  value={editingCourse.course_name}
                                  onChange={(e) =>
                                    setEditingCourse({
                                      ...editingCourse,
                                      course_name: e.target.value,
                                    })
                                  }
                                  required
                                />
                                <div className="d-flex gap-2">
                                  <input
                                    type="text"
                                    className="form-control bg-light border-0 rounded-3"
                                    value={editingCourse.semester}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        semester: e.target.value,
                                      })
                                    }
                                    required
                                  />
                                  <input
                                    type="text"
                                    className="form-control bg-light border-0 rounded-3"
                                    value={editingCourse.credits}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        credits: e.target.value,
                                      })
                                    }
                                    required
                                  />
                                </div>
                                <input
                                  type="text"
                                  className="form-control bg-light border-0 rounded-3"
                                  value={editingCourse.section}
                                  onChange={(e) =>
                                    setEditingCourse({
                                      ...editingCourse,
                                      section: e.target.value,
                                    })
                                  }
                                  required
                                />
                                <div className="d-flex gap-2 mt-2">
                                  <button
                                    type="submit"
                                    className="btn btn-success btn-sm w-50 rounded-pill"
                                  >
                                    บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCourse(null)}
                                    className="btn btn-light btn-sm w-50 rounded-pill"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              </form>
                            </div>
                          ) : (
                            <>
                              <div className="position-absolute top-0 end-0 p-3">
                                <button
                                  onClick={() => setEditingCourse(c)}
                                  className="btn btn-light text-warning rounded-circle shadow-sm me-2"
                                  style={{
                                    width: "35px",
                                    height: "35px",
                                    padding: 0,
                                  }}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(c.id)}
                                  className="btn btn-light text-danger rounded-circle shadow-sm"
                                  style={{
                                    width: "35px",
                                    height: "35px",
                                    padding: 0,
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                              <div className="card-body p-4 pt-5 mt-2 flex-grow-1">
                                <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-2 mb-2">
                                  {c.course_code}
                                </span>
                                <h5 className="fw-bold mb-1">
                                  {c.course_name}
                                </h5>
                                <p className="text-muted small mb-3">
                                  ภาค: {c.semester || "-"} | กิต:{" "}
                                  {c.credits || "-"}
                                </p>
                                <span className="badge bg-light text-dark border px-3 py-2 mb-3">
                                  กลุ่ม: {c.section}
                                </span>
                              </div>
                              {/* อัปเดต: เพิ่มปุ่มดูรายชื่อนักเรียน */}
                              <div className="px-4 pb-4">
                                <button
                                  onClick={() => setViewingCourseStudents(c)}
                                  className="btn btn-outline-success w-100 rounded-pill fw-bold"
                                >
                                  👥 ผู้เรียน {studentCount} คน (คลิกดูชื่อ)
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: 📎 เอกสาร (โค้ดเดิม) */}
        {activeTab === "materials" && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4">เพิ่มเอกสารใหม่</h5>
                  <div className="d-flex bg-light p-1 rounded-pill mb-4">
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`btn rounded-pill flex-grow-1 fw-bold ${uploadMode === "file" ? "btn-white shadow-sm" : "text-muted border-0"}`}
                    >
                      📂 อัปโหลดไฟล์
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("link")}
                      className={`btn rounded-pill flex-grow-1 fw-bold ${uploadMode === "link" ? "btn-white shadow-sm" : "text-muted border-0"}`}
                    >
                      🔗 วางลิงก์เว็บ
                    </button>
                  </div>
                  <form
                    onSubmit={handleUploadMaterial}
                    className="d-flex flex-column gap-3"
                  >
                    <select
                      className="form-select bg-light border-0 rounded-3 p-3"
                      value={materialForm.course_id}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          course_id: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">-- เลือกรายวิชา --</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.course_code} {c.course_name} ({c.section})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-control bg-light border-0 rounded-3 p-3"
                      placeholder="ชื่อเอกสาร / บทเรียน"
                      value={materialForm.title}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                    {uploadMode === "file" ? (
                      <input
                        type="file"
                        className="form-control bg-light border-0 rounded-3 p-3"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                        onChange={(e) =>
                          setMaterialForm({
                            ...materialForm,
                            file: e.target.files[0],
                          })
                        }
                        required
                      />
                    ) : (
                      <input
                        type="url"
                        className="form-control bg-light border-0 rounded-3 p-3"
                        placeholder="https://..."
                        value={materialForm.link}
                        onChange={(e) =>
                          setMaterialForm({
                            ...materialForm,
                            link: e.target.value,
                          })
                        }
                        required
                      />
                    )}
                    <button
                      type="submit"
                      className="btn btn-success rounded-pill fw-bold py-3 mt-2 shadow-sm"
                      disabled={uploading}
                    >
                      {uploading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <h6 className="fw-bold text-muted mb-3">
                เอกสารในระบบ ({materials.length})
              </h6>
              <div className="d-flex flex-column gap-3">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="card border-0 shadow-sm rounded-4 p-3 d-flex flex-row align-items-center gap-3"
                  >
                    <div
                      className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: "50px", height: "50px", flexShrink: 0 }}
                    >
                      📎
                    </div>
                    <div className="flex-grow-1">
                      {editingMaterial?.id === m.id ? (
                        <form
                          onSubmit={handleUpdateMaterial}
                          className="d-flex gap-2"
                        >
                          <input
                            type="text"
                            className="form-control bg-light border-0 rounded-pill form-control-sm"
                            value={editingMaterial.title}
                            onChange={(e) =>
                              setEditingMaterial({
                                ...editingMaterial,
                                title: e.target.value,
                              })
                            }
                            required
                          />
                          <button
                            type="submit"
                            className="btn btn-success btn-sm rounded-pill"
                          >
                            บันทึก
                          </button>
                        </form>
                      ) : (
                        <>
                          <h6 className="fw-bold mb-1">{m.title}</h6>
                          <p className="text-muted small mb-0">
                            {m.courses.course_name} ({m.courses.section})
                          </p>
                        </>
                      )}
                    </div>
                    {!editingMaterial && (
                      <div className="d-flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditingMaterial(m)}
                          className="btn btn-light text-warning rounded-circle p-2"
                          style={{ width: "40px", height: "40px" }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(m.id)}
                          className="btn btn-light text-danger rounded-circle p-2"
                          style={{ width: "40px", height: "40px" }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 📝 งาน & ตรวจให้คะแนน (โค้ดเดิม) */}
        {activeTab === "assignments" && (
          <div className="fade-in">
            <div
              className="d-flex bg-white p-1 rounded-pill shadow-sm mb-4"
              style={{ maxWidth: "400px" }}
            >
              <button
                className={`btn rounded-pill flex-grow-1 fw-bold ${assignSubTab === "create" ? "btn-success shadow-sm" : "btn-white text-muted"}`}
                onClick={() => setAssignSubTab("create")}
              >
                ➕ สั่งงานใหม่
              </button>
              <button
                className={`btn rounded-pill flex-grow-1 fw-bold ${assignSubTab === "grade" ? "btn-success shadow-sm" : "btn-white text-muted"}`}
                onClick={() => setAssignSubTab("grade")}
              >
                ✔️ ตรวจงาน
              </button>
            </div>
            {assignSubTab === "create" && (
              <div className="row g-4">
                <div className="col-lg-5">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body p-4">
                      <h5 className="fw-bold mb-4">สร้างคำสั่งงาน</h5>
                      <form
                        onSubmit={handleCreateAssignment}
                        className="d-flex flex-column gap-3"
                      >
                        <select
                          className="form-select bg-light border-0 rounded-3 p-3"
                          value={assignForm.course_id}
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              course_id: e.target.value,
                            })
                          }
                          required
                        >
                          <option value="">-- เลือกรายวิชา --</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.course_code} {c.course_name} ({c.section})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="form-control bg-light border-0 rounded-3 p-3"
                          placeholder="หัวข้องาน"
                          value={assignForm.title}
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              title: e.target.value,
                            })
                          }
                          required
                        />
                        <textarea
                          className="form-control bg-light border-0 rounded-3 p-3"
                          placeholder="รายละเอียด..."
                          value={assignForm.description}
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              description: e.target.value,
                            })
                          }
                          rows="4"
                          required
                        />
                        <button
                          type="submit"
                          className="btn btn-success rounded-pill fw-bold py-3 mt-2 shadow-sm"
                        >
                          ส่งคำสั่งงาน
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="col-lg-7">
                  <h6 className="fw-bold text-muted mb-3">
                    งานที่สั่งไปแล้ว ({assignments.length})
                  </h6>
                  <div className="d-flex flex-column gap-3">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="card border-0 shadow-sm rounded-4 position-relative overflow-hidden"
                      >
                        <div
                          className="bg-primary bg-opacity-10 p-2 position-absolute top-0 start-0 h-100"
                          style={{ width: "8px" }}
                        ></div>
                        <div className="card-body p-4 ms-2">
                          <div className="position-absolute top-0 end-0 p-3">
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="btn btn-light text-danger rounded-circle shadow-sm"
                              style={{
                                width: "35px",
                                height: "35px",
                                padding: 0,
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                          <span className="badge bg-light text-primary border mb-2">
                            {a.courses.course_name} ({a.courses.section})
                          </span>
                          <h5 className="fw-bold mb-2">{a.title}</h5>
                          <p className="text-muted small mb-0">
                            {a.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {assignSubTab === "grade" && (
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4">
                    รอตรวจและให้คะแนน ({ungradedCount})
                  </h5>
                  {submissions.length === 0 ? (
                    <p className="text-center text-muted py-5">
                      ยังไม่มีงานส่งเข้ามา
                    </p>
                  ) : (
                    <div className="row g-3">
                      {submissions.map((sub) => (
                        <div key={sub.id} className="col-12 col-xl-6">
                          <div className="card border border-light shadow-sm rounded-4 h-100">
                            <div className="card-body p-4">
                              <div className="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                  <span className="badge bg-danger text-white rounded-pill px-2 py-1 me-2">
                                    {sub.assignments.courses.section}
                                  </span>
                                  <span className="badge bg-light text-dark border rounded-pill px-2 py-1">
                                    {sub.profiles?.student_code || "ไม่มีรหัส"}
                                  </span>
                                  <div className="fw-bold mt-2">
                                    {sub.profiles?.full_name || "ไม่ระบุชื่อ"}
                                  </div>
                                </div>
                                {sub.score !== null ? (
                                  <span className="badge bg-success rounded-pill px-3 py-2 fs-6">
                                    ตรวจแล้ว {sub.score} คะแนน
                                  </span>
                                ) : (
                                  <span className="badge bg-warning text-dark rounded-pill px-3 py-2 fs-6">
                                    ⏳ รอตรวจ
                                  </span>
                                )}
                              </div>
                              <div className="bg-light rounded-3 p-3 mb-3">
                                <strong className="text-primary small d-block mb-1">
                                  {sub.assignments.courses.course_name} :{" "}
                                  {sub.assignments.title}
                                </strong>
                                <p className="mb-0 text-dark">
                                  "{sub.submitted_text}"
                                </p>
                              </div>
                              {sub.score === null && (
                                <form
                                  onSubmit={(e) => handleGradeSubmit(e, sub.id)}
                                  className="d-flex align-items-center gap-2 mt-auto"
                                >
                                  <input
                                    type="number"
                                    className="form-control bg-light border-0 rounded-pill px-3"
                                    placeholder="ใส่คะแนน"
                                    required
                                    onChange={(e) =>
                                      setGradeForm({
                                        id: sub.id,
                                        score: e.target.value,
                                      })
                                    }
                                    style={{ maxWidth: "120px" }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-success rounded-pill fw-bold px-4"
                                  >
                                    บันทึก
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: 📝 สร้างแบบทดสอบ (โค้ดเดิม) */}
        {activeTab === "quizzes" && (
          <div className="fade-in">
            <div className="card border-0 shadow-sm rounded-4 mb-5">
              <div className="card-body p-4 p-md-5">
                <h5 className="fw-bold mb-4">สร้างแบบทดสอบใหม่</h5>
                <form onSubmit={handleCreateQuiz}>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <select
                        className="form-select bg-light border-0 rounded-3 p-3"
                        value={quizForm.course_id}
                        onChange={(e) =>
                          setQuizForm({
                            ...quizForm,
                            course_id: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">-- เลือกรายวิชา --</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.course_code} {c.course_name} ({c.section})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="form-control bg-light border-0 rounded-3 p-3"
                        placeholder="หัวข้อแบบทดสอบ"
                        value={quizForm.title}
                        onChange={(e) =>
                          setQuizForm({ ...quizForm, title: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <h6 className="fw-bold mb-3">ชุดคำถาม</h6>
                  {questions.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      className="card mb-4 border-0 shadow-sm bg-light rounded-4"
                    >
                      <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center pt-4 pb-0 px-4">
                        <span className="fw-bold fs-5 text-primary">
                          ข้อที่ {qIndex + 1}
                        </span>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-white text-danger rounded-pill fw-bold"
                            onClick={() =>
                              setQuestions(
                                questions.filter((_, i) => i !== qIndex),
                              )
                            }
                          >
                            ลบข้อนี้
                          </button>
                        )}
                      </div>
                      <div className="card-body p-4">
                        <input
                          type="text"
                          className="form-control border-0 shadow-sm rounded-3 p-3 mb-4"
                          placeholder="พิมพ์โจทย์คำถาม..."
                          value={q.question}
                          onChange={(e) =>
                            updateQuestion(qIndex, "question", e.target.value)
                          }
                          required
                        />
                        <div className="row g-3">
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className="col-md-6">
                              <div
                                className={`d-flex align-items-center gap-2 border rounded-3 p-2 bg-white ${q.correctOption === optIndex ? "border-success border-2" : "border-light"}`}
                              >
                                <input
                                  className="form-check-input mt-0 ms-2"
                                  type="radio"
                                  name={`correct-${qIndex}`}
                                  style={{ width: "20px", height: "20px" }}
                                  checked={q.correctOption === optIndex}
                                  onChange={() =>
                                    updateQuestion(
                                      qIndex,
                                      "correctOption",
                                      optIndex,
                                    )
                                  }
                                />
                                <input
                                  type="text"
                                  className="form-control border-0 bg-transparent"
                                  placeholder={`ตัวเลือกที่ ${optIndex + 1}`}
                                  value={opt}
                                  onChange={(e) =>
                                    updateOption(
                                      qIndex,
                                      optIndex,
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="d-flex flex-column flex-md-row gap-3 mt-4">
                    <button
                      type="button"
                      className="btn btn-primary bg-opacity-10 text-primary border-0 rounded-pill fw-bold py-3 px-5"
                      onClick={addQuestion}
                    >
                      + เพิ่มโจทย์
                    </button>
                    <button
                      type="submit"
                      className="btn btn-success rounded-pill fw-bold flex-grow-1 py-3 shadow-sm"
                    >
                      💾 บันทึกแบบทดสอบ
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <h5 className="fw-bold mb-3 text-muted">แบบทดสอบที่สร้างไว้แล้ว</h5>
            <div className="row g-3">
              {quizzes.length === 0 && (
                <p className="text-muted">ยังไม่มีแบบทดสอบ</p>
              )}
              {quizzes.map((q) => (
                <div key={q.id} className="col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm rounded-4 p-4 h-100 d-flex flex-column">
                    <strong className="text-primary small mb-2 bg-primary bg-opacity-10 d-inline-block px-2 py-1 rounded-pill align-self-start">
                      {q.courses.course_name} ({q.courses.section})
                    </strong>
                    <span className="fw-bold fs-5 mb-2">{q.title}</span>
                    <span className="text-muted small mt-auto">
                      จำนวน {q.questions.length} ข้อ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: 👤 บัญชี (โค้ดเดิม) */}
        {activeTab === "profile" && (
          <div className="fade-in">
            <div
              className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4"
              style={{ maxWidth: "600px" }}
            >
              <div className="bg-success p-5 text-center position-relative">
                <div
                  className="bg-white rounded-circle position-absolute start-50 translate-middle border border-4 border-white shadow-sm d-flex justify-content-center align-items-center"
                  style={{
                    width: "80px",
                    height: "80px",
                    top: "100%",
                    fontSize: "30px",
                  }}
                >
                  👩‍🏫
                </div>
              </div>
              <div className="card-body pt-5 px-4 pb-4 text-center mt-3">
                <h5 className="fw-bold mb-1">ครู{profileName || ""}</h5>
                <p className="text-muted mb-0">{session?.user?.email}</p>
              </div>
            </div>
            <div
              className="card border-0 shadow-sm rounded-4"
              style={{ maxWidth: "600px" }}
            >
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">แก้ไขข้อมูลส่วนตัว</h6>
                <form onSubmit={handleUpdateProfile}>
                  <div className="mb-4">
                    <label className="form-label text-muted small fw-bold">
                      ชื่อ - นามสกุล
                    </label>
                    <input
                      type="text"
                      className="form-control bg-light border-0 rounded-pill px-4 py-2"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-success w-100 rounded-pill fw-bold py-2 shadow-sm"
                  >
                    บันทึกข้อมูล
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`.fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .form-control:focus, .form-select:focus { box-shadow: none; border: 1px solid #198754 !important; }`}</style>
    </div>
  );
}
