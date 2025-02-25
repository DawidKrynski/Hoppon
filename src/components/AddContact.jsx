import { useState } from "react";

export default function AddContact({ onAddContact }) {
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState("");
  const [addContactError, setAddContactError] = useState("");

  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddContactError("");


    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        "http://localhost:3000/api/contacts/request",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username: newContactUsername }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send friend request");
      }

      setNewContactUsername("");
      setAddContactError("Friend request sent successfully!");
      onAddContact();
    } catch (err) {
      setAddContactError(err.message);
    }
  };


  const handleHide = (e) => {
    e.preventDefault();
    setAddContactError("");
    setShowAddContact(false);
  };

  return (
    <div>
      {showAddContact ? (
        <form onSubmit={handleAddContact} className="add-contact-form">
          <input
            type="text"
            value={newContactUsername}
            onChange={(e) => setNewContactUsername(e.target.value)}
            placeholder="Enter username"
          />
          {addContactError && (
            <div
              className={
                addContactError.includes("successfully") ? "success" : "error"
              }
            >
              {addContactError}
            </div>
          )}
          <button className="add-contact-button">
            Send
          </button>
          <button className="add-contact-button" onClick={handleHide}>
            Hide
          </button>
        </form>
      ) : (
        <button
          className="add-contact-button"
          onClick={() => setShowAddContact(true)}
        >
          Add Contact
        </button>
      )}
    </div>
  );
}
