import { useEffect, useState } from "react";
import { LoginPage } from "@/components/webpaypro/LoginPage";
import { DashboardLayout } from "@/components/webpaypro/DashboardLayout";
import { getStoredUser, STORAGE_KEY, type LoggedUser } from "@/components/webpaypro/api";

export function App() {
  const [user, setUser] = useState<LoggedUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return user ? (
    <DashboardLayout user={user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLoggedIn={setUser} />
  );
}
