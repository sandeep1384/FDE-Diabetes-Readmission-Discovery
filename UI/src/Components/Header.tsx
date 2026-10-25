function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="./index.html">Diabetes Patient Management</a>
      <nav className="topbar-nav" aria-label="Main navigation">
        <a className="nav-link" href="./index.html" aria-current="page">
          Patient search
        </a>
        <a className="nav-link" href="./high-care/index.html">High-risk care</a>
      </nav>
    </header>
  );
}

export default Header;
