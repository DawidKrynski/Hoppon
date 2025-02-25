import { useEffect , useState } from 'react';
import { useNavigate } from "react-router-dom";
import Background from '../components/Background';
import ContactRequests from "../components/ContactRequests";
import AddContact from "../components/AddContact";
import ChatPanel from "../components/ChatPanel"; 
import Avatar from "../components/Avatar";
import { io } from "socket.io-client";
import { FiSettings, FiLogOut } from "react-icons/fi";

import '../Login.css';
import "./Home.css";


const handleLogout = () => {
  localStorage.removeItem("token");
  window.location.href = "/";
};



export default function Home() {
  const [username, setUsername] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [error, setError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUsername(payload.username);

      fetchContacts(token);
    } catch (err) {
      console.error("Invalid token: ", err);
      localStorage.removeItem("token");
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    const socket = io("http://localhost:3000");
    const token = localStorage.getItem("token");

    if (token) {
      socket.emit("authenticate", token);
    }

    socket.on("new_friend_request", () => {
      fetchPendingRequests(localStorage.getItem("token"));
    });

    socket.on("contact_list_updated", () => {
      fetchContacts(localStorage.getItem("token"));
      fetchPendingRequests(localStorage.getItem("token"));
    });

    socket.on("friend_request_sent", (data) => {
      const currentUserId = JSON.parse(atob(token.split(".")[1])).userId;
      if (
        data.senderId === currentUserId ||
        data.receiverId === currentUserId
      ) {
        fetchPendingRequests(token);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchPendingRequests(token);
    }
  }, []);

  const fetchPendingRequests = async (token) => {
    if (!token) {
      console.error("No token provided");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3000/api/contacts/requests",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch requests");
      }

      const data = await response.json();
      setPendingRequests(data);
    } catch (err) {
      console.error("Error fetching requests:", err.message);
      setError("Failed to load pending requests");
    }
  };

  const fetchContacts = async (token) => {
    try {
      const response = await fetch("http://localhost:3000/api/contacts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }

      const data = await response.json();
      setContacts(data);
    } catch (err) {
      setError("Failed to load contacts");
      console.error(err);
    }
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
  };

  const handleAcceptRequest = async (userId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        "http://localhost:3000/api/contacts/accept",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) throw new Error("Failed to accept request");

      // Refresh both contacts and pending requests
      await fetchContacts(token);
      await fetchPendingRequests(token);
    } catch (err) {
      console.error("Error accepting request:", err);
    }
  };

  const handleRejectRequest = async (userId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        "http://localhost:3000/api/contacts/reject",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) throw new Error("Failed to reject request");

      await fetchPendingRequests(token);
    } catch (err) {
      console.error("Error rejecting request:", err);
    }
  };

  return (
    <>
      <Background />
      <div className="home-container">
        <div className="contacts-panel">
          <div className="contacts-section">
            <h2>Contacts</h2>

            <ContactRequests
              pendingRequests={pendingRequests}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
            />

            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`contact-item ${
                  selectedContact?.id === contact.id ? "selected" : ""
                }`}
                onClick={() => handleContactSelect(contact)}
              >
                <Avatar
                  userId={contact.id}
                  username={contact.username}
                  size={40}
                />
                <span>{contact.username}</span>
              </div>
            ))}

            <AddContact
              onAddContact={() => fetchContacts(localStorage.getItem("token"))}
            />
          </div>

          <div className="user-panel">
            <div className="user-info">
              <Avatar
                userId={
                  JSON.parse(atob(localStorage.getItem("token").split(".")[1]))
                    .userId
                }
                username={username}
                size={45}
              />
              <span className="user-name">{username}</span>
            </div>
            <div className="user-controls">
              <button
                className="icon-button"
                title="Settings"
                onClick={() => navigate("/settings")}
              >
                <FiSettings size={20} />
              </button>
              <button
                className="icon-button"
                title="Logout"
                onClick={handleLogout}
              >
                <FiLogOut size={20} />
              </button>
            </div>
          </div>
        </div>

        <ChatPanel selectedContact={selectedContact} username={username} />
      </div>
      {error && <div className="error-message">{error}</div>}
    </>
  );
}