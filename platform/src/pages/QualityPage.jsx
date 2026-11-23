import React, { Suspense } from 'react';

const QualityPanel = React.lazy(() => import('../components/QualityPanel.jsx'));

export default function QualityPage({ facilities, user, onRequireAuth, onToast }) {
  return (
    <Suspense fallback={<div className="loading-state" role="status"><span className="loading-spinner" /><p>Chargement des analyses…</p></div>}>
      <QualityPanel facilities={facilities} user={user} onRequireAuth={onRequireAuth} onToast={onToast} />
    </Suspense>
  );
}
