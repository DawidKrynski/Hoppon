import { useState } from "react";
import Avatar from "../Avatar";

export default function SettingsAppearance({ username }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const token = localStorage.getItem("token");
      const reader = new FileReader();
      reader.onloadend = async () => {
        const response = await fetch("http://localhost:3000/api/avatar", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageData: reader.result,
          }),
        });

        if (response.ok) {
          alert("Avatar updated successfully");
        } else {
          throw new Error("Failed to update avatar");
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to update avatar");
    }
  };

  return (
    <div className="settings-content">
      <h2>Appearance</h2>
      <div className="avatar-section">
        <h3>Profile Picture</h3>
        <div className="current-avatar">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="avatar-preview" />
          ) : (
            <Avatar
              userId={
                JSON.parse(atob(localStorage.getItem("token").split(".")[1]))
                  .userId
              }
              username={username}
              size={128}
            />
          )}
        </div>
        <div className="avatar-controls">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            id="avatar-input"
            className="file-input"
          />
          <label htmlFor="avatar-input" className="file-input-label">
            Choose Image
          </label>
          {selectedFile && (
            <button className="upload-button" onClick={handleUpload}>
              Upload Avatar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
