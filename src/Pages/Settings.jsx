import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SettingsAppearance from "../components/settings/SettingsAppearance";
import "./Settings.css";

export default function Settings() {
  const [username, setUsername] = useState("");
  const [activeSection, setActiveSection] = useState("appearance");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUsername(payload.username);
    } catch (err) {
      console.error("Invalid token:", err);
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [navigate]);

  const handleBack = () => {
    navigate("/home");
  };

  return (
    <div className="settings-container">
      <div className="settings-panel">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h1>Settings</h1>

        <div className="settings-layout">
          <div className="settings-sidebar">
            <button
              className={`sidebar-button ${
                activeSection === "appearance" ? "active" : ""
              }`}
              onClick={() => setActiveSection("appearance")}
            >
              Appearance
            </button>
            <button
              className={`sidebar-button ${
                activeSection === "notifications" ? "active" : ""
              }`}
              onClick={() => setActiveSection("notifications")}
            >
              Notifications
            </button>
            <button
              className={`sidebar-button ${
                activeSection === "messages" ? "active" : ""
              }`}
              onClick={() => setActiveSection("messages")}
            >
              Messages
            </button>
          </div>

          <div className="settings-content-wrapper">
            {activeSection === "appearance" && (
              <SettingsAppearance username={username} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
