const Footer = () => (
  <footer className="border-t border-border bg-card/50 backdrop-blur-md py-3 text-center">
    <span className="font-mono text-xs text-muted-foreground">Developed by </span>
    <a
      href="https://linktr.ee/anikettegginamath"
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs font-semibold transition-colors duration-300"
      style={{
        color: "hsl(187, 100%, 50%)",
        textShadow: "0 0 8px hsl(187 100% 50% / 0.6), 0 0 20px hsl(187 100% 50% / 0.3)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "hsl(150, 100%, 50%)";
        e.currentTarget.style.textShadow = "0 0 8px hsl(150 100% 50% / 0.6), 0 0 20px hsl(150 100% 50% / 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "hsl(187, 100%, 50%)";
        e.currentTarget.style.textShadow = "0 0 8px hsl(187 100% 50% / 0.6), 0 0 20px hsl(187 100% 50% / 0.3)";
      }}
    >
      Aniket Tegginamath
    </a>
  </footer>
);

export default Footer;
