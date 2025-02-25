import { useState, useEffect } from "react";
import socketService from "../services/socketService";

export default function Avatar({ userId, username, size = 32 }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState(false);

  const fetchAvatar = async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/avatar/${userId}`
      );
      if (response.ok) {
        const blob = await response.blob();
        setAvatarUrl(URL.createObjectURL(blob));
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Error fetching avatar:", err);
      setError(true);
    }
  };

  useEffect(() => {
    fetchAvatar();

    const socket = socketService.getSocket();
    socket.on("avatar_changed", (changedUserId) => {
      if (parseInt(changedUserId) === parseInt(userId)) {
        fetchAvatar();
      }
    });

    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl);
      }
      socket.off("avatar_changed");
    };
  }, [userId]);

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    backgroundColor: error ? "#e0e0e0" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (error || !avatarUrl) {
    return (
      <div style={style}>
        <span
          style={{
            fontSize: `${size / 2}px`,
            color: "#666",
          }}
        >
          {username ? username[0].toUpperCase() : "?"}
        </span>
      </div>
    );
  }

  return <img src={avatarUrl} alt={`${username}'s avatar`} style={style} />;
}
