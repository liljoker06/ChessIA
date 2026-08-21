import { Link } from "react-router-dom";
import "../styles/auth.css";

export function Signup() {
  const lichessSignupUrl = "https://lichess.org/signup";

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Inscription</h1>
        <p className="auth-subtitle">
          Le compte se crée sur le site officiel de Lichess, puis tu reviens ici
          pour te connecter via OAuth.
        </p>

        <a
          href={lichessSignupUrl}
          className="btn btn-primary btn-block"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/d/da/Lichess_Logo_2019.svg"
            alt="Lichess logo"
            style={{
              width: "25px",
              marginRight: "8px",
              verticalAlign: "middle",
            }}
          />
          Créer mon compte sur Lichess
        </a>

        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Connecte-toi</Link>
        </p>
      </div>
    </div>
  );
}
