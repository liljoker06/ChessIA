import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth(); 

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      loginWithToken(token);
      navigate("/");
    } else {
      navigate("/login?error=auth_failed");
    }
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="auth-page">
      <div className="card">
        <h2>Connexion en cours...</h2>
        <p>Veuillez patienter.</p>
      </div>
    </div>
  );
}