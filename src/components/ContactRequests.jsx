import Avatar from "./Avatar";

export default function ContactRequests({
  pendingRequests,
  onAcceptRequest,
  onRejectRequest,
}) {
  if (!pendingRequests || pendingRequests.length === 0) return null;

  return (
    <div className="pending-requests">
      <h3>Pending Requests</h3>
      {pendingRequests.map((request) => (
        <div key={request.id} className="request-item">
          <div className="request-user">
            <Avatar userId={request.id} username={request.username} size={32} />
            <span>{request.username}</span>
          </div>
          <div className="request-buttons">
            <button onClick={() => onAcceptRequest(request.id)}>Accept</button>
            <button onClick={() => onRejectRequest(request.id)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
