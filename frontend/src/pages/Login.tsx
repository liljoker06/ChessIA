import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css";

export function Login() {

  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Connexion</h1>
        <p className="auth-subtitle">Connecte-toi pour voir l'IA affronter.</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <a 
          href={`${API_URL}/api/auth/lichess`}
          className="btn btn-block" 
          style={{ 
            display: 'inline-block', 
            backgroundColor: '#ffffff', 
            color: '#000', 
            border: '1px solid #ccc', 
            marginBottom: '20px', 
            textAlign: 'center', 
            textDecoration: 'none' 
          }}
        >
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/d/da/Lichess_Logo_2019.svg" 
            alt="Lichess logo" 
            style={{ width: '25px', marginRight: '8px', verticalAlign: 'middle' }} 
          />
          Se connecter avec Lichess
        </a>

        <p className="auth-footer">
          Pas encore de compte ? <Link to="/signup">Inscris-toi</Link>
        </p>
      </div>
    </div>
  );
}