import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { FiSmile } from "react-icons/fi";
import Avatar from "./Avatar";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

// Update the component props to include userId if available
export default function ChatPanel({ selectedContact, username, userId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGES_PER_PAGE = 50;

  const socketRef = useRef(null);
  const currentUserIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const createConversation = async (contactId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ participantIds: [contactId] }),
      });

      if (!response.ok) throw new Error("Failed to create conversation");

      const data = await response.json();
      return data.conversationId;
    } catch (err) {
      setError("Failed to start conversation");
      console.error(err);
      return null;
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const findExistingConversation = async (contactId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:3000/api/conversations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch conversations");

      const conversations = await response.json();
      return conversations.find(
        (conv) =>
          !conv.is_group &&
          conv.participants.split(",").length === 2 &&
          conv.participants.includes(selectedContact.username)
      );
    } catch (err) {
      setError("Failed to fetch conversations");
      console.error(err);
      return null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.sender_id === currentUserIdRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  const fetchMessages = async (convId, pageToFetch = 1, append = false) => {
    const token = localStorage.getItem("token");
    try {
      setIsLoading(pageToFetch === 1);
      if (pageToFetch > 1) {
        setIsLoadingMore(true);
      }

      const response = await fetch(
        `http://localhost:3000/api/conversations/${convId}/messages?page=${pageToFetch}&limit=${MESSAGES_PER_PAGE}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch messages");

      const data = await response.json();

      if (data.messages.length < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }

      if (append) {
        setMessages((prev) => [...data.messages, ...prev]);
      } else {
        setMessages(data.messages);
        scrollToBottom();
      }
    } catch (err) {
      setError("Failed to load messages");
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (
      container.scrollTop < 100 &&
      !isLoadingMore &&
      hasMoreMessages &&
      conversationId
    ) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(conversationId, nextPage, true);
    }
  };

  useEffect(() => {
    const socket = io("http://localhost:3000");
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const handleAuth = () => {
      console.log("Authenticating socket with token...");
      socket.emit("authenticate", token);
    };

    socket.on("new_message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on("connect", () => {
      console.log("Socket connected");
      handleAuth();
    });
    socket.on("reconnect", handleAuth);
    socket.on("message_error", (error) => {
      setError(error.message);
    });
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setError("Failed to connect to chat server");
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();

    if (!trimmedMessage) {
      return;
    }

    if (!conversationId) {
      setError("No active conversation");
      return;
    }

    if (!socketRef.current?.connected) {
      setError("Not connected to chat server");
      return;
    }

    try {
      socketRef.current.emit("send_message", {
        conversationId: Number(conversationId),
        content: String(trimmedMessage),
      });
      setNewMessage("");
      setError(null);
    } catch (err) {
      console.error("Send message error:", err);
      setError("Failed to send message");
    }
  };

  useEffect(() => {
    if (selectedContact) {
      const initialize = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            throw new Error("No authentication token found");
          }

          const payload = JSON.parse(atob(token.split(".")[1]));
          currentUserIdRef.current = payload.userId;

          const existingConv = await findExistingConversation(
            selectedContact.id
          );
          if (existingConv) {
            setConversationId(existingConv.id);
            setPage(1);
            setHasMoreMessages(true);
            await fetchMessages(existingConv.id);
          } else {
            const newConvId = await createConversation(selectedContact.id);
            if (newConvId) {
              setConversationId(newConvId);
              setMessages([]);
            }
          }
        } catch (err) {
          setError(`Failed to initialize chat: ${err.message}`);
          console.error(err);
        }
      };

      initialize();
    } else {
      setConversationId(null);
      setMessages([]);
    }
  }, [selectedContact]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserIdRef.current = payload.userId;
    }
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll]);

  return (
    <div className="chat-panel">
      {selectedContact ? (
        <>
          <h2>Chat with {selectedContact.username}</h2>
          <div className="messages-container" ref={messagesContainerRef}>
            {isLoading ? (
              <div className="loading">Loading messages...</div>
            ) : (
              <>
                {isLoadingMore && (
                  <div className="loading-more">Loading more messages...</div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={`${message.id}-${index}`}
                    className={`message ${
                      message.sender_id === currentUserIdRef.current
                        ? "sent"
                        : "received"
                    }`}
                  >
                    <Avatar
                      userId={message.sender_id}
                      username={message.sender_name}
                      size={30}
                    />
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-sender">
                          {message.sender_name}
                        </span>
                        <span className="message-time">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <form onSubmit={sendMessage} className="message-input-container">
            <button
              type="button"
              className="emoji-button"
              onClick={toggleEmojiPicker}
              title="Add emoji"
            >
              <FiSmile size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <button type="submit">Send</button>
            {showEmojiPicker && (
              <div className="emoji-picker-container">
                <Picker
                  onEmojiSelect={handleEmojiSelect}
                  theme="dark"
                  set="apple"
                />
              </div>
            )}
          </form>
        </>
      ) : (
        <div className="empty-chat">Select a contact to start chatting</div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
