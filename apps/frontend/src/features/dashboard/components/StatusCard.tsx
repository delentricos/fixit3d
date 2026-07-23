type StatusCardProps = {
  title: string;
  value: string;
  status?: "success" | "error" | "neutral";
};

function StatusCard({ title, value, status = "neutral" }: StatusCardProps) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        minWidth: "220px",
      }}
    >
      <h3>{title}</h3>
      <p>{value}</p>
      <small>
        {status === "success" && "🟢 Online"}
        {status === "error" && "🔴 Offline"}
        {status === "neutral" && "⚪ Ready"}
      </small>
    </div>
  );
}

export default StatusCard;