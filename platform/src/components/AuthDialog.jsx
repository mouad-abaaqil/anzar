import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import Modal from './Modal.jsx';

export default function AuthDialog({ user, onClose, onSuccess, onLogout }) {
  return (
    <Modal title={user ? 'Votre espace de suivi' : 'Votre espace de suivi de l’eau'} onClose={onClose}>
      {user ? (
        <div className="account-panel">
          <ShieldCheck size={30} />
          <h3>{user.workspace || user.name}</h3>
          <p>{user.email}</p>
          <p>Vos analyses sont enregistrées dans votre espace privé. Les données publiques restent accessibles sans compte.</p>
          <button className="secondary-button" onClick={onLogout}><LogOut size={16} />Se déconnecter</button>
        </div>
      ) : (
        <AuthForm onSuccess={onSuccess} />
      )}
    </Modal>
  );
}

function AuthForm({ onSuccess }) {
  const [register, setRegister] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'Connexion impossible.');
      onSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Le serveur est indisponible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="auth-tabs">
        <button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); }}>Créer un espace</button>
        <button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); }}>Se connecter</button>
      </div>
      <p className="auth-intro">Enregistrez vos prélèvements et retrouvez l’historique de vos analyses dans un espace privé.</p>
      <form className="auth-form" onSubmit={submit}>
        {register && (
          <>
            <label>Votre nom<input name="name" required autoComplete="name" maxLength={100} /></label>
            <label>Nom de l’espace<input name="workspace" placeholder="Équipe environnement" required maxLength={100} /></label>
          </>
        )}
        <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            required
            minLength={register ? 12 : 1}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
          {register && <small>12 caractères minimum.</small>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Connexion…' : register ? 'Créer mon espace' : 'Se connecter'}</button>
        <p className="auth-footnote">Les comptes et analyses sont conservés sur le serveur de cette installation. L’inscription ne vérifie pas l’adresse e-mail.</p>
      </form>
    </>
  );
}
