import React from 'react'

export default function Header({ title, handleLogout }) {
  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center bg-white p-4 rounded shadow-sm mb-4">
      <h3 className="m-0 text-primary fw-bold mb-3 mb-md-0">{title}</h3>
      <button onClick={handleLogout} className="btn btn-danger fw-bold">ออกจากระบบ</button>
    </div>
  )
}