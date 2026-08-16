import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function AdminDashboard({ session, handleLogout }) {
  const [activeTab, setActiveTab] = useState("departments");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // States สำหรับแผนกวิชา
  const [departments, setDepartments] = useState([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDept, setEditingDept] = useState(null);

  // States สำหรับประกาศระบบ
  const [announcements, setAnnouncements] = useState([]);
  const [annForm, setAnnForm] = useState({ title: "", content: "", is_active: true });

  // States สำหรับตั้งค่าระบบ
  const [semester, setSemester] = useState("");
  const [isSavingSys, setIsSavingSys] = useState(false);

  useEffect(() => {
    if (session?.role === "admin") fetchData();
  }, [session]);

  const fetchData = async () => {
    // 1. ดึงข้อมูลแผนกวิชา
    const { data: deptData } = await supabase.from("departments").select("*").order("created_at", { ascending: true });
    if (deptData) setDepartments(deptData);

    // 2. ดึงข้อมูลประกาศ
    const { data: annData } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (annData) setAnnouncements(annData);

    // 3. ดึงข้อมูลตั้งค่าระบบ (ภาคเรียน)
    const { data: sysData } = await supabase.from("system_settings").select("current_semester").eq("id", 1).single();
    if (sysData) setSemester(sysData.current_semester);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  /* ==========================================
     ฟังก์ชันจัดการแผนกวิชา (Departments)
  ========================================== */
  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return alert("กรุณากรอกชื่อแผนกวิชา");
    
    await supabase.from("departments").insert([{ name: newDeptName.trim() }]);
    setNewDeptName("");
    fetchData();
    alert("เพิ่มแผนกวิชาสำเร็จ!");
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    if (!editingDept.name.trim()) return alert("ชื่อแผนกต้องไม่เป็นค่าว่าง");

    await supabase.from("departments").update({ name: editingDept.name.trim() }).eq("id", editingDept.id);
    setEditingDept(null);
    fetchData();
    alert("อัปเดตแผนกวิชาสำเร็จ!");
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบแผนกวิชานี้? (อาจส่งผลกระทบต่อวิชาที่เคยสร้างด้วยชื่อแผนกนี้)")) return;
    await supabase.from("departments").delete().eq("id", id);
    fetchData();
  };

  /* ==========================================
     ฟังก์ชันจัดการประกาศ (Announcements)
  ========================================== */
  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    await supabase.from("announcements").insert([{ 
      title: annForm.title, 
      content: annForm.content, 
      is_active: annForm.is_active 
    }]);
    setAnnForm({ title: "", content: "", is_active: true });
    fetchData();
    alert("สร้างประกาศสำเร็จ!");
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("⚠️ ลบประกาศนี้หรือไม่?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    fetchData();
  };

  const toggleAnnouncementStatus = async (id, currentStatus) => {
    await supabase.from("announcements").update({ is_active: !currentStatus }).eq("id", id);
    fetchData();
  };

  /* ==========================================
     ฟังก์ชันจัดการตั้งค่าระบบ (System Settings)
  ========================================== */
  const handleSaveSystemSettings = async (e) => {
    e.preventDefault();
    setIsSavingSys(true);
    // อัปเดตตาราง system_settings id=1
    const { error } = await supabase.from("system_settings").update({ current_semester: semester }).eq("id", 1);
    setIsSavingSys(false);
    
    if (error) {
       // ถ้ายังไม่มี id=1 ให้ insert ใหม่
       await supabase.from("system_settings").insert([{ id: 1, current_semester: semester }]);
    }
    alert("บันทึกการตั้งค่าระบบสำเร็จ!");
  };

  if (!session || session.role !== "admin") return <Navigate to="/" />;

  return (
    <div className="bg-light min-vh-100 pb-5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 🟢 Top Navigation */}
      <div className="bg-white shadow-sm sticky-top px-4 py-3 d-flex align-items-center justify-content-between mb-4 z-3">
        <div className="d-flex align-items-center gap-3">
          <button onClick={() => setIsMenuOpen(true)} className="btn btn-light text-primary rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '40px', height: '40px' }}>
            <span className="fs-5">☰</span>
          </button>
          <h5 className="fw-bold text-primary m-0">Admin Control Panel</h5>
        </div>
        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>👑</div>
      </div>

      {/* 🟢 Drawer Menu */}
      {isMenuOpen && (
        <>
          <div className="offcanvas-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setIsMenuOpen(false)}></div>
          <div className="offcanvas offcanvas-start show shadow-lg border-0" style={{ visibility: "visible", zIndex: 1045, width: "280px" }}>
            <div className="offcanvas-header p-4 bg-primary text-white">
              <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><span>🛠️</span> เมนูแอดมิน</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsMenuOpen(false)}></button>
            </div>
            <div className="offcanvas-body d-flex flex-column p-3 bg-white gap-1">
              {[
                { id: 'departments', icon: '🏢', label: 'จัดการแผนกวิชา' }, 
                { id: 'announcements', icon: '📢', label: 'จัดการประกาศระบบ' }, 
                { id: 'settings', icon: '⚙️', label: 'ตั้งค่าภาคเรียน' }
              ].map(item => (
                <button key={item.id} className={`btn text-start fw-bold py-3 px-4 rounded-4 transition-all ${activeTab === item.id ? "bg-primary bg-opacity-10 text-primary" : "bg-white text-muted border-0 hover-bg-light"}`} onClick={() => handleTabChange(item.id)}>
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

      <div className="container" style={{ maxWidth: '1000px' }}>

        {/* TAB 1: 🏢 จัดการแผนกวิชา */}
        {activeTab === "departments" && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div className="card-body p-4 p-md-5">
                  <h5 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2"><span>➕</span> เพิ่มแผนกวิชาใหม่</h5>
                  <form onSubmit={handleAddDepartment}>
                    <input 
                      type="text" 
                      className="form-control custom-input bg-light border-0 rounded-4 p-3 mb-4" 
                      placeholder="เช่น แผนกวิชาช่างยนต์" 
                      value={newDeptName} 
                      onChange={(e) => setNewDeptName(e.target.value)} 
                      required 
                    />
                    <button type="submit" className="btn btn-primary w-100 rounded-4 fw-bold p-3 shadow-sm custom-btn">บันทึกแผนกใหม่</button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="col-lg-7">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark m-0">แผนกวิชาในระบบ</h5>
                <span className="badge bg-primary rounded-pill px-3 py-2 fs-6">{departments.length} แผนก</span>
              </div>
              <div className="d-flex flex-column gap-3">
                {departments.length === 0 && <p className="text-muted">ยังไม่มีข้อมูลแผนกวิชา</p>}
                {departments.map((dept) => (
                  <div key={dept.id} className="bg-white border-0 shadow-sm rounded-4 p-4 d-flex justify-content-between align-items-center hover-card transition-all">
                    {editingDept?.id === dept.id ? (
                      <form onSubmit={handleUpdateDepartment} className="d-flex gap-2 flex-grow-1 me-3">
                        <input 
                          type="text" 
                          className="form-control bg-light border-0 rounded-pill px-3" 
                          value={editingDept.name} 
                          onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })} 
                          required 
                        />
                        <button type="submit" className="btn btn-success rounded-pill px-3 fw-bold">✔</button>
                        <button type="button" onClick={() => setEditingDept(null)} className="btn btn-light rounded-pill px-3 fw-bold">✖</button>
                      </form>
                    ) : (
                      <>
                        <h6 className="fw-bold text-dark m-0 fs-5 d-flex align-items-center gap-3">
                          <span className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>🏢</span>
                          {dept.name}
                        </h6>
                        <div className="d-flex gap-2">
                          <button onClick={() => setEditingDept(dept)} className="btn btn-light text-warning rounded-circle p-2 shadow-sm" title="แก้ไข"><span style={{fontSize:'14px'}}>✏️</span></button>
                          <button onClick={() => handleDeleteDepartment(dept.id)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm" title="ลบ"><span style={{fontSize:'14px'}}>🗑️</span></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 📢 จัดการประกาศระบบ */}
        {activeTab === "announcements" && (
          <div className="fade-in row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div className="card-body p-4 p-md-5">
                  <h5 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2"><span>📢</span> สร้างประกาศใหม่</h5>
                  <form onSubmit={handleAddAnnouncement} className="d-flex flex-column gap-3">
                    <input type="text" className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="หัวข้อประกาศ" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} required />
                    <textarea className="form-control custom-input bg-light border-0 rounded-4 p-3" placeholder="รายละเอียดประกาศ..." value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} rows="4" required />
                    <div className="form-check form-switch mt-2">
                      <input className="form-check-input" type="checkbox" id="isActiveCheck" checked={annForm.is_active} onChange={(e) => setAnnForm({ ...annForm, is_active: e.target.checked })} />
                      <label className="form-check-label fw-bold text-secondary" htmlFor="isActiveCheck">เปิดใช้งานทันที</label>
                    </div>
                    <button type="submit" className="btn btn-primary w-100 rounded-4 fw-bold p-3 mt-3 shadow-sm custom-btn">ส่งประกาศ</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <h5 className="fw-bold text-dark mb-4">ประวัติการประกาศ</h5>
              <div className="d-flex flex-column gap-3">
                {announcements.length === 0 && <p className="text-muted">ยังไม่มีประกาศ</p>}
                {announcements.map((ann) => (
                  <div key={ann.id} className={`bg-white border-0 shadow-sm rounded-4 p-4 hover-card transition-all ${ann.is_active ? 'border-start border-4 border-warning' : 'opacity-75'}`}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="fw-bold text-dark m-0">{ann.title}</h5>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="btn btn-light text-danger rounded-circle p-2 shadow-sm"><span style={{fontSize:'12px'}}>🗑️</span></button>
                    </div>
                    <p className="text-muted small bg-light p-3 rounded-4 my-3 lh-base">{ann.content}</p>
                    <div className="d-flex justify-content-between align-items-center border-top pt-3">
                      <small className="text-muted">{new Date(ann.created_at).toLocaleDateString('th-TH')}</small>
                      <button 
                        onClick={() => toggleAnnouncementStatus(ann.id, ann.is_active)} 
                        className={`btn btn-sm rounded-pill px-3 fw-bold ${ann.is_active ? 'btn-warning text-dark' : 'btn-secondary text-white'}`}
                      >
                        {ann.is_active ? 'กำลังแสดงผล' : 'ปิดการแสดงผล'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ⚙️ ตั้งค่าระบบ */}
        {activeTab === "settings" && (
          <div className="fade-in d-flex justify-content-center">
            <div className="card border-0 shadow-sm rounded-4 w-100 bg-white" style={{ maxWidth: "600px" }}>
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-5">
                  <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px', fontSize: '36px' }}>⚙️</div>
                  <h4 className="fw-bold text-dark">การตั้งค่าระบบส่วนกลาง</h4>
                  <p className="text-muted">ค่าที่ตั้งไว้นี้จะถูกนำไปใช้เป็นค่าเริ่มต้นสำหรับผู้ใช้ทุกคน</p>
                </div>
                
                <form onSubmit={handleSaveSystemSettings}>
                  <div className="mb-4 bg-light p-4 rounded-4 border">
                    <label className="form-label fw-bold text-dark mb-3 d-flex align-items-center gap-2"><span>📅</span> ภาคเรียนปัจจุบัน (Current Semester)</label>
                    <input 
                      type="text" 
                      className="form-control custom-input border-0 rounded-pill px-4 py-3 fw-bold text-center fs-5 text-primary shadow-sm" 
                      placeholder="เช่น 1/2569" 
                      value={semester} 
                      onChange={(e) => setSemester(e.target.value)} 
                      required 
                    />
                    <small className="form-text text-muted d-block text-center mt-3">
                      ค่านี้จะไปโผล่อัตโนมัติในหน้า <b>"เปิดรายวิชาใหม่"</b> ของคุณครูทุกคน เพื่อป้องกันการพิมพ์ภาคเรียนผิดพลาด
                    </small>
                  </div>
                  
                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-3 shadow-sm custom-btn" disabled={isSavingSys}>
                    {isSavingSys ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        .transition-all { transition: all 0.3s ease; } 
        .hover-bg-light:hover { background-color: #f8f9fa !important; } 
        .hover-card { transition: transform 0.2s, box-shadow 0.2s; } 
        .hover-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; } 
        .custom-input { transition: all 0.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); } 
        .custom-input:focus { box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.15) !important; background-color: #fff !important; } 
        .custom-btn { transition: all 0.3s; } 
        .custom-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(13, 110, 253, 0.3) !important; } 
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } 
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes slideDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}