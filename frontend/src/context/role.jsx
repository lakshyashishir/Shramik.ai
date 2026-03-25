import { createContext, useContext, useState } from "react";

export const ROLES = ["worker", "recruiter", "admin"];

export const roleConfig = {
  worker:    { label: "Worker",    labelHi: "श्रमिक",      color: "#2563eb", nav: ["/screening", "/jobs"] },
  recruiter: { label: "Recruiter", labelHi: "भर्तीकर्ता", color: "#7c3aed", nav: ["/jobs"] },
  admin:     { label: "Admin",     labelHi: "एडमिन",       color: "#0f766e", nav: ["/admin", "/admin/review"] },
};

export const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState("worker");
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
