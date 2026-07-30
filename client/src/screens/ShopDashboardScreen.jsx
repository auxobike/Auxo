export default function ShopDashboardScreen({ user, onLogout }) {
  return (
    <div className="screen">
      <h1 className="marker-heading">Shop Dashboard</h1>
      <p className="text-muted">Welcome, {user?.email}. Auxo Shop is coming soon.</p>
      <button className="btn-pill btn-pill-outline" onClick={onLogout}>Log out</button>
    </div>
  );
}
